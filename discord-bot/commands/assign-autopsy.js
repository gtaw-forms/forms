import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { parseAutopsyRequestBbcode } from '../services/autopsyRequestMonitor.js';
import { recordAssignment, selectME } from '../services/autopsyRotation.js';

export const data = new SlashCommandBuilder()
    .setName('assign-autopsy')
    .setDescription('Create a confidential autopsy case (case thread in f=266, no public request, no LSPD/LSSD crosspost)')
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('ME to assign (leave blank to auto-assign via rotation)')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Decedent name (IC) — defaults to the BBCode name field')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('ooc')
            .setDescription('Decedent OOC name — defaults to ((OOC)) in the BBCode')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('faction')
            .setDescription('Faction (LSPD, LSSD, SADCR, PRIVATE)')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('pm_forum')
            .setDescription('On completion, PM the report to this forum instead of public crosspost (private cases)')
            .setRequired(false)
            .addChoices(
                { name: 'LSPD', value: 'lspd' },
                { name: 'LSSD', value: 'lssd' },
                { name: 'PHMC', value: 'phmc' },
            ))
    .addStringOption(opt =>
        opt.setName('requester')
            .setDescription('Forum username to receive the PM (when pm_forum is set)')
            .setRequired(false))
    .addAttachmentOption(opt =>
        opt.setName('bbc')
            .setDescription('.txt file with the autopsy BBCode to post as the initial reply (fields are auto-parsed)')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can assign autopsies.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const meName = (interaction.options.getString('me') || '').trim();
    let decedentName = (interaction.options.getString('name') || '').trim();
    let oocName = (interaction.options.getString('ooc') || '').trim();
    const faction = (interaction.options.getString('faction') || 'PRIVATE').toUpperCase();
    const pmForum = (interaction.options.getString('pm_forum') || '').toLowerCase();
    const pmRecipient = (interaction.options.getString('requester') || '').trim();
    const bbAttachment = interaction.options.getAttachment('bbc');
    const PHMC_BASE = 'https://phmc.gta.world';

    firebase.init();
    const db = firebase.db;

    try {
        const client = getForumClient();
        await client.ensureBrowser();
        // Login first so all subsequent operations have a valid session
        await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

        // ── Fetch + parse BBCode attachment first (source of truth for fields) ──
        let initialContent = 'CONFIDENTIAL AUTOPSY — No public request thread exists for this case.';
        const parsedFields = {};
        try {
            if (bbAttachment) {
                console.log(`[ASSIGN] Fetching BBCode from attachment: ${bbAttachment.url}`);
                const resp = await fetch(bbAttachment.url);
                initialContent = await resp.text();
                console.log(`[ASSIGN] Loaded ${initialContent.length} chars of BBCode from attachment`);

                const parsed = parseAutopsyRequestBbcode(initialContent);
                Object.assign(parsedFields, parsed);
                if (Object.keys(parsed).length > 0) {
                    console.log(`[ASSIGN] Parsed ${Object.keys(parsed).length} fields:`, JSON.stringify(parsed));
                }
            }
        } catch (fetchErr) {
            console.warn(`[ASSIGN] Failed to fetch/parse attachment: ${fetchErr.message}`);
        }

        // Backfill name / OOC from the BBCode when not explicitly provided.
        // The body's Name field often already carries the OOC ("John Doe ((Omar
        // Burks))") — split it so the case title doesn't duplicate the parens.
        const extractEmbeddedOoc = (raw) => {
            const s = String(raw || '');
            const m = s.match(/\(\(\s*(.*?)\s*\)\)/);
            if (!m) return null;
            return { clean: s.replace(/\(\s*[\w.'\-\s]+\)/g, '').replace(/\(\)|\(|\)/g, '').replace(/\s{2,}/g, ' ').trim(), ooc: m[1].trim() };
        };

        let embedded = null;
        if (parsedFields.decedentName) {
            embedded = extractEmbeddedOoc(parsedFields.decedentName);
        }

        if (!decedentName) {
            decedentName = (embedded?.clean || parsedFields.decedentName || '').trim();
            console.log(`[ASSIGN] Decedent name from BBCode: "${decedentName}"`);
        }
        if (!oocName) {
            // Prefer the OOC embedded in the decedent name over any other
            // ((...)) group in the body (the first match is often a Discord
            // name / requester field, not the decedent's character name).
            if (embedded?.ooc) {
                oocName = embedded.ooc;
                console.log(`[ASSIGN] OOC name from decedent name: "${oocName}"`);
            } else if (parsedFields.oocName) {
                oocName = parsedFields.oocName.trim();
                console.log(`[ASSIGN] OOC name from BBCode: "${oocName}"`);
            } else {
                const oocMatch = initialContent.match(/\(\(\s*(.*?)\s*\)\)/);
                if (oocMatch && oocMatch[1]) {
                    oocName = oocMatch[1].trim();
                    console.log(`[ASSIGN] OOC name from ((OOC)) in BBCode: "${oocName}"`);
                }
            }
        }
        if (!decedentName && !oocName) {
            await interaction.editReply({
                content: '[ERR] No decedent name or OOC name found. Provide `name`/`ooc` or attach a BBCode file with a name field.',
            });
            return;
        }
        if (pmForum && !pmRecipient) {
            await interaction.editReply({
                content: '[ERR] `pm_forum` is set but no `requester` (forum username) was provided. Add the recipient to enable the PM.',
            });
            return;
        }

        // ── Scan f=266 to determine the next case number ──
        let caseNum = '';
        try {
            const topicsUrl = `${PHMC_BASE}/viewforum.php?f=266`;
            await client.page.goto(topicsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await client.page.waitForTimeout(2000);
            const topics = await client.page.evaluate(() => {
                const links = document.querySelectorAll('a.topictitle, a.topictitle2, a[href*="viewtopic.php"]');
                return Array.from(links).map(l => ({ title: l.textContent?.trim() || '', href: l.getAttribute('href') || '' }));
            });
            let highest = 0;
            for (const t of topics) {
                const m = t.title.match(/Case\s*(\d+)/i);
                if (m) { const n = parseInt(m[1], 10); if (n > highest) highest = n; }
            }
            caseNum = String(highest + 1);
            console.log(`[ASSIGN] Highest case: #${highest} -> new: #${caseNum}`);
        } catch (err) {
            console.warn(`[ASSIGN] Case number lookup: ${err.message}`);
        }

        const caseTitle = `Case ${caseNum} - ${decedentName} ((${oocName})) [${faction}] - UNASSIGNED`;

        // Build the Firebase entry (parsed fields enrich it)
        const entry = {
            title: `Confidential Autopsy - ${decedentName} ((${oocName})) [${faction}]`,
            name: decedentName,
            oocName: oocName,
            faction: faction,
            topicUrl: null,
            caseUrl: null,
            topicId: null,
            caseNum: caseNum,
            detectedAt: new Date().toISOString(),
            wasMatch: true,
            assignedTo: meName || null,
            isPrivate: true,
            pmForum: pmForum || null,
            pmRecipient: pmRecipient || null,
            parsed: {
                requesterName: interaction.user.username,
                deathType: 'CK',
                dateOfDeath: parsedFields.dateOfDeath || '',
                timeOfDeath: parsedFields.timeOfDeath || '',
                placeOfDeath: parsedFields.placeOfDeath || '',
                decedentName: parsedFields.decedentName || decedentName,
                oocName: parsedFields.oocName || oocName,
                ...parsedFields,
            },
        };

        // ── Create case topic in f=266 (bypass quoteAndPost — no source to quote) ──
        const postUrl = `${PHMC_BASE}/posting.php?mode=post&f=266`;
        console.log(`[ASSIGN] Navigating to posting page: ${postUrl}`);
        await client.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 });
        await client.page.waitForTimeout(2000);

        // Handle login redirect if needed
        let pUrl = client.page.url();
        if (pUrl.includes('mode=login')) {
            console.log('[ASSIGN] Re-authenticating...');
            await client.login(null, null, { force: true, baseUrl: PHMC_BASE });
            await client.page.goto(postUrl, { waitUntil: 'networkidle', timeout: 180000 });
            await client.page.waitForTimeout(2000);
        }

        // Set subject
        await client.page.evaluate((s) => {
            const el = document.querySelector('input[name="subject"]');
            if (el) { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }, caseTitle);

        // Set message to BBCode file content (or a short notice if no file)
        await client.page.evaluate((msg) => {
            const ta = document.querySelector('textarea[name="message"]');
            if (ta) { ta.value = msg; ta.dispatchEvent(new Event('input', { bubbles: true })); }
        }, initialContent);

        await client.page.waitForTimeout(500);

        // Submit
        const submitResult = await client.page.evaluate(() => {
            const form = document.querySelector('form[action*="posting.php"]');
            if (!form) return { ok: false, reason: 'No form' };
            const btn = form.querySelector('input[type="submit"][name="post"], input[type="submit"][value="Submit"], button[type="submit"][name="post"]');
            if (!btn) return { ok: false, reason: 'No submit button' };
            btn.click();
            return { ok: true };
        });

        if (!submitResult.ok) {
            await interaction.editReply({ content: `Failed to post topic: ${submitResult.reason}` });
            return;
        }

        await client.page.waitForTimeout(5000);
        const finalUrl = client.page.url();
        if (!finalUrl.includes('viewtopic.php')) {
            console.log(`[ASSIGN] Topic post ⚠️ — ${finalUrl}`);
        }
        console.log(`[ASSIGN] Topic created: ${finalUrl}`);

        const tMatch = finalUrl.match(/[?&]t=(\d+)/);
        const topicIdNum = tMatch ? tMatch[1] : `conf_${Date.now()}`;
        const caseUrl = finalUrl;

        // ── Assign ME: explicit, or via rotation when blank ──
        let assignedName = meName;
        if (!assignedName) {
            console.log('[ASSIGN] No ME specified — selecting via rotation...');
            assignedName = await selectME(db, topicIdNum, caseNum);
            if (assignedName) {
                console.log(`[ASSIGN] Rotation selected: ${assignedName}`);
            } else {
                console.warn('[ASSIGN] Rotation returned no ME (all LOA / not configured) — leaving UNASSIGNED');
            }
        } else {
            console.log(`[ASSIGN] Manual ME: ${assignedName}`);
        }

        // Update topic title with assignee
        if (assignedName) {
            try {
                const newTitle = caseTitle.replace('- UNASSIGNED', `- ${assignedName}`);
                await client.editTopicTitle(topicIdNum, 266, newTitle, { baseUrl: PHMC_BASE });
                entry.assignedTo = assignedName;
            } catch (titleErr) {
                console.warn(`[ASSIGN] Title edit failed: ${titleErr.message}`);
            }

            // Post the assignment reply (matches the monitor's assignment flow)
            try {
                const memberList = await client.getGroupMembers(50, { baseUrl: PHMC_BASE, exclude: ['PHMC Forms Bot'], paginate: true });
                const member = memberList.find(m => m.name.toLowerCase() === assignedName.toLowerCase());
                const uid = member?.userId || '0';
                const assignBBCode = `[quote="${assignedName}" user_id=${uid}]\n[/quote]\n\n[b]${assignedName}[/b] - You have been assigned this autopsy case file.`;
                const replyResult = await client.replyToTopic(topicIdNum, 266, assignBBCode, { dryRun: false, baseUrl: PHMC_BASE });
                entry.assignmentReplyStatus = replyResult.ok ? 'completed' : 'failed';
                console.log(`[ASSIGN] Assignment reply ${replyResult.ok ? 'OK' : 'FAILED: ' + (replyResult.reason || 'unknown')}`);
            } catch (replyErr) {
                console.warn(`[ASSIGN] Assignment reply error: ${replyErr.message}`);
                entry.assignmentReplyStatus = 'failed';
            }
        }

        // ── Store in Firebase ──
        entry.caseUrl = caseUrl;
        entry.topicId = topicIdNum;
        entry.caseTopicId = topicIdNum;
        await db.ref(`autopsy-requested/${topicIdNum}`).set(entry);

        // Record assignment in the rotation tracker (for active case counts, recency)
        if (assignedName) {
            await recordAssignment(db, assignedName, topicIdNum, caseNum).catch(err => {
                console.warn(`[ASSIGN] Failed to record assignment in rotation: ${err.message}`);
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Confidential Autopsy Assigned')
            .setDescription(`**${decedentName}** ((${oocName})) [${faction}]`)
            .addFields(
                { name: 'Assigned To', value: assignedName || 'UNASSIGNED', inline: true },
                { name: 'Case', value: `#${caseNum}`, inline: true },
                { name: 'Type', value: 'Confidential — no public request thread', inline: false },
                { name: 'Topic', value: `[View Case](${caseUrl})`, inline: false },
                { name: 'Delivery', value: pmForum ? `Completed report PM'd to **${pmRecipient}** on **${pmForum.toUpperCase()}**` : 'No public crosspost, no PM', inline: false },
                { name: 'Note', value: 'Private case: case thread in f=266 only. No LSPD/LSSD public crossposting. The ME can Load Case in the Assigned Autopsies modal.', inline: false }
            )
            .setFooter({ text: `Assigned by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] assign-autopsy error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
