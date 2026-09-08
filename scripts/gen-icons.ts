/**
 * Render the Compass mark to the PNG icons the PWA manifest needs.
 *
 *   npm run gen:icons
 *
 * Source of truth for the mark is the inline SVG in web/src/App.tsx. Outputs to
 * web/public/. Re-run if the mark or brand colour changes.
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../web/public/", import.meta.url));
const TEAL = "#028090";
const leaf = "M15 3 L18 11 L26 9 L20 15 L26 21 L18 19 L15 27 L12 19 L4 21 L10 15 L4 9 L12 11 Z";

/** `pad` is the fraction of the canvas left as margin around the 30×30 mark. */
function svg(size: number, pad: number, bg: string | null): string {
  const inner = size * (1 - pad * 2);
  const scale = inner / 30;
  const off = size * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${bg}"/>` : ""}
  <g transform="translate(${off} ${off}) scale(${scale})">
    <path d="${leaf}" fill="${bg ? "#fff" : TEAL}"/>
    <circle cx="15" cy="15" r="2.4" fill="${bg ?? "#fff"}" stroke="${bg ? "#fff" : TEAL}" stroke-width="1.3"/>
  </g>
</svg>`;
}

const jobs: [string, string][] = [
  ["icon-192.png", svg(192, 0.14, TEAL)],
  ["icon-512.png", svg(512, 0.14, TEAL)],
  ["icon-maskable-512.png", svg(512, 0.26, TEAL)], // extra margin for the maskable safe zone
  ["apple-touch-icon.png", svg(180, 0.12, TEAL)],
  ["favicon-32.png", svg(32, 0.08, TEAL)],
];

for (const [name, s] of jobs) {
  await sharp(Buffer.from(s)).png().toFile(OUT + name);
  console.log("wrote", name);
}
