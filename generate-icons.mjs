// Génère les icônes PNG PWA à partir du logo SVG
// Usage: node generate-icons.mjs

import { readFileSync, writeFileSync } from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

const svgRaw = readFileSync(resolve(__dir, 'public/logo.svg'), 'utf8');
// canvas needs explicit width/height on the root svg element
const svgContent = svgRaw.replace('<svg ', '<svg width="512" height="512" ');
const svgUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = await loadImage(svgUrl);
  ctx.drawImage(img, 0, 0, size, size);
  const buf = canvas.toBuffer('image/png');
  writeFileSync(resolve(__dir, `public/icons/icon-${size}.png`), buf);
  console.log(`✓ icon-${size}.png`);
}
console.log('Icons generated.');
