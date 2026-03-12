import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
const MANIFEST_PATH = path.resolve(process.cwd(), 'src', 'manifest.json');
const IS_WINDOWS = process.platform === 'win32';

async function main() {
  const originalPackageRaw = await fs.readFile(PACKAGE_JSON_PATH, 'utf8');
  const originalManifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');

  try {
    await runStep('node', ['bump-version.mjs']);
    await runStep('tsc', []);
    await runStep('node', ['build.mjs'], {
      EXTENSION_OUTPUT_DIR: process.env.EXTENSION_OUTPUT_DIR || 'DocFlow-recorder',
    });
    await runStep('node', ['publish.mjs']);
  } catch (error) {
    await fs.writeFile(PACKAGE_JSON_PATH, originalPackageRaw, 'utf8');
    await fs.writeFile(MANIFEST_PATH, originalManifestRaw, 'utf8');
    console.error('Extension publish failed. Version files were restored.');
    throw error;
  }
}

function runStep(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const executable = IS_WINDOWS && command === 'tsc' ? 'tsc.cmd' : command;
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...extraEnv,
      },
      shell: false,
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
