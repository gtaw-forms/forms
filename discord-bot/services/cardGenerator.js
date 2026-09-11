import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────
// Canonical layout — ported from the website
// (PHMC Tools Business Card, src/components/
// UI/BusinessCard.jsx `overlayStyles`).
//
// The website draws on a 750x440 canvas with
// textBaseline='top'. Positions below are %
// of card width/height and font sizes are px
// at the 750px reference width, so they scale
// to any template size. Do NOT hand-tune px
// values here — fix the website first, then
// mirror the percentages.
// ──────────────────────────────────────────
const REFERENCE_WIDTH = 750;

const LAYOUT = {
    name: {
        leftPct: 2.75,
        topPct: 23.44,
        fontSize: 35,
        color: '#000000',
    },
    rank: {
        leftPct: 3.31,
        topPct: 31.92,
        fontSize: 15,
        color: '#cb1212',
    },
    phoneNumber: {
        // Website says 52.77%, but that renders ~22px (at 1200px height)
        // above the phone icon's center: canvas textBaseline='top' != SVG
        // hanging baseline. +1.83pp centers the ink on the icon.
        leftPct: 12.56,
        topPct: 54.60,
        fontSize: 15,
        color: '#000000',
    },
};

const FONT_FAMILY = 'LufgaMedium, Arial, Helvetica, sans-serif';

// LufgaMedium bundled alongside the template so the bot renders the same
// typeface as the website (VPS has no Lufga installed; Arial is fallback).
let cachedFontCss = null;
function getFontCss() {
    if (cachedFontCss !== null) return cachedFontCss;
    const fontPath = resolve(__dirname, '..', 'templates', 'LufgaMedium.ttf');
    if (existsSync(fontPath)) {
        const b64 = readFileSync(fontPath).toString('base64');
        cachedFontCss =
            `@font-face { font-family: 'LufgaMedium'; ` +
            `src: url(data:font/ttf;base64,${b64}) format('truetype'); }`;
    } else {
        console.warn('[CARD] [WARN] LufgaMedium.ttf not found — falling back to Arial.');
        cachedFontCss = '';
    }
    return cachedFontCss;
}

/**
 * Generate a business card image by overlaying text on a template.
 * Layout mirrors the PHMC Tools website canvas exactly.
 * @param {string} characterName - Character name to render
 * @param {string} rank - Rank/title to render
 * @param {string} [phoneNumber] - Phone number to render (optional)
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generateBusinessCard(characterName, rank, phoneNumber = '') {
    const templatePath = resolve(process.cwd(), 'templates', 'business-card.png');

    if (!existsSync(templatePath)) {
        throw new Error(
            `Template not found at ${templatePath}. ` +
            'Place a business-card.png in the templates/ directory.'
        );
    }

    console.log(`[CARD] Loading template: ${templatePath}`);
    const template = readFileSync(templatePath);
    const metadata = await sharp(template).metadata();

    const width = metadata.width || 2100;
    const height = metadata.height || 1200;
    const scale = width / REFERENCE_WIDTH;

    // Escape XML special characters for SVG
    const escapeXml = (str) =>
        String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

    const field = (key, value) => {
        const spec = LAYOUT[key];
        const x = (width * spec.leftPct) / 100;
        // Match canvas textBaseline='top': SVG hanging baseline ~= top edge.
        const y = (height * spec.topPct) / 100;
        const fontSize = spec.fontSize * scale;
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
            `font-family="${FONT_FAMILY}" font-size="${fontSize.toFixed(1)}px" ` +
            `fill="${spec.color}" dominant-baseline="hanging">${escapeXml(value)}</text>`;
    };

    // Build SVG overlay with text
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
        `<style>${getFontCss()} text { white-space: pre; }</style>` +
        field('name', characterName) +
        field('rank', rank) +
        (phoneNumber ? field('phoneNumber', phoneNumber) : '') +
        `</svg>`;

    console.log(`[CARD] Generating card: "${characterName}" / "${rank}" / "${phoneNumber}"`);

    const result = await sharp(template)
        .composite([
            {
                input: Buffer.from(svg),
                top: 0,
                left: 0,
            },
        ])
        .png()
        .toBuffer();

    console.log(`[CARD] Card generated (${(result.length / 1024).toFixed(1)} KB)`);
    return result;
}

/**
 * Upload a rendered card buffer for a shareable URL, routed through the
 * uploadImageProxy Cloud Function (Google Cloud egress) using ImgBB —
 * proven working end-to-end (the earlier 103s were a degenerate 1px probe
 * image, not an account/network block). Fail-open: returns null on any
 * error — callers must still deliver the native attachment.
 *
 * @param {Buffer} buffer — PNG bytes
 * @returns {Promise<string|null>} public URL or null
 */
export async function uploadCardImage(buffer) {
    const { uploadViaProxy } = await import('./imageProxy.js');
    const url = await uploadViaProxy(buffer, 'imgbb');
    if (!url) console.warn('[CARD] No shareable URL — native attachment only');
    return url;
}
