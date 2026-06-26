import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import sharp from 'sharp';

// ──────────────────────────────────────────
// Text positioning — adjust these to match
// your template image
// ──────────────────────────────────────────
const TEXT_POSITIONS = {
    name: {
        x: 200,
        y: 450,
        fontSize: 100,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontWeight: 'bold',
        color: '#000000',
        maxWidth: 350,
    },
    rank: {
        x: 200,
        y: 350,
        fontSize: 75,
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontWeight: 'normal',
        color: '#555555',
        maxWidth: 350,
    },
};

/**
 * Generate a business card image by overlaying text on a template.
 * @param {string} characterName - Character name to render
 * @param {string} rank - Rank/title to render
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generateBusinessCard(characterName, rank) {
    const templatePath = resolve(process.cwd(), 'templates', 'business-card.png');

    if (!existsSync(templatePath)) {
        throw new Error(
            `Template not found at ${templatePath}. ` +
            'Place a business-card.png in the templates/ directory.'
        );
    }

    console.log(`[CARD] 📄 Loading template: ${templatePath}`);
    const template = readFileSync(templatePath);
    const metadata = await sharp(template).metadata();

    const width = metadata.width || 600;
    const height = metadata.height || 350;

    // Escape XML special characters for SVG
    const escapeXml = (str) =>
        String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

    const nameSafe = escapeXml(characterName);
    const rankSafe = escapeXml(rank);

    // Build SVG overlay with text
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text
            x="${TEXT_POSITIONS.name.x}"
            y="${TEXT_POSITIONS.name.y}"
            font-family="${TEXT_POSITIONS.name.fontFamily}"
            font-size="${TEXT_POSITIONS.name.fontSize}px"
            font-weight="${TEXT_POSITIONS.name.fontWeight}"
            fill="${TEXT_POSITIONS.name.color}"
        >${nameSafe}</text>
        <text
            x="${TEXT_POSITIONS.rank.x}"
            y="${TEXT_POSITIONS.rank.y}"
            font-family="${TEXT_POSITIONS.rank.fontFamily}"
            font-size="${TEXT_POSITIONS.rank.fontSize}px"
            font-weight="${TEXT_POSITIONS.rank.fontWeight}"
            fill="${TEXT_POSITIONS.rank.color}"
        >${rankSafe}</text>
    </svg>`;

    console.log(`[CARD] 🎨 Generating card: "${characterName}" / "${rank}"`);

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

    console.log(`[CARD] ✅ Card generated (${(result.length / 1024).toFixed(1)} KB)`);
    return result;
}
