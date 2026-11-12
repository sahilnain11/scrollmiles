import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Only reviewed, local-fixture screenshots are eligible for public docs.
// Do not point this at an owner's browser profile or personal activity.
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'test-results');
const destination = path.join(root, 'docs/images');
const screenshots = [
  { name: 'dashboard-dark', crop: true },
  { name: 'dashboard-light', crop: true },
  { name: 'popup-dark' },
  { name: 'wrapped-preview-dark' },
  { name: 'site-insights-dark' },
  { name: 'site-insights-light' },
];
const files = await readdir(source, { recursive: true });
const inputs = screenshots.map(({ name, crop }) => {
  const matches = files.filter((file) => path.basename(file) === `${name}.png`);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${name}.png in test-results. Build and run the complete browser suite first.`);
  }
  return { name, crop, input: path.join(source, matches[0]) };
});

await mkdir(destination, { recursive: true });
for (const { name, crop, input } of inputs) {
  const image = sharp(input);
  if (crop) {
    const { width, height } = await image.metadata();
    if (width !== 1440 || !height || height < 1200) {
      throw new Error(`Review the overview crop for ${name}; the screenshot dimensions changed.`);
    }
    // Remove outer margins/lower sections; retain the header, summary, chart
    // and Wrapped entry without altering any displayed numbers or UI.
    image.extract({ left: 144, top: 16, width: 1152, height: 1184 });
  }
  // Lossless compression preserves screenshot pixels; Sharp strips metadata
  // by default. These assets are docs only, not bundled extension resources.
  const result = await image.webp({ lossless: true, effort: 6 })
    .toFile(path.join(destination, `${name}.webp`));
  console.log(`${name}.webp: ${result.width} × ${result.height}, ${result.size} bytes`);
}