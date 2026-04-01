/**
 * One-time script to generate favicon assets and OG image from the official Talora assets in /img.
 * Run: cd apps/frontend && bun run scripts/generate-favicons.ts
 */
import sharp from "sharp";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const SOURCE = join(ROOT, "..", "..", "img", "negro.png");
const OG_LOGO = join(ROOT, "..", "..", "img", "logo.png");

async function generateIcons() {
  // 32x32 icon for Next.js file convention (auto-generates <link rel="icon">)
  await sharp(SOURCE)
    .resize(32, 32)
    .png()
    .toFile(join(ROOT, "src", "app", "icon.png"));
  console.log("Generated src/app/icon.png (32x32)");

  // 180x180 apple touch icon (auto-generates <link rel="apple-touch-icon">)
  await sharp(SOURCE)
    .resize(180, 180)
    .png()
    .toFile(join(ROOT, "src", "app", "apple-icon.png"));
  console.log("Generated src/app/apple-icon.png (180x180)");
}

async function generateOgImage() {
  const width = 1200;
  const height = 630;
  const bgColor = "#F8F9FC";

  const logoWidth = 420;
  const logoBuffer = await sharp(OG_LOGO)
    .resize({ width: logoWidth, fit: "inside" })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoHeight = logoMeta.height ?? 160;
  const resolvedLogoWidth = logoMeta.width ?? logoWidth;

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: bgColor,
    },
  })
    .composite([
      {
        input: logoBuffer,
        left: Math.round((width - resolvedLogoWidth) / 2),
        top: Math.round((height - logoHeight) / 2),
      },
    ])
    .png()
    .toFile(join(ROOT, "public", "og-image.png"));
  console.log("Generated public/og-image.png (1200x630)");
}

await generateIcons();
await generateOgImage();
console.log("Done!");
