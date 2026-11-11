import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const source = new URL('../assets/brand/icon.svg', import.meta.url);
const destination = new URL('../public/icons/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(source.pathname, { density: 192 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(new URL(`${size}.png`, destination).pathname);
}
console.log('Generated ScrollMiles icons: 16, 32, 48, 128 px (local SVG source).');