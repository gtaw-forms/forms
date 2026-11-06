#!/usr/bin/env node
/**
 * tools/verify-upload-proxy.mjs — authenticated smoke test for uploadImageProxy.
 *
 * Mints a Firebase custom token the way the Discord bot does, exchanges it for
 * an ID token, then calls the deployed callable with:
 *   1. a generated PNG            -> expect 200 + an imglink.cc URL
 *   2. a non-image payload        -> expect 400 (format guard)
 *   3. no Authorization header    -> expect 401 (auth guard)
 *
 * Usage:
 *   node tools/verify-upload-proxy.mjs              # leave the uploaded probe
 *   IMGLINK_API_KEY=… node tools/verify-upload-proxy.mjs --cleanup
 *
 * --cleanup deletes the probe image from the ImgLink account afterwards.
 * The key is read from the environment and never printed.
 *
 * Requires firebase-admin-key.json at the repo root (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gtaw-forms';
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyD8HnchqbNsvcAs1PRvi6xCFXlMZUof9Ok';
const FUNCTION_URL = `https://europe-west4-${PROJECT_ID}.cloudfunctions.net/uploadImageProxy`;
const CLEANUP = process.argv.includes('--cleanup');
const IMGLINK_API_KEY = process.env.IMGLINK_API_KEY || '';

function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = (crc ^ buf[n]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

/** Valid PNG (their thumbnailer rejects degenerate 1x1 probes). */
function makePng(width, height) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc((width * 3 + 1) * height);
    let o = 0;
    for (let y = 0; y < height; y++) {
        raw[o++] = 0;
        for (let x = 0; x < width; x++) {
            raw[o++] = (x * 255 / width) | 0;
            raw[o++] = (y * 255 / height) | 0;
            raw[o++] = 128;
        }
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

async function idToken() {
    const keyPath = path.join(ROOT, 'firebase-admin-key.json');
    if (!fs.existsSync(keyPath)) {
        throw new Error(`Missing ${keyPath} — needed to mint a custom token.`);
    }
    const adminRoot = `file:///${path.join(ROOT, 'functions', 'node_modules', 'firebase-admin', 'lib').replace(/\\/g, '/')}`;
    const { initializeApp, cert } = await import(`${adminRoot}/index.js`);
    const { getAuth } = await import(`${adminRoot}/auth/index.js`);
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
    const custom = await getAuth().createCustomToken('phmc-bot');
    const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: custom, returnSecureToken: true }),
            signal: AbortSignal.timeout(15000),
        }
    );
    if (!res.ok) throw new Error(`token exchange HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.idToken) throw new Error('token exchange returned no idToken');
    return data.idToken;
}

async function call(token, image) {
    const t0 = Date.now();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: { image } }),
        signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { status: res.status, ms: Date.now() - t0, body, text };
}

const token = await idToken();
let failures = 0;

const png = makePng(240, 120).toString('base64');
const ok = await call(token, png);
const result = ok.body?.result;
const isImglink = typeof result?.url === 'string' && result.url.includes('imglink.cc/cdn/');
console.log(`[1] valid PNG        -> ${ok.status} in ${ok.ms}ms | success=${result?.success} url=${result?.url || '-'} album-filed=${isImglink}`);
if (ok.status !== 200 || !result?.success || !isImglink) failures += 1;

const bad = await call(token, Buffer.from('definitely not an image').toString('base64'));
const badMsg = bad.body?.error?.message || '';
console.log(`[2] non-image        -> ${bad.status} | ${badMsg}`);
if (bad.status !== 400) failures += 1;

const unauth = await call(null, png);
console.log(`[3] no auth          -> ${unauth.status}`);
if (unauth.status !== 401) failures += 1;

if (result?.id && CLEANUP) {
    if (!IMGLINK_API_KEY) {
        console.warn('[cleanup] IMGLINK_API_KEY not set — probe image left on the account.');
    } else {
        const del = await fetch(`https://imglink.cc/api/v1/image/${result.id}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': IMGLINK_API_KEY },
        });
        console.log(`[cleanup] delete     -> ${del.status}`);
        if (!del.ok) failures += 1;
    }
} else if (result?.id) {
    console.log(`[cleanup] skipped (pass --cleanup with IMGLINK_API_KEY to delete ${result.id})`);
}

console.log(failures === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${failures} check(s))`);
process.exit(failures === 0 ? 0 : 1);
