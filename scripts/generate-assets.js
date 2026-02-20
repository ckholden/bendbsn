/**
 * BendBSN Logo Asset Generator
 * Crops source PNG and exports all required icon sizes.
 * Run: node scripts/generate-assets.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = 'C:/Users/Christian/Downloads/ChatGPT Image Feb 19, 2026, 10_06_57 PM.png';
const REPO = path.resolve(__dirname, '..');
const ICONS = path.join(REPO, 'icons');

fs.mkdirSync(ICONS, { recursive: true });

// Crop coordinates (in 1536×1024 source image)
// Full horizontal logo (shield icon + text)
const LOGO_CROP   = { left: 310, top: 298, width: 896, height: 370 };
// Icon only (shield + cap, square-ish)
const ICON_CROP   = { left: 310, top: 298, width: 226, height: 370 };

async function run() {
    // ---- Full logo.png (for site header) ----
    await sharp(SRC)
        .extract(LOGO_CROP)
        .png()
        .toFile(path.join(REPO, 'logo.png'));
    console.log('✓ logo.png');

    // ---- Icon base buffer (high-res, then resize down) ----
    const iconBuf = await sharp(SRC)
        .extract(ICON_CROP)
        // Pad to square so favicon is centered
        .resize(512, 512, { fit: 'contain', background: { r:255,g:255,b:255,alpha:1 } })
        .png()
        .toBuffer();
    console.log('✓ icon base (512px)');

    // android-chrome-512x512
    await sharp(iconBuf).resize(512, 512).toFile(path.join(REPO, 'android-chrome-512x512.png'));
    console.log('✓ android-chrome-512x512.png');

    // android-chrome-192x192
    await sharp(iconBuf).resize(192, 192).toFile(path.join(REPO, 'android-chrome-192x192.png'));
    console.log('✓ android-chrome-192x192.png');

    // apple-touch-icon 180x180
    await sharp(iconBuf).resize(180, 180).toFile(path.join(REPO, 'apple-touch-icon.png'));
    console.log('✓ apple-touch-icon.png');

    // favicon-32x32
    await sharp(iconBuf).resize(32, 32).toFile(path.join(REPO, 'favicon-32x32.png'));
    console.log('✓ favicon-32x32.png');

    // favicon-16x16
    await sharp(iconBuf).resize(16, 16).toFile(path.join(REPO, 'favicon-16x16.png'));
    console.log('✓ favicon-16x16.png');

    // icons/ dir copies (for existing PWA manifest references)
    await sharp(iconBuf).resize(192, 192).toFile(path.join(ICONS, 'icon-192.png'));
    await sharp(iconBuf).resize(512, 512).toFile(path.join(ICONS, 'icon-512.png'));
    console.log('✓ icons/icon-192.png, icons/icon-512.png');

    console.log('\nAll assets generated.');
}

run().catch(err => { console.error(err); process.exit(1); });
