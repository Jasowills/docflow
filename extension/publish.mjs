import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import { ContainerClient } from '@azure/storage-blob';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
const ENV_PATHS = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
];

function parseDotEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function loadEnvFallback() {
  for (const envPath of ENV_PATHS) {
    try {
      const content = await fs.readFile(envPath, 'utf8');
      const parsed = parseDotEnv(content);
      for (const [key, value] of Object.entries(parsed)) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
    }
  }
}

async function createZipFromDir(sourceDir, zipPath) {
  await fs.rm(zipPath, { force: true });

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

async function main() {
  await loadEnvFallback();

  const packageJsonRaw = await fs.readFile(PACKAGE_JSON_PATH, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);
  const version = packageJson.version;

  const apiBaseUrl =
    process.env.DOCFLOW_API_BASE_URL ||
    process.env.DOC_STUDIO_API_BASE_URL;
  const publishKey =
    process.env.EXTENSION_PUBLISH_SECRET ||
    process.env.EXTENSION_PUBLISH_KEY;
  const notes = process.env.EXTENSION_RELEASE_NOTES;
  const containerSasUrl = process.env.AZURE_BLOB_SAS_URL;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseBucket =
    process.env.EXTENSION_RELEASES_STORAGE_BUCKET ||
    process.env.SUPABASE_STORAGE_BUCKET;
  const outputDirName = process.env.EXTENSION_OUTPUT_DIR || 'DocFlow-recorder';

  if (!apiBaseUrl) {
    throw new Error('DOCFLOW_API_BASE_URL is required');
  }
  if (!publishKey) {
    throw new Error('EXTENSION_PUBLISH_SECRET is required');
  }
  if (!containerSasUrl && (!supabaseUrl || !supabaseServiceRoleKey || !supabaseBucket)) {
    throw new Error(
      'Configure either AZURE_BLOB_SAS_URL or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET.',
    );
  }

  const artifactDir = path.resolve(process.cwd(), outputDirName);
  const zipFileName = `DocFlow-recorder-v${version}.zip`;
  const zipPath = path.resolve(process.cwd(), zipFileName);
  await createZipFromDir(artifactDir, zipPath);

  const blobName = `docflow-recorder/${version}/${zipFileName}`;
  const downloadUrl = supabaseUrl && supabaseServiceRoleKey && supabaseBucket
    ? await uploadToSupabaseStorage({
        zipPath,
        blobName,
        bucket: supabaseBucket,
        supabaseUrl,
        serviceRoleKey: supabaseServiceRoleKey,
      })
    : await uploadToAzureBlob({
        zipPath,
        blobName,
        containerSasUrl: containerSasUrl,
      });

  const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/extensions/releases/publish`;
  const body = {
    version,
    downloadUrl,
    notes: notes || undefined,
  };

  let response;
  try {
    response = await retryAsync(() =>
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-extension-publish-key': publishKey,
        },
        body: JSON.stringify(body),
      }),
    );
  } catch (error) {
    const cause = error && typeof error === 'object' ? error.cause : null;
    const code = cause && typeof cause === 'object' ? cause.code : undefined;
    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Publish endpoint unreachable (${endpoint}). Start the DocFlow API or set DOCFLOW_API_BASE_URL to a reachable host.`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Publish failed (${response.status}): ${text || response.statusText}`);
  }

  const result = await response.json();
  console.log(`Uploaded extension artifact: ${blobName}`);
  console.log(`Published extension release v${result.version} -> ${result.downloadUrl}`);
}

async function uploadToAzureBlob({
  zipPath,
  blobName,
  containerSasUrl,
}) {
  const containerClient = new ContainerClient(containerSasUrl);
  const blobClient = containerClient.getBlockBlobClient(blobName);

  await retryAsync(() =>
    blobClient.uploadFile(zipPath, {
      blobHTTPHeaders: {
        blobContentType: 'application/zip',
        blobContentDisposition: `attachment; filename="${path.basename(zipPath)}"`,
      },
    }),
  );

  return blobClient.url;
}

async function uploadToSupabaseStorage({
  zipPath,
  blobName,
  bucket,
  supabaseUrl,
  serviceRoleKey,
}) {
  const fileBuffer = await fs.readFile(zipPath);
  const uploadUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${blobName}`;
  const response = await retryAsync(() =>
    fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/zip',
        'x-upsert': 'true',
      },
      body: fileBuffer,
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase storage upload failed (${response.status}): ${text || response.statusText}`);
  }

  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${blobName}`;
}

async function retryAsync(operation, options = {}) {
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? 1200;

  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}

function isRetryableNetworkError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const cause = error && typeof error === 'object' ? error.cause : null;
  const code = cause && typeof cause === 'object' ? cause.code : undefined;

  return (
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    message.includes('fetch failed')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
