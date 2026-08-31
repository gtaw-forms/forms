/**
 * vps-env-route-test.mjs — Stage-3 check on the VPS: loads discord-bot/.env
 * manually (same parse rules as index.js), then verifies faction webhook
 * routing + fires ONE env-routed send through notifyRequesterOfCompletion.
 * With TEST_MODE=true that send lands on the dev-discord webhook.
 * Run from /opt/phmc-bot/discord-bot:  node debug-testing-scripts/vps-env-route-test.mjs
 */
import fs from 'fs';

for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
    const t = l.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
}

const m = await import('../services/requesterWebhook.js');
const ls = m.getFactionWebhookUrl('LSSD');
const sa = m.getFactionWebhookUrl('SADCR');
const da = m.getFactionWebhookUrl('DAO');
console.log('testMode :', m.isTestMode());
console.log('LSSD  ->', ls.url ? `${ls.envVar} ${ls.url.slice(0, 55)}...` : 'null');
console.log('SADCR ->', sa.url ? `${sa.envVar} ${sa.url.slice(0, 55)}...` : 'null');
console.log('DAO   ->', da.url === null ? 'null (intentional skip)' : 'SET?!');

const r = await m.notifyRequesterOfCompletion(null, {
    faction: 'LSSD',
    caseNum: '517',
    caseTitle: 'Case 517 - Jennifer Bradley [LSSD] (VPS env-route test)',
    assignedTo: 'Jane Roe',
    requesterDiscordTag: '._diaaa',
    parsed: { requesterName: 'Katherine Olsen' },
    lssdRequestTopicId: '25000',
});
console.log('send   :', JSON.stringify(r));
process.exit(r.ok ? 0 : 1);
