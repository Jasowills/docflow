import fs from 'node:fs/promises';
import path from 'node:path';

const PACKAGE_JSON_PATH = path.resolve(process.cwd(), 'package.json');
const MANIFEST_PATH = path.resolve(process.cwd(), 'src', 'manifest.json');

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version);
  if (!match) {
    throw new Error(
      `Unsupported version format "${version}". Expected MAJOR.MINOR.PATCH.BUILD`,
    );
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    build: match[4] ? Number(match[4]) : 0,
  };
}

function bumpVersion(current, mode) {
  const next = { ...current };
  if (mode === 'major') {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
    next.build = 0;
    return next;
  }
  if (mode === 'minor') {
    next.minor += 1;
    next.patch = 0;
    next.build = 0;
    return next;
  }
  if (mode === 'patch') {
    next.patch += 1;
    next.build = 0;
    return next;
  }
  next.build += 1;
  return next;
}

function toStringSemver(version) {
  return `${version.major}.${version.minor}.${version.patch}.${version.build}`;
}

async function main() {
  if (process.env.EXTENSION_SKIP_VERSION_BUMP === '1') {
    console.log('Skipping extension version bump (EXTENSION_SKIP_VERSION_BUMP=1).');
    return;
  }

  const packageRaw = await fs.readFile(PACKAGE_JSON_PATH, 'utf8');
  const manifestRaw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const packageJson = JSON.parse(packageRaw);
  const manifestJson = JSON.parse(manifestRaw);

  const currentVersion = String(packageJson.version || '').trim();
  const explicitVersion = String(process.env.EXTENSION_RELEASE_VERSION || '').trim();
  const bumpMode = String(process.env.EXTENSION_VERSION_BUMP || 'build').trim().toLowerCase();
  if (!['major', 'minor', 'patch', 'build'].includes(bumpMode)) {
    throw new Error(
      `Invalid EXTENSION_VERSION_BUMP "${bumpMode}". Use one of: major, minor, patch, build`,
    );
  }

  let nextVersion = explicitVersion;
  if (!nextVersion) {
    const parsed = parseSemver(currentVersion);
    nextVersion = toStringSemver(bumpVersion(parsed, bumpMode));
  } else {
    parseSemver(nextVersion);
  }

  packageJson.version = nextVersion;
  manifestJson.version = nextVersion;

  await fs.writeFile(PACKAGE_JSON_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifestJson, null, 2)}\n`, 'utf8');

  console.log(`Extension version bumped: ${currentVersion} -> ${nextVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
