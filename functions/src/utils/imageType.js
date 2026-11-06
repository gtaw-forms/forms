/**
 * imageType.js — identify an image from its bytes.
 *
 * The upload proxy receives base64 with no filename or content type, but
 * ImgLink needs a file part that matches the actual bytes (it validates and
 * re-encodes the image). Sniffing the magic bytes lets us send the right
 * filename extension and MIME type instead of guessing "png" for everything.
 *
 * Dependency-free on purpose: unit-tested from the repo root test suite.
 */

/** @typedef {{ mime: string, ext: string }} ImageType */

const startsWith = (buf, bytes, offset = 0) => {
    if (buf.length < offset + bytes.length) return false;
    for (let i = 0; i < bytes.length; i += 1) {
        if (buf[offset + i] !== bytes[i]) return false;
    }
    return true;
};

const ascii = (buf, offset, length) => {
    if (buf.length < offset + length) return '';
    return buf.subarray(offset, offset + length).toString('latin1');
};

/**
 * Detect a supported image type from the first bytes of a buffer.
 *
 * Supported by ImgLink: JPG, PNG, GIF, WebP, SVG, BMP, ICO, TIFF, AVIF.
 *
 * @param {Buffer|Uint8Array} input
 * @returns {ImageType|null} null when the bytes are not a recognised image
 */
export function sniffImageType(input) {
    if (!input || typeof input.length !== 'number' || input.length < 4) return null;
    const buf = input;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { mime: 'image/png', ext: 'png' };
    }
    // JPEG: FF D8 FF
    if (startsWith(buf, [0xff, 0xd8, 0xff])) {
        return { mime: 'image/jpeg', ext: 'jpg' };
    }
    // GIF: "GIF87a" / "GIF89a"
    if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') {
        return { mime: 'image/gif', ext: 'gif' };
    }
    // WebP: "RIFF" .... "WEBP"
    if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') {
        return { mime: 'image/webp', ext: 'webp' };
    }
    // BMP: "BM"
    if (ascii(buf, 0, 2) === 'BM') {
        return { mime: 'image/bmp', ext: 'bmp' };
    }
    // TIFF: little-endian "II*\0" or big-endian "MM\0*"
    if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) {
        return { mime: 'image/tiff', ext: 'tiff' };
    }
    // ICO: 00 00 01 00
    if (startsWith(buf, [0x00, 0x00, 0x01, 0x00])) {
        return { mime: 'image/x-icon', ext: 'ico' };
    }
    // AVIF: ISO-BMFF "ftyp" with an "avif"/"avis" brand
    if (ascii(buf, 4, 4) === 'ftyp') {
        const brand = ascii(buf, 8, 4);
        if (brand === 'avif' || brand === 'avis') {
            return { mime: 'image/avif', ext: 'avif' };
        }
    }
    // SVG: text document containing an <svg root (allow BOM/XML prolog/comments)
    const head = ascii(buf, 0, Math.min(buf.length, 1024)).trimStart();
    if (head.startsWith('<') && /<svg[\s>]/i.test(head)) {
        return { mime: 'image/svg+xml', ext: 'svg' };
    }

    return null;
}

export default sniffImageType;
