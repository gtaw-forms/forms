import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallable } = vi.hoisted(() => ({ mockCallable: vi.fn() }));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallableFromURL: vi.fn(() => mockCallable),
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const { uploadImageToImgLink, uploadDataUrlToImgLink } = await import('../src/utils/imageUploadUtils');

const makeFile = (size = 16, name = 'xray.png') =>
    new File([new Uint8Array(size)], name, { type: 'image/png' });

describe('imageUploadUtils (ImgLink proxy)', () => {
    beforeEach(() => {
        mockCallable.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('returns the ImgLink url/thumb/viewer from the proxy', async () => {
        mockCallable.mockResolvedValue({
            data: {
                success: true,
                url: 'https://imglink.cc/cdn/abc123.png',
                thumb: 'https://imglink.cc/cdn/medium/abc123.webp',
                viewer: 'https://imglink.cc/i/abc123',
            },
        });

        const result = await uploadImageToImgLink(makeFile());

        expect(result).toEqual({
            url: 'https://imglink.cc/cdn/abc123.png',
            thumb: 'https://imglink.cc/cdn/medium/abc123.webp',
            viewer: 'https://imglink.cc/i/abc123',
        });
        expect(mockCallable).toHaveBeenCalledTimes(1);
        const payload = mockCallable.mock.calls[0][0];
        expect(typeof payload.image).toBe('string');
        expect(payload.image.length).toBeGreaterThan(0);
        // The proxy ignores service; the client must not send host credentials.
        expect(payload.service).toBeUndefined();
    });

    it('falls back to the full url when no thumbnail is returned', async () => {
        mockCallable.mockResolvedValue({ data: { success: true, url: 'https://imglink.cc/cdn/abc123.png' } });
        await expect(uploadImageToImgLink(makeFile())).resolves.toEqual({
            url: 'https://imglink.cc/cdn/abc123.png',
            thumb: 'https://imglink.cc/cdn/abc123.png',
            viewer: null,
        });
    });

    it('rejects oversized files before calling the proxy', async () => {
        await expect(uploadImageToImgLink(makeFile(5 * 1024 * 1024 + 1)))
            .rejects.toThrow(/too large/i);
        expect(mockCallable).not.toHaveBeenCalled();
    });

    it('surfaces proxy errors (e.g. the hourly limit) to the caller', async () => {
        mockCallable.mockRejectedValue(new Error("The image host's hourly upload limit has been reached."));
        await expect(uploadImageToImgLink(makeFile()))
            .rejects.toThrow(/hourly upload limit/i);
    });

    it('treats a success response without a url as a failure', async () => {
        mockCallable.mockResolvedValue({ data: { success: false, error: 'storage limit reached' } });
        await expect(uploadImageToImgLink(makeFile())).rejects.toThrow(/storage limit reached/i);
    });

    it('uploads a data URL and strips the prefix', async () => {
        mockCallable.mockResolvedValue({ data: { success: true, url: 'https://imglink.cc/cdn/card.png' } });
        const dataUrl = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;

        const result = await uploadDataUrlToImgLink(dataUrl);

        expect(result.url).toBe('https://imglink.cc/cdn/card.png');
        expect(mockCallable.mock.calls[0][0].image).toBe(Buffer.from('fake-png-bytes').toString('base64'));
    });

    it('rejects a non-data-URL string', async () => {
        await expect(uploadDataUrlToImgLink('not-a-data-url')).rejects.toThrow(/valid data URL/i);
        expect(mockCallable).not.toHaveBeenCalled();
    });
});
