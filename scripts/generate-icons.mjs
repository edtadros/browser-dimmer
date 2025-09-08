import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ICON_BG = '#202121';
const ICON_FG = '#a8a9a9';
const SIZES = [16, 32, 48, 128];
const PAD_RATIO = 0.06; // 6% padding around the SVG (larger icon)

async function main() {
  const root = path.resolve(process.cwd());
  const svgPath = path.join(root, 'icons', 'backlight.svg');
  const outDir = path.join(root, 'icons', 'generated');
  await fs.mkdir(outDir, { recursive: true });

  let svgText = await fs.readFile(svgPath, 'utf8');
  // Force monochrome
  svgText = svgText
    .replace(/stroke="#?[0-9a-fA-F]{3,6}"/g, `stroke="${ICON_FG}"`)
    .replace(/fill="#?[0-9a-fA-F]{3,6}"/g, (m) => (m.includes('none') ? m : `fill="${ICON_FG}"`));

  for (const size of SIZES) {
    const pad = Math.floor(size * PAD_RATIO);
    const contentSize = size - pad * 2;

    const svgPng = await sharp(Buffer.from(svgText))
      .resize({ width: contentSize, height: contentSize, fit: 'inside' })
      .png()
      .toBuffer();

    const bg = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: ICON_BG,
      },
    }).png();

    const composite = await bg
      .composite([{ input: svgPng, left: pad, top: pad }])
      .toBuffer();

    const outFile = path.join(outDir, `icon${size}.png`);
    await fs.writeFile(outFile, composite);
    console.log('Wrote', path.relative(root, outFile));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
