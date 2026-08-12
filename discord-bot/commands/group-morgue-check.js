import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve forum-specific credentials and base URL from environment variables.
 * Returns { baseUrl, username, password } or null if not configured.
 */
function getForumConfig(forumKey) {
    const envMap = {
        lspd:  { url: 'FORUM_LSPD_URL',  user: 'FORUM_LSPD_USERNAME',  pass: 'FORUM_LSPD_PASSWORD' },
        lssd:  { url: 'FORUM_LSSD_URL',  user: 'FORUM_LSSD_USERNAME',  pass: 'FORUM_LSSD_PASSWORD' },
        sadcr: { url: 'FORUM_SADCR_URL', user: 'FORUM_SADCR_USERNAME', pass: 'FORUM_SADCR_PASSWORD' },
        dao:   { url: 'FORUM_DAO_URL',   user: 'FORUM_DAO_USERNAME',   pass: 'FORUM_DAO_PASSWORD' },
        phmc:  { url: 'FORUM_BASE_URL',  user: 'FORUM_USERNAME',       pass: 'FORUM_PASSWORD' },
    };

    const cfg = envMap[forumKey];
    if (!cfg) return null;

    const baseUrl = process.env[cfg.url];
    const username = process.env[cfg.user];
    const password = process.env[cfg.pass];

    if (!baseUrl || !username || !password) {
        return null;
    }

    return { baseUrl, username, password };
}

/**
 * Load morgue records from the local morgue-data.json file.
 * Returns an array of records with firebaseKey set, or null if file not found.
 */
function loadMorgueRecords() {
    const dataPath = resolve(__dirname, '..', 'morgue-data.json');
    if (!existsSync(dataPath)) return null;
    try {
        const raw = JSON.parse(readFileSync(dataPath, 'utf-8'));
        return Object.values(raw).map(r => ({
            ...r,
            firebaseKey: r.firebaseKey || r.caseId,
        }));
    } catch {
        return null;
    }
}

/**
 * Find and load the most recent saved scan file for a given forum + group.
 * Returns { members, scannedAt } or null if none found.
 */
function loadSavedScanFile(forumKey, groupId) {
    const dir = resolve(__dirname, '..');
    const prefix = `group-scan-${forumKey}-g${groupId}-`;
    let newest = null;
    try {
        const files = readdirSync(dir);
        for (const f of files) {
            if (f.startsWith(prefix) && f.endsWith('.json')) {
                if (!newest || f > newest) newest = f;
            }
        }
    } catch {
        return null;
    }
    if (!newest) return null;
    try {
        const data = JSON.parse(readFileSync(resolve(dir, newest), 'utf-8'));
        return {
            members: data.members || [],
            scannedAt: data.scannedAt || null,
            filename: newest,
        };
    } catch {
        return null;
    }
}

/**
 * Parse a date string (DD-MM-YYYY or YYYY-MM-DD) into a timestamp (ms), or null.
 * Accepts - / . separators.
 */
function parseDateParam(str) {
    if (!str) return null;
    const s = String(str).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        return isNaN(d.getTime()) ? null : d.getTime();
    }
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
        const d = new Date(+m[3], +m[2] - 1, +m[1]);
        return isNaN(d.getTime()) ? null : d.getTime();
    }
    return null;
}

/**
 * Best-effort timestamp for a morgue record. Prefers the death time
 * (timeOfDeath) when parseable; falls back to lastUpdated.
 */
