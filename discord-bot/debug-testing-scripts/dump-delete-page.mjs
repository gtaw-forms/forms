// debug-testing-scripts/dump-delete-page.mjs — dump the phpBB delete page for inspection
import { getForumClient } from '../services/forumClient.js';

const topicId = process.argv[2];
const forumId = process.argv[3] || '266';
if (!topicId) { console.error('Usage: node dump-delete-page.mjs <topicId> [forumId]'); process.exit(1); }

const client = getForumClient();
await client.ensureBrowser();
await client.ensureLoggedIn();

await client.page.goto(`https://phmc.gta.world/posting.php?mode=delete&f=${forumId}&t=${topicId}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((e) => console.error('goto error:', e.message));
await client.page.waitForTimeout(2500);

const dump = await client.page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
        action: f.getAttribute('action') || '',
        inputs: Array.from(f.querySelectorAll('input')).map(i => ({ name: i.name, type: i.type, value: (i.value || '').slice(0, 40) })),
        buttons: Array.from(f.querySelectorAll('button')).map(b => b.innerText.trim().slice(0, 40)),
    }));
    return {
        url: window.location.href,
        title: document.title,
        bodyHead: document.body.innerText.slice(0, 1200).replace(/\s+/g, ' '),
        forms,
    };
});
console.log(JSON.stringify(dump, null, 2));
process.exit(0);
