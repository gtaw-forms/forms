import { describe, it, expect } from 'vitest';
import { sniffImageType } from '../functions/src/utils/imageType.js';

const bytes = (...parts) => Buffer.from(parts.flat());

describe('sniffImageType', () => {
    it('detects PNG', () => {
        expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0]))).toEqual({
            mime: 'image/png', ext: 'png',
        });
    });

    it('detects JPEG', () => {
        expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0], [0, 0]))).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    });

    it('detects GIF87a and GIF89a', () => {
        expect(sniffImageType(Buffer.from('GIF87a....', 'latin1'))).toEqual({ mime: 'image/gif', ext: 'gif' });
        expect(sniffImageType(Buffer.from('GIF89a....', 'latin1'))).toEqual({ mime: 'image/gif', ext: 'gif' });
    });

    it('detects WebP only with the WEBP marker', () => {
        expect(sniffImageType(Buffer.from('RIFF1234WEBPVP8 ', 'latin1'))).toEqual({ mime: 'image/webp', ext: 'webp' });
        expect(sniffImageType(Buffer.from('RIFF1234WAVEfmt ', 'latin1'))).toBeNull();
    });

    it('detects BMP, TIFF and ICO', () => {
        expect(sniffImageType(Buffer.from('BM....', 'latin1'))).toEqual({ mime: 'image/bmp', ext: 'bmp' });
        expect(sniffImageType(bytes([0x49, 0x49, 0x2a, 0x00]))).toEqual({ mime: 'image/tiff', ext: 'tiff' });
        expect(sniffImageType(bytes([0x4d, 0x4d, 0x00, 0x2a]))).toEqual({ mime: 'image/tiff', ext: 'tiff' });
        expect(sniffImageType(bytes([0x00, 0x00, 0x01, 0x00]))).toEqual({ mime: 'image/x-icon', ext: 'ico' });
    });

    it('detects AVIF from the ftyp brand', () => {
        expect(sniffImageType(Buffer.from('....ftypavif....', 'latin1'))).toEqual({ mime: 'image/avif', ext: 'avif' });
        expect(sniffImageType(Buffer.from('....ftypmp42....', 'latin1'))).toBeNull();
    });

    it('detects SVG with a prolog or comment before the root', () => {
        expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toEqual({
            mime: 'image/svg+xml', ext: 'svg',
        });
        expect(sniffImageType(Buffer.from('<?xml version="1.0"?>\n<svg></svg>'))).toEqual({
            mime: 'image/svg+xml', ext: 'svg',
        });
        expect(sniffImageType(Buffer.from('<!-- x --><svg></svg>'))).toEqual({
            mime: 'image/svg+xml', ext: 'svg',
        });
    });

    it('rejects non-image payloads', () => {
        expect(sniffImageType(Buffer.from('%PDF-1.7'))).toBeNull();
        expect(sniffImageType(Buffer.from('hello world'))).toBeNull();
        expect(sniffImageType(Buffer.alloc(0))).toBeNull();
        expect(sniffImageType(null)).toBeNull();
    });
});
