/**
 * BendBSN brand assets (C High Desert).
 *
 * Builds every PNG, the favicon.ico and the shipped SVG copies from the
 * SVG sources in icons/src/. The skyline path in icons/src/mark.svg is
 * the one canonical drawing; the other sources derive from it.
 *
 *   icons/src/mark.svg      canonical mark (48-unit box)
 *   icons/src/mark-16.svg   16 px optical variant
 *   icons/src/favicon.svg   tab icon, adds a Snow ring on dark tabs
 *   icons/src/app-icon.svg  Juniper full-bleed tile, mark in the safe zone
 *   icons/src/og-image.svg  1200x630 share image (outlined text)
 *   logo.svg, logo-dark.svg wordmark lockups (outlined text)
 *
 * The outlined text comes from scripts/outline-wordmark.py; run that
 * first if the wordmark, the tagline or mark.svg changed.
 *
 * Run from the repo root: node scripts/generate-assets.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'icons', 'src');
const ICONS = path.join(REPO, 'icons');

const CANONICAL = 'M6 33 L13 26 L17 29 L24 17 L30 26 L34 22 L42 33';
const JUNIPER = '#2F6B5F';
const ANY_RADIUS = 26 / 120;   // corner radius of the "any" tiles, as on the identity board

const read = (file) => fs.readFileSync(file);
const rel = (file) => path.relative(REPO, file).split(path.sep).join('/');

function intrinsicWidth(svg) {
    const tag = svg.toString('utf8').match(/<svg\b[^>]*>/)[0];
    const w = tag.match(/\bwidth="([\d.]+)"/);
    if (w) return parseFloat(w[1]);
    return parseFloat(tag.match(/viewBox="[\d.\s-]*?([\d.]+)\s+[\d.]+"/)[1]);
}

// Rasterise an SVG straight at the target width, so small sizes are drawn
// at their own size instead of being shrunk from a big bitmap.
function raster(svg, width, height) {
    const density = 72 * width / intrinsicWidth(svg);
    return sharp(svg, { density }).resize(width, height || null, { fit: 'fill' });
}

async function png(pipeline, out, opaque) {
    if (opaque) pipeline = pipeline.flatten({ background: JUNIPER }).removeAlpha();
    await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(out);
    const m = await sharp(out).metadata();
    console.log(`  ${rel(out)}  ${m.width}x${m.height}  ${m.channels === 4 ? 'rgba' : 'rgb'}`);
}

// PNG-in-ICO: a 6-byte header, a 16-byte entry per image, then the PNGs.
function ico(pngs) {
    const head = Buffer.alloc(6 + 16 * pngs.length);
    head.writeUInt16LE(0, 0);
    head.writeUInt16LE(1, 2);
    head.writeUInt16LE(pngs.length, 4);
    let offset = head.length;
    pngs.forEach(({ size, data }, i) => {
        const e = 6 + 16 * i;
        head.writeUInt8(size >= 256 ? 0 : size, e);
        head.writeUInt8(size >= 256 ? 0 : size, e + 1);
        head.writeUInt8(0, e + 2);
        head.writeUInt8(0, e + 3);
        head.writeUInt16LE(1, e + 4);
        head.writeUInt16LE(32, e + 6);
        head.writeUInt32LE(data.length, e + 8);
        head.writeUInt32LE(offset, e + 12);
        offset += data.length;
    });
    return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

async function run() {
    const mark = read(path.join(SRC, 'mark.svg'));
    const mark16 = read(path.join(SRC, 'mark-16.svg'));
    const favicon = read(path.join(SRC, 'favicon.svg'));
    const tile = read(path.join(SRC, 'app-icon.svg'));
    const og = read(path.join(SRC, 'og-image.svg'));
    const logo = read(path.join(REPO, 'logo.svg'));

    // Every full-size drawing must carry the canonical skyline.
    for (const [name, buf] of [['mark.svg', mark], ['app-icon.svg', tile], ['og-image.svg', og],
                               ['logo.svg', logo], ['logo-dark.svg', read(path.join(REPO, 'logo-dark.svg'))]]) {
        if (!buf.toString('utf8').includes(CANONICAL)) throw new Error(`${name} lost the canonical skyline path`);
    }

    console.log('SVG copies');
    fs.writeFileSync(path.join(REPO, 'logo-mark.svg'), mark);
    console.log('  logo-mark.svg  (icons/src/mark.svg)');
    fs.writeFileSync(path.join(REPO, 'favicon.svg'), favicon);
    console.log('  favicon.svg  (icons/src/favicon.svg)');

    console.log('Favicons');
    await png(raster(mark16, 16, 16), path.join(REPO, 'favicon-16x16.png'));
    await png(raster(mark, 32, 32), path.join(REPO, 'favicon-32x32.png'));
    await png(raster(mark, 48, 48), path.join(REPO, 'favicon.png'));
    const icoBuf = ico([
        { size: 16, data: read(path.join(REPO, 'favicon-16x16.png')) },
        { size: 32, data: read(path.join(REPO, 'favicon-32x32.png')) },
    ]);
    fs.writeFileSync(path.join(REPO, 'favicon.ico'), icoBuf);
    console.log(`  favicon.ico  16+32  ${icoBuf.length} bytes`);

    console.log('Wordmark');
    await png(raster(logo, Math.round(intrinsicWidth(logo) / 48 * 128), 128), path.join(REPO, 'logo.png'));

    console.log('App icons');
    // apple-touch-icon: opaque full-bleed tile; iOS rounds the corners itself.
    await png(raster(tile, 180, 180), path.join(REPO, 'apple-touch-icon.png'), true);
    // Maskable: the full-bleed tile, mark inside the 80% safe zone.
    for (const s of [192, 512]) {
        await png(raster(tile, s, s), path.join(REPO, `android-chrome-${s}x${s}.png`), true);
    }
    // Purpose "any": the same tile with rounded, transparent corners.
    for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) {
        const r = Math.round(s * ANY_RADIUS * 100) / 100;
        const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${r}" fill="#fff"/></svg>`);
        const base = await raster(tile, s, s).png().toBuffer();
        await png(sharp(base).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]),
                  path.join(ICONS, `icon-${s}.png`));
    }

    console.log('Share image');
    await png(raster(og, 1200, 630), path.join(REPO, 'og-image.png'), true);

    console.log('\nAll assets generated.');
}

run().catch((err) => { console.error(err); process.exit(1); });
