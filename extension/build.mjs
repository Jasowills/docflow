import { cpSync, copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, 'src');
const compiledDir = join(__dirname, 'dist');
const outputDirName = process.env.EXTENSION_OUTPUT_DIR || 'dist';
const dist = join(__dirname, outputDirName);

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

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

const srcStaticDir = join(src, 'static');
const distStaticDir = join(dist, 'static');
if (!existsSync(distStaticDir)) mkdirSync(distStaticDir, { recursive: true });
if (existsSync(srcStaticDir)) {
  cpSync(srcStaticDir, distStaticDir, { recursive: true });
}

const srcIconsDir = join(src, 'icons');
const distIconsDir = join(dist, 'icons');
if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true });
if (existsSync(srcIconsDir)) {
  cpSync(srcIconsDir, distIconsDir, { recursive: true });
}

const docflowMarkSvg = join(__dirname, '..', 'client', 'src', 'assets', 'docflow-mark.svg');
if (existsSync(docflowMarkSvg)) {
  cpSync(docflowMarkSvg, join(distIconsDir, 'docflow-mark.svg'));
}

if (outputDirName !== 'dist' && existsSync(compiledDir)) {
  const compiledFiles = readdirSync(compiledDir).filter(
    (name) => name.endsWith('.js') || name.endsWith('.js.map'),
  );
  for (const fileName of compiledFiles) {
    copyFileSync(join(compiledDir, fileName), join(dist, fileName));
  }
}

console.log(`Extension build assets copied to ${outputDirName}/`);
