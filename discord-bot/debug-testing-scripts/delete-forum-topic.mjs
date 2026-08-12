// debug-testing-scripts/delete-forum-topic.mjs
// One-off: delete a phpBB topic via the shared forum session.
// Usage (on VPS, from discord-bot/):  node debug-testing-scripts/delete-forum-topic.mjs <topicId> [forumId]
import { getForumClient } from '../services/forumClient.js';

const topicId = process.argv[2];
const forumId = process.argv[3] || '266';
if (!topicId) {
    console.error('Usage: node debug-testing-scripts/delete-forum-topic.mjs <topicId> [forumId]');
    process.exit(1);
}

const client = getForumClient();
await client.ensureBrowser();
await client.ensureLoggedIn();

const url = `https://phmc.gta.world/posting.php?mode=delete&f=${forumId}&t=${topicId}`;
console.log(`[DELETE] Opening ${url}`);
await client.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((e) => console.error('[DELETE] goto error:', e.message));
await client.page.waitForTimeout(2500);

const probe = await client.page.evaluate(() => ({
    url: window.location.href,
    hasPermissionMsg: /not (have )?permission|not authorised|no permission/i.test(document.body.innerText.slice(0, 2000)),
    hasDeleteForm: !!document.querySelector('form[action*="mode=delete"], form[method="post"] input[name="confirm"]'),
    formCount: document.querySelectorAll('form').length,
}));
console.log('[DELETE] Probe:', JSON.stringify(probe));

if (!probe.hasDeleteForm) {
    console.error('[DELETE] No delete confirmation form found — bot account likely lacks moderator rights, or topic already deleted.');
    process.exit(1);
}

const clicked = await client.page.evaluate(() => {
    const form = document.querySelector('form[action*="mode=delete"]') || document.querySelector('form[method="post"]');
    if (!form) return false;
    const btn = form.querySelector('input[type="submit"][name="confirm"], input[type="submit"]');
    if (!btn) return false;
    btn.click();
    return true;
});
console.log('[DELETE] Submit clicked:', clicked);

await client.page.waitForTimeout(6000);
const result = await client.page.evaluate(() => ({
    url: window.location.href,
    head: document.body.innerText.slice(0, 300).replace(/\s+/g, ' '),
}));
console.log('[DELETE] After submit:', JSON.stringify(result, null, 2));

const ok = !result.url.includes('mode=delete') || /successfully deleted|deleted/i.test(result.head);
console.log(ok ? '[DELETE] ✅ Looks deleted.' : '[DELETE] ⚠️ Check result above.');
process.exit(0);
