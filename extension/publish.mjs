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
    const value = line.slice(eq + 1).trim();
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
      // optional fallback
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

  const apiBaseUrl = process.env.DOC_STUDIO_API_BASE_URL;
  const publishKey = process.env.EXTENSION_PUBLISH_KEY;
  const notes = process.env.EXTENSION_RELEASE_NOTES;
  const containerSasUrl = process.env.AZURE_BLOB_SAS_URL;
  const outputDirName = process.env.EXTENSION_OUTPUT_DIR || 'DocFlow-recorder';

  if (!apiBaseUrl) {
    throw new Error('DOC_STUDIO_API_BASE_URL is required');
  }
  if (!publishKey) {
    throw new Error('EXTENSION_PUBLISH_KEY is required');
  }
  if (!containerSasUrl) {
    throw new Error('AZURE_BLOB_SAS_URL is required');
  }

  const artifactDir = path.resolve(process.cwd(), outputDirName);
  const zipFileName = `DocFlow-recorder-v${version}.zip`;
  const zipPath = path.resolve(process.cwd(), zipFileName);
  await createZipFromDir(artifactDir, zipPath);

  const containerClient = new ContainerClient(containerSasUrl);
  const blobName = `docflow-recorder/${version}/${zipFileName}`;
  const blobClient = containerClient.getBlockBlobClient(blobName);

  await blobClient.uploadFile(zipPath, {
    blobHTTPHeaders: {
      blobContentType: 'application/zip',
      blobContentDisposition: `attachment; filename="${zipFileName}"`,
    },
  });

  const downloadUrl = blobClient.url;

  const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/extensions/releases/publish`;
  const body = {
    version,
    downloadUrl,
    notes: notes || undefined,
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-extension-publish-key': publishKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const cause = error && typeof error === 'object' ? error.cause : null;
    const code = cause && typeof cause === 'object' ? cause.code : undefined;
    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Publish endpoint unreachable (${endpoint}). Start the DocFlow API or set DOC_STUDIO_API_BASE_URL to a reachable host.`,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
