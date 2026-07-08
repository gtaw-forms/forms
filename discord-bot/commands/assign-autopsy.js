import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import firebase from '../services/firebase.js';
import { getForumClient } from '../services/forumClient.js';
import { parseAutopsyRequestBbcode } from '../services/autopsyRequestMonitor.js';

export const data = new SlashCommandBuilder()
    .setName('assign-autopsy')
    .setDescription('Create a confidential autopsy case (case thread in f=266, no public request)')
    .addStringOption(opt =>
        opt.setName('me')
            .setDescription('ME to assign (e.g. Alyson Frost)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('name')
            .setDescription('Decedent name (IC)')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('ooc')
            .setDescription('Decedent OOC name')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('faction')
            .setDescription('Faction (LSPD, LSSD, SADCR, PRIVATE)')
            .setRequired(false))
    .addAttachmentOption(opt =>
        opt.setName('bbc')
            .setDescription('.txt file with the autopsy BBCode to post as the initial reply')
            .setRequired(false));

export async function execute(interaction) {
    const ownerId = process.env.BOT_OWNER_ID;
    if (!ownerId || interaction.user.id !== ownerId) {
        await interaction.reply({ content: 'Only the bot owner can assign autopsies.', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const meName = interaction.options.getString('me').trim();
    const decedentName = interaction.options.getString('name').trim();
    const oocName = interaction.options.getString('ooc').trim();
    const faction = (interaction.options.getString('faction') || 'PRIVATE').toUpperCase();
    const bbAttachment = interaction.options.getAttachment('bbc');
    const PHMC_BASE = 'https://phmc.gta.world';

    firebase.init();
    const db = firebase.db;

    try {
        const client = getForumClient();
        await client.ensureBrowser();
        // Login first so all subsequent operations have a valid session
        await client.login(null, null, { force: false, baseUrl: PHMC_BASE });

        // Scan f=266 using the main page (disposable pages may not have the stored session)
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

        // Build the Firebase entry early (so BBCode parsing can enrich it)
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
            assignedTo: meName,
            isPrivate: true,
            parsed: {
                requesterName: interaction.user.username,
                deathType: 'CK',
                dateOfDeath: '',
                timeOfDeath: '',
                placeOfDeath: '',
            },
        };

        // Fetch BBCode file content first (used as the topic body)
        let initialContent = 'CONFIDENTIAL AUTOPSY — No public request thread exists for this case.';
        try {
            if (bbAttachment) {
                console.log(`[ASSIGN] Fetching BBCode from attachment: ${bbAttachment.url}`);
                const resp = await fetch(bbAttachment.url);
                initialContent = await resp.text();
                console.log(`[ASSIGN] Loaded ${initialContent.length} chars of BBCode from attachment`);

                // Parse the BBCode to extract structured fields (date, location, etc.) for Firebase
                try {
                    const parsedFields = parseAutopsyRequestBbcode(initialContent);
                    if (Object.keys(parsedFields).length > 0) {
                        console.log(`[ASSIGN] Parsed ${Object.keys(parsedFields).length} fields:`, JSON.stringify(parsedFields));
                        // Merge into the parsed object for Firebase storage
                        Object.assign(entry.parsed, parsedFields);
                    }
                } catch (parseErr) {
                    console.warn(`[ASSIGN] BBCode parsing error: ${parseErr.message}`);
                }
            }
        } catch (fetchErr) {
            console.warn(`[ASSIGN] Failed to fetch attachment: ${fetchErr.message}`);
        }

        // Create case topic in f=266 directly (bypass quoteAndPost — it quotes source content)
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

        // Update topic title with assignee
        try {
            const newTitle = caseTitle.replace('- UNASSIGNED', `- ${meName}`);
            await client.editTopicTitle(topicIdNum, 266, newTitle, { baseUrl: PHMC_BASE });
        } catch (titleErr) {
            console.warn(`[ASSIGN] Title edit failed: ${titleErr.message}`);
        }

        // Store in Firebase (entry object was built earlier)
        entry.caseUrl = caseUrl;
        entry.topicId = topicIdNum;
        await db.ref(`autopsy-requested/${topicIdNum}`).set(entry);

        // Increment round-robin index
        const idxSnap = await db.ref('autopsy-requests/lastAssignedIndex').once('value');
        await db.ref('autopsy-requests/lastAssignedIndex').set((idxSnap.val() || 0) + 1);

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Confidential Autopsy Assigned')
            .setDescription(`**${decedentName}** ((${oocName})) [${faction}]`)
            .addFields(
                { name: 'Assigned To', value: meName, inline: true },
                { name: 'Case', value: `#${caseNum}`, inline: true },
                { name: 'Type', value: 'Confidential — no public request thread', inline: false },
                { name: 'Topic', value: `[View Case](${caseUrl})`, inline: false },
                { name: 'Note', value: 'The case thread exists in f=266. No acknowledgement was sent (no public request). The ME can Load Case in the Assigned Autopsies modal.', inline: false }
            )
            .setFooter({ text: `Assigned by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        console.error('[CMD] assign-autopsy error:', err.message);
        await interaction.editReply({ content: `Error: ${err.message}` });
    }
}
