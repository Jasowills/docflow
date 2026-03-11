import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const schemaPath = resolve(rootDir, 'docs', 'supabase-schema.sql');
const rootEnvPath = resolve(rootDir, '.env');
const serverEnvPath = resolve(rootDir, 'server', '.env');

const env = {
  ...loadEnvFile(rootEnvPath),
  ...loadEnvFile(serverEnvPath),
  ...process.env,
};

const connectionString = env.SUPABASE_DB_URL;

if (!existsSync(schemaPath)) {
  console.error(`Schema file not found: ${schemaPath}`);
  process.exit(1);
}

if (!connectionString) {
  console.error(
    'SUPABASE_DB_URL is not set. Add it to .env or server/.env, then run npm run migrate:supabase.',
  );
  process.exit(1);
}

const sql = readFileSync(schemaPath, 'utf8');
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied Supabase schema from ${schemaPath}`);
} catch (error) {
  console.error('Failed to apply Supabase schema.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const content = readFileSync(path, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    result[key] = stripQuotes(value);
  }

  return result;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
