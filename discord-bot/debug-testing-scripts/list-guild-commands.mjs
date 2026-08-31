/**
 * list-guild-commands.mjs — GET the registered slash commands for the bot's
 * guild straight from Discord's API (definitive registration check).
 * Run from /opt/phmc-bot/discord-bot:  node debug-testing-scripts/list-guild-commands.mjs
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

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.GUILD_ID;
if (!token || !guildId) {
    console.error('[ERR] missing DISCORD_BOT_TOKEN or GUILD_ID');
    process.exit(1);
}

// @me isn't valid on guild-command routes — resolve the real application ID first.
const meRes = await fetch('https://discord.com/api/v10/applications/@me', {
    headers: { Authorization: `Bot ${token}` },
});
if (!meRes.ok) {
    console.error(`[ERR] app lookup HTTP ${meRes.status}: ${await meRes.text()}`);
    process.exit(1);
}
const appId = (await meRes.json()).id;

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`, {
    headers: { Authorization: `Bot ${token}` },
});
if (!res.ok) {
    console.error(`[ERR] HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
}
const cmds = await res.json();
console.log(`Guild ${guildId} — ${cmds.length} registered commands:`);
for (const c of cmds.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  /${c.name}`);
}
const need = ['enable-dev-autopsy', 'test-requester-webhook'];
const missing = need.filter((n) => !cmds.some((c) => c.name === n));
console.log(missing.length === 0 ? '[OK] both new commands present' : `[ERR] missing: ${missing.join(', ')}`);
