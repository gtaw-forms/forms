// tests/template-drift.test.js
// Template drift guard: the golden suite renders PINNED fixture templates,
// but production renders the LIVE RTDB `forms` node. If someone edits a
// template in Firebase (or the fixture goes stale), goldens pass while prod
// diverges — exactly the raw-{{department}} incident. This test hashes the
// live template strings and compares against the fixtures.
//
// Opt-in by credentials: skips entirely without firebase-admin-key.json at
// the repo root (CI stays green without secrets). With the key present it
// FAILS on drift — re-pin the fixture deliberately and review the diff.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_PATH = path.join(__dirname, '..', 'firebase-admin-key.json');
const DATABASE_URL = 'https://gtaw-forms-default-rtdb.europe-west1.firebasedatabase.app';

const hasKey = fs.existsSync(KEY_PATH);
const itLive = hasKey ? it : it.skip;

const sha = (s) => createHash('sha256').update(String(s ?? ''), 'utf8').digest('hex').slice(0, 16);
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

async function liveTemplate(formKey) {
    const admin = await import('firebase-admin/app');
    const { getDatabase } = await import('firebase-admin/database');
    if (!admin.getApps().length) {
        const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
        admin.initializeApp({ credential: admin.cert(key), databaseURL: DATABASE_URL });
    }
    const snap = await getDatabase().ref(`forms/${formKey}`).once('value');
    return snap.val()?.template ?? null;
}

describe('template drift (live RTDB vs pinned fixtures)', () => {
    for (const [formKey, fixtureName] of [
        ['coroner-report', 'coroner-report.template.json'],
        // NOTE: the live RTDB key carries a historical typo (mass-FTALITY).
        // Do not "fix" the key here — that would orphan the live form.
        ['mass-ftality-test', 'mass-fatality.template.json'],
    ]) {
        itLive(`${formKey} matches pinned fixture (re-pin deliberately on change)`, async () => {
            const live = await liveTemplate(formKey);
            expect(live, '[ERR] live template missing — form deleted or DB unreachable').toBeTruthy();
            const pinned = fixture(fixtureName).template;
            expect(
                sha(live),
                '[ERR] TEMPLATE DRIFT: live RTDB template differs from the pinned fixture. ' +
                'Review the diff, update tests/fixtures, re-run goldens.'
            ).toBe(sha(pinned));
        }, 30000);
    }
});
