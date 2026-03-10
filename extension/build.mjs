/**
 * Simple build script for the extension.
 * Copies manifest.json, popup.html, compiled JS, and icons to output dir.
 */
import { cpSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, 'src');
const compiledDir = join(__dirname, 'dist');
const outputDirName = process.env.EXTENSION_OUTPUT_DIR || 'dist';
const dist = join(__dirname, outputDirName);

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

// Copy static assets
cpSync(join(src, 'manifest.json'), join(dist, 'manifest.json'));
cpSync(join(src, 'popup.html'), join(dist, 'popup.html'));
if (existsSync(join(src, 'Inter-VariableFont_opsz,wght.ttf'))) {
  cpSync(
    join(src, 'Inter-VariableFont_opsz,wght.ttf'),
    join(dist, 'Inter-VariableFont_opsz,wght.ttf'),
  );
}
if (existsSync(join(src, 'Inter-Italic-VariableFont_opsz,wght.ttf'))) {
  cpSync(
    join(src, 'Inter-Italic-VariableFont_opsz,wght.ttf'),
    join(dist, 'Inter-Italic-VariableFont_opsz,wght.ttf'),
  );
}

// Copy static font assets directory when available
const srcStaticDir = join(src, 'static');
const distStaticDir = join(dist, 'static');
if (!existsSync(distStaticDir)) mkdirSync(distStaticDir, { recursive: true });
if (existsSync(srcStaticDir)) {
  cpSync(srcStaticDir, distStaticDir, { recursive: true });
}

// Copy icons directory when available
const srcIconsDir = join(src, 'icons');
const distIconsDir = join(dist, 'icons');
if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true });
if (existsSync(srcIconsDir)) {
  cpSync(srcIconsDir, distIconsDir, { recursive: true });
}

// When publishing to a non-default output folder, copy compiled JS bundles from dist/.
if (outputDirName !== 'dist' && existsSync(compiledDir)) {
  const compiledFiles = readdirSync(compiledDir).filter(
    (name) => name.endsWith('.js') || name.endsWith('.js.map'),
  );
  for (const fileName of compiledFiles) {
    copyFileSync(join(compiledDir, fileName), join(dist, fileName));
  }
}

console.log(`Extension build assets copied to ${outputDirName}/`);