function recordTimestamp(r) {
    if (r.timeOfDeath) {
        const m = String(r.timeOfDeath).match(/(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/);
        if (m) {
            const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
            const mon = months[m[2].slice(0, 3)];
            if (mon !== undefined) {
                const d = new Date(+m[3], mon, +m[1]);
                if (!isNaN(d.getTime())) return d.getTime();
            }
        }
    }
    return r.lastUpdated || null;
}

/**
 * Clean a stored narcotics value. The morgue parser sometimes dumps pellet /
 * bullet recovery lines into the narcotics field; extract only the drug name.
 */
function cleanNarcotics(value) {
    if (!value) return '';
    return String(value)
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !/^(?:pellet|bullet)\s+recovered with striation marks/i.test(l) && !/^#\d+$/.test(l))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export const data = new SlashCommandBuilder()
    .setName('group-morgue-check')
    .setDescription('Scrape a faction group roster and check members against morgue records')
    .addIntegerOption(opt =>
        opt.setName('group_id')
            .setDescription('phpBB group ID (e.g. 44 for LSPD)')
            .setRequired(true)
            .setMinValue(1))
    .addStringOption(opt =>
        opt.setName('forum')
            .setDescription('Which forum to scrape')
            .setRequired(false)
            .addChoices(
                { name: 'LSPD', value: 'lspd' },
                { name: 'LSSD', value: 'lssd' },
                { name: 'SADCR', value: 'sadcr' },
                { name: 'DAO', value: 'dao' },
                { name: 'PHMC', value: 'phmc' },
            ))
    .addBooleanOption(opt =>
        opt.setName('check_morgue')
            .setDescription('Look up names in morgue records (default: true)')
            .setRequired(false))
    .addBooleanOption(opt =>
        opt.setName('save_file')
            .setDescription('Save full results to a JSON file on the VPS (default: false)')
            .setRequired(false))
    .addBooleanOption(opt =>
        opt.setName('use_saved_file')
            .setDescription('Use most recent saved scan file instead of re-scraping the forum')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('date_from')
            .setDescription('Filter records from this date (DD-MM-YYYY or YYYY-MM-DD, e.g. 01-06-2026)')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('date_to')
            .setDescription('Filter records up to this date (DD-MM-YYYY or YYYY-MM-DD, e.g. 17-07-2026)')
            .setRequired(false));

export async function execute(interaction) {
    // ── Owner-only check ──
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can run group morgue checks.', flags: MessageFlags.Ephemeral });
        return;
    }

    const groupId = interaction.options.getInteger('group_id');
    const forumKey = interaction.options.getString('forum') || 'lspd';
    const checkMorgue = interaction.options.getBoolean('check_morgue') ?? true;
    const saveFile = interaction.options.getBoolean('save_file') ?? false;
    const useSavedFile = interaction.options.getBoolean('use_saved_file') ?? false;
    const dateFrom = interaction.options.getString('date_from') || null;
    const dateTo = interaction.options.getString('date_to') || null;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── Resolve forum config (only needed if scraping live) ──
    let forumCfg = null;
    if (!useSavedFile) {
        forumCfg = getForumConfig(forumKey);
        if (!forumCfg) {
            await interaction.editReply({
                content: `[ERR] Forum config for "${forumKey}" is missing or incomplete. Check that the corresponding FORUM_* env vars are set in .env`,
            });
            return;
        }
    }

    let members = [];
    let scanSource = null;
    if (useSavedFile) {
        const saved = loadSavedScanFile(forumKey, groupId);
        if (!saved) {
            await interaction.editReply({
                content: `[WARN] No saved scan file found for ${forumKey.toUpperCase()} g=${groupId}. Run without use_saved_file to create one first.`,
            });
            return;
        }
        members = saved.members;
        scanSource = `saved file \`${saved.filename}\` (scanned ${saved.scannedAt ? new Date(saved.scannedAt).toLocaleDateString() : 'unknown date'})`;
        console.log(`[CMD] group-morgue-check: loaded ${members.length} members from saved file ${saved.filename}`);
    } else {
        try {
            const { createIsolatedClient } = await import('../services/forumClient.js');
            const client = createIsolatedClient('group-scan');

            await client.login(forumCfg.username, forumCfg.password, {
                force: true,
                baseUrl: forumCfg.baseUrl,
            });

            members = await client.getGroupMembers(groupId, {
                baseUrl: forumCfg.baseUrl,
                paginate: true,
            });

            await client.close();
            scanSource = 'live scrape';
        } catch (err) {
            console.error(`[CMD] group-morgue-check error scraping forum: ${err.message}`);
            await interaction.editReply({
                content: `[ERR] Failed to scrape group: ${err.message}`,
            });
            return;
        }
    }

    if (members.length === 0) {
        await interaction.editReply({
            content: `[WARN] Group g=${groupId} on ${forumKey} appears to have 0 members or access was denied.`,
        });
        return;
    }

    // ── Date range filter (supports DD-MM-YYYY or YYYY-MM-DD) ──
    const dateFromMs = parseDateParam(dateFrom);
    const dateToMs = parseDateParam(dateTo);

    // ── Morgue lookup ──
    let morgueRecords = null;
    let matched = [];
    let unmatched = [];

    if (checkMorgue) {
        morgueRecords = loadMorgueRecords();
        if (!morgueRecords) {
            console.warn('[CMD] group-morgue-check: morgue-data.json not found or unreadable, skipping morgue check');
        } else {
            let filtered = morgueRecords;
            if (dateFromMs || dateToMs) {
                filtered = morgueRecords.filter(r => {
                    const ts = recordTimestamp(r);
                    if (!ts) return !dateFromMs && !dateToMs;
                    if (dateFromMs && ts < dateFromMs) return false;
                    if (dateToMs && ts > dateToMs) return false;
                    return true;
                });
            }

            for (const member of members) {
                const q = member.name.toLowerCase();
                const hits = filtered.filter(r =>
                    (r.name || '').toLowerCase().includes(q)
                );
                if (hits.length > 0) {
                    matched.push({ name: member.name, records: hits });
                } else {
                    unmatched.push(member.name);
                }
            }
        }
    }

    // ── Build embed ──
    let drugWarnings = [];
    let earliestDate = null;
    if (matched.length > 0) {
        for (const m of matched) {
            for (const r of m.records) {
                const narc = cleanNarcotics(r.narcotics);
                if (narc && narc !== 'N/A' && narc !== 'None' && narc !== 'Unknown' && narc !== '') {
                    const dateStr = r.timeOfDeath
                        ? r.timeOfDeath.replace(/\s*\(.*?\)\s*$/, '').trim()
                        : r.lastUpdated
                            ? new Date(r.lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : null;
                    drugWarnings.push({
                        name: m.name,
                        caseId: r.caseId,
                        narcotics: narc,
                        bac: r.bac || '0.00%',
                        date: dateStr,
                    });
                }
                // Track earliest record
                const rTs = recordTimestamp(r);
                if (rTs && (!earliestDate || rTs < earliestDate)) {
                    earliestDate = rTs;
                }
            }
        }
    }
    // Also check earliest across all morgue data, not just matched
    if (!earliestDate && morgueRecords && morgueRecords.length > 0) {
        for (const r of morgueRecords) {
            const rTs = recordTimestamp(r);
            if (rTs && (!earliestDate || rTs < earliestDate)) {
                earliestDate = rTs;
            }
        }
    }

    const totalDeaths = matched.reduce((sum, m) => sum + m.records.length, 0);

    const embed = new EmbedBuilder()
        .setColor(drugWarnings.length > 0 ? 0xe74c3c : matched.length > 0 ? 0xf39c12 : 0x28a745)
        .setTitle(`Group Morgue Check — ${forumKey.toUpperCase()} g=${groupId}`)
        .addFields(
            { name: 'Total Members', value: String(members.length), inline: true },
            { name: 'Deceased (unique)', value: `${matched.length}`, inline: true },
            { name: 'Total Deaths', value: String(totalDeaths), inline: true },
            { name: 'No Records', value: String(unmatched.length), inline: true },
            { name: 'Records Since', value: earliestDate ? `<t:${Math.floor(earliestDate / 1000)}:D>` : 'N/A', inline: false },
        );

    // Top deaths leaderboard
    if (matched.length > 0) {
        const sorted = [...matched].sort((a, b) => b.records.length - a.records.length);
        const top = sorted.slice(0, 10);
        let lb = '';
        for (let i = 0; i < top.length; i++) {
            const entry = top[i];
            const rank = i + 1;
            const medal = rank === 1 ? ':first_place:' : rank === 2 ? ':second_place:' : rank === 3 ? ':third_place:' : `${rank}.`;
            const line = `${medal} **${entry.name}** — ${entry.records.length} death${entry.records.length > 1 ? 's' : ''}\n`;
            if (lb.length + line.length > 950) {
                const remaining = top.length - i;
                lb += `...and ${remaining} more`;
                break;
            }
            lb += line;
        }
        embed.addFields({ name: ':trophy: Top Deaths', value: lb.slice(0, 1024) || '(none)', inline: false });
    }

    // Drug usage warning field
    if (drugWarnings.length > 0) {
        let warnDetail = '';
        let warnCount = 0;
        for (const w of drugWarnings) {
            const line = `**${w.name}** (#${w.caseId}) — ${w.narcotics} [BAC: ${w.bac}]${w.date ? ` — ${w.date}` : ''}\n`;
            if (warnDetail.length + line.length > 950) {
                const remaining = drugWarnings.length - warnCount;
                warnDetail += `...and ${remaining} more flagged`;
                break;
            }
            warnDetail += line;
            warnCount++;
        }
        embed.addFields({ name: `[WARN] Drug Usage Detected (${drugWarnings.length})`, value: warnDetail.slice(0, 1024), inline: false });
    }

    if (matched.length > 0) {
        let detail = '';
        for (let i = 0; i < matched.length; i++) {
            const m = matched[i];
            const deathCount = m.records.length;
            const countTag = deathCount > 1 ? ` (x${deathCount})` : '';
            const line = `${m.name}${countTag}\n`;
            if (detail.length + line.length > 950) {
                const remaining = matched.length - i;
                detail += `...and ${remaining} more`;
                break;
            }
            detail += line;
        }
        embed.addFields({ name: 'Deceased Members', value: detail.slice(0, 1024) || '(none)', inline: false });
    }

    if (unmatched.length > 0 && !checkMorgue) {
        embed.setDescription('Morgue check was skipped. Use `check_morgue:true` to look up names.');
    }

    embed.setFooter({ text: `Triggered by ${interaction.user.tag}` }).setTimestamp();

    // ── File output ──
    const outputData = {
        scannedAt: new Date().toISOString(),
        forum: forumKey,
        groupId,
        memberCount: members.length,
        matchedCount: matched.length,
        totalDeaths,
        unmatchedCount: unmatched.length,
        matched: matched.map(m => ({
            name: m.name,
            records: m.records.map(r => ({
                caseId: r.caseId,
                causeOfDeath: r.causeOfDeath,
                name: r.name,
                bac: r.bac || '0.00%',
                narcotics: cleanNarcotics(r.narcotics) || 'N/A',
            })),
        })),
        unmatched: checkMorgue ? unmatched : undefined,
        members: members,
    };

    // Save to VPS disk if requested (into the debug/ folder)
    let savePath = null;
    if (saveFile) {
        const timestamp = Date.now();
        const debugDir = resolve(__dirname, '..', 'debug');
        savePath = resolve(debugDir, `group-scan-${forumKey}-g${groupId}-${timestamp}.json`);
        try {
            mkdirSync(debugDir, { recursive: true });
            writeFileSync(savePath, JSON.stringify(outputData, null, 2), 'utf-8');
        } catch (err) {
            console.error(`[CMD] Failed to save group scan file: ${err.message}`);
            savePath = null;
        }
    }

    // Attach full results as a JSON file to the reply
    const jsonBuffer = Buffer.from(JSON.stringify(outputData, null, 2), 'utf-8');
    const attachment = new AttachmentBuilder(jsonBuffer, {
        name: `group-scan-${forumKey}-g${groupId}.json`,
    });

    const extra = savePath ? `\nFile saved to: \`${savePath}\`` : '';
    await interaction.editReply({
        content: `[DONE] Scanned **${members.length}** members from **${forumKey.toUpperCase()}** group **${groupId}**.${extra}`,
        embeds: [embed],
        files: [attachment],
    });
}
