const sharp = require('sharp');
const path = require('path');

// Create a simple calendar icon as SVG
const createCalendarSvg = (size) => {
  const scale = size / 512;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${96 * scale}" fill="#3b82f6"/>
      <g transform="scale(${scale})">
        <path d="M144 96V144M368 96V144M120 232H392M120 416H392C415.196 416 432 399.196 432 376V144C432 120.804 415.196 104 392 104H120C96.804 104 80 120.804 80 144V376C80 399.196 96.804 416 120 416Z"
              stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
    </svg>
  `);
};

async function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');

  // Generate 192x192 icon
  await sharp(createCalendarSvg(192))
    .png()
    .toFile(path.join(iconsDir, 'icon-192x192.png'));
  console.log('Created icon-192x192.png');

  // Generate 512x512 icon
  await sharp(createCalendarSvg(512))
    .png()
    .toFile(path.join(iconsDir, 'icon-512x512.png'));
  console.log('Created icon-512x512.png');

  // Generate apple-touch-icon (180x180)
  await sharp(createCalendarSvg(180))
    .png()
    .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
