// Minimal FB API test — posts "test" to the death-records page and prints who posted it.
// Usage:  node debug-testing-scripts/face-post-test.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(dir, '..', '.env'), 'utf-8').split('\n')) {
    const m = line.trim().match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim();
}

const BASE = 'https://face.gta.world/api/v1/page-api';
const res = await fetch(`${BASE}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.FACE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_id: Number(process.env.FACE_PAGE_ID), content: 'test' }),
});
const body = await res.json().catch(() => res.text());
console.log('HTTP', res.status, res.ok ? 'OK' : 'FAIL');

const p = body.post || body.data || body;
console.log('post id     :', p.id);
console.log('content     :', p.content);
console.log('author id   :', p.profile_id);
console.log('author      :', p.profile?.name || p.profile?.username || JSON.stringify(p.profile));
console.log('target page :', p.page_id, '-', p.page?.name || p.page?.username);
console.log('created     :', p.created_at);
console.log('post url    : https://face.gta.world/post/' + p.id);
if (!res.ok) console.log('response    :', JSON.stringify(body, null, 2));
