/**
 * One-time script to generate favicon assets and OG image from talora-icon.png.
 * Run: cd apps/frontend && bun run scripts/generate-favicons.ts
 */
import sharp from "sharp";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const SOURCE = join(ROOT, "public", "talora-icon.png");

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
  const bgColor = "#022c22"; // emerald-950

  // Use transparent logo for OG image (no square background)
  const transparentLogo = join(ROOT, "public", "talora-logo-transparent.png");
  const logoHeight = 300;
  const logoBuffer = await sharp(transparentLogo)
    .resize({ height: logoHeight, fit: "inside" })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const logoWidth = logoMeta.width ?? logoHeight;

  // Create OG image: branded background with centered transparent logo
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
        left: Math.round((width - logoWidth) / 2),
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
