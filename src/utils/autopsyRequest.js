// ---------------------------------------------------------------------------
// Autopsy request helpers (web app)
// ---------------------------------------------------------------------------
// Shared by the single "Request Autopsy" modal and the batch ("mass") request
// prototype. The BBCode builders mirror the f=265 request template verbatim
// because the bot parses the POSTED text, not our JSON payload:
//   - discord-bot/services/autopsyRequestMonitor.js -> parseAutopsyRequestBbcode
//   - discord-bot/services/autopsyRequestMonitor.js -> parseMassRequestBbcode
// A mass request MUST carry "[Mass Autopsy Request]" in the title (so it can't
// match the singular TITLE_REGEX) and "--- BODY N ---" headers in Section 2.
// Keep this file dependency-free so tests can run it headlessly.

const MONTHS = {
    january: 'JAN', february: 'FEB', march: 'MAR', april: 'APR', may: 'MAY', june: 'JUN',
    july: 'JUL', august: 'AUG', september: 'SEP', october: 'OCT', november: 'NOV', december: 'DEC',
};

export const MAX_MASS_BODIES = 20;

// Every blank optional field needs a forum-safe value; matches the bot's DNA
// constant so it never renders a raw "ANSWER" placeholder.
export const DNA_VALUE = 'D.N.A (Did Not Answer)';

// Parse a morgue record's timeOfDeath ("Monday, 24 August 2026 09:39:11")
// into the request format's Date of Death + Time of Death.
export const parseTimeOfDeath = (raw) => {
    const m = String(raw || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!m) return { dateOfDeath: '', timeOfDeath: '' };
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return { dateOfDeath: '', timeOfDeath: '' };
    const dateOfDeath = `${String(m[1]).padStart(2, '0')}/${mon}/${m[3]}`;
    let h = parseInt(m[4], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeOfDeath = `${String(h).padStart(2, '0')}:${m[5]} ${ampm}`;
    return { dateOfDeath, timeOfDeath };
};

// Infer the decedent's ethnicity from the morgue record — a structured
// `ethnicity` field first, then a keyword scan of the free-text physical
// description (same approach as UnprocessedCKsViewer). Bare "black"/"white"
// are guarded against hair/clothing false-positives (e.g. "black hair").
export const inferEthnicity = (record) => {
    if (record?.ethnicity && String(record.ethnicity).trim()) return String(record.ethnicity).trim();
    const desc = String(record?.physicalDescription || '').toLowerCase();
    if (!desc) return '';
    const rules = [
        [/\bafrican[- ]american\b/i, 'African American'],
        [/\bblack\b(?!\s+(?:hair|eyes|beard|shirt|tee|hoodie|jacket|sweater|shoes|boots|pants|coat|hat|skin)\b)/i, 'African American'],
        [/\bcaucasian\b|\bwhite\b(?!\s+(?:hair|shirt|tee|hoodie|jacket|sweater|shoes|boots|pants|coat|hat|skin)\b)/i, 'Caucasian'],
        [/\bhispanic\b|\blatino\b|\blatina\b|\blatinoamerican\b/i, 'Hispanic'],
        [/\b(asian[- ]american|taiwanese|chinese|japanese|korean|vietnamese|filipino|asian)\b/i, 'Asian'],
        [/\bnative[- ]american\b/i, 'Native American'],
        [/\bmiddle[- ]eastern\b/i, 'Middle Eastern'],
        [/\bpacific[- ]islander\b/i, 'Pacific Islander'],
    ];
    for (const [re, value] of rules) {
        if (re.test(desc)) return value;
    }
    return '';
};

// "Jane Doe (( OOCName ))" -> { decedentName: 'Jane Doe', oocName: 'OOCName' }
export const splitDecedentName = (rawName) => {
    const raw = String(rawName || '');
    const oocMatch = raw.match(/\(\(\s*([^)]*?)\s*\)\)/);
    return {
        decedentName: raw.replace(/\(\([^)]*\)\)/g, '').trim() || 'Unknown',
        oocName: oocMatch ? oocMatch[1].trim() : '',
    };
};

// Fallback for records whose human-readable timeOfDeath is missing/unparseable
// but whose ISO timestamp is present ("2026-08-24T09:39:11").
const parseIsoTimeOfDeath = (raw) => {
    const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!m) return { dateOfDeath: '', timeOfDeath: '' };
    const mon = Object.values(MONTHS)[parseInt(m[2], 10) - 1];
    if (!mon) return { dateOfDeath: '', timeOfDeath: '' };
    const h24 = parseInt(m[4], 10);
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h = h24 % 12 || 12;
    return {
        dateOfDeath: `${m[3]}/${mon}/${m[1]}`,
        timeOfDeath: `${String(h).padStart(2, '0')}:${m[5]} ${ampm}`,
    };
};

// Morgue record -> one editable "body" row for the batch modal.
export const toMassRequestBody = (record) => {
    const { decedentName, oocName } = splitDecedentName(record?.name);
    let { dateOfDeath, timeOfDeath } = parseTimeOfDeath(record?.timeOfDeath);
    if (!dateOfDeath || !timeOfDeath) {
        const iso = parseIsoTimeOfDeath(record?.timeOfDeathISO);
        dateOfDeath = dateOfDeath || iso.dateOfDeath;
        timeOfDeath = timeOfDeath || iso.timeOfDeath;
    }
    return {
        // firebaseKey first: it is unique even if a caseId is ever duplicated.
        recordKey: String(record?.firebaseKey || record?.caseId || ''),
        caseId: String(record?.caseId || ''),
        decedentName,
        oocName,
        gender: String(record?.sex || ''),
        ethnicity: inferEthnicity(record),
        dateOfDeath,
        timeOfDeath,
        location: String(record?.location || ''),
        deathType: 'PK',
    };
};

// Records -> de-duplicated, ordered batch rows (one per selected morgue record).
export const toMassRequestBodies = (records = []) => {
    const seen = new Set();
    const out = [];
    for (const record of records) {
        const key = String(record?.firebaseKey || record?.caseId || '');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(toMassRequestBody(record));
        if (out.length >= MAX_MASS_BODIES) break;
    }
    return out;
};

/**
 * Title contract (parsed by parseMassTitle + isMassRequest):
 *   "[Mass Autopsy Request] Davis Shooting [LSPD]"
 * The leading bracket is what keeps TITLE_REGEX (singular) from matching.
 */
export const buildMassAutopsyTopicTitle = ({ incidentLabel, agency } = {}) => {
    const label = String(incidentLabel || '').trim() || 'Unnamed Incident';
    const tag = String(agency || '').trim().toUpperCase();
    return `[Mass Autopsy Request] ${label}${tag ? ` [${tag}]` : ''}`;
};

// Same agency derivation as the single modal: explicit pick, then a leading
// 3-5 letter department code ("LSPD - Homicide" -> LSPD), then PHMC.
export const deriveAgencyTag = ({ agencyForum, requesterDept } = {}) => {
    return String(agencyForum || '').trim().toUpperCase()
        || (String(requesterDept || '').match(/^([A-Z]{3,5})/) || [])[1]
        || 'PHMC';
};

/**
 * Build the f=265 mass request post. Shape is dictated by the bot parser:
 *   - Section 1: requester fields, parsed ONCE and shared (parseAutopsyRequestBbcode)
 *   - Section 2: one "--- BODY N ---" block per decedent, "1.) Decedent Name:"
 *     plus "7.) Type of Death:" (per-body PK/CK wins over the shared line)
 *   - Section 3/4: shared details + a single PK/CK fallback
 * Bodies with a blank field leave it blank on purpose so the bot records an
 * "incomplete" warning instead of silently filing D.N.A as real data.
 */
export const buildMassAutopsyRequestBBCode = ({ requester = {}, details = {}, bodies = [], incidentLabel = '' } = {}) => {
    const ans = (v) => String(v ?? '').trim() || DNA_VALUE;
    const raw = (v) => String(v ?? '').trim();

    const blocks = bodies.map((b, i) => {
        const ooc = raw(b.oocName);
        const name = `${raw(b.decedentName)}${ooc ? ` ((${ooc}))` : ''}`;
        // Blank optional lines are OMITTED, not written empty: the bot's field
        // regexes use \s* after the colon, so an empty value would swallow the
        // NEXT line's label as the value. Omitting the line is the only shape
        // that makes the bot record the field as missing/incomplete.
        const optional = [
            ['2.) Gender', b.gender],
            ['3.) Ethnicity', b.ethnicity],
            ['4.) Date of Death', b.dateOfDeath],
            ['5.) Time of Death', b.timeOfDeath],
            ['6.) Location', b.location],
        ].filter(([, value]) => raw(value));
        return `--- BODY ${i + 1} ---
[b]1.) Decedent Name:[/b] ${name}
${optional.map(([label, value]) => `[b]${label}:[/b] ${raw(value)}`).join('\n')}${optional.length ? '\n' : ''}[b]7.) Type of Death:[/b] ${b.deathType === 'CK' ? 'CK' : 'PK'}`;
    }).join('\n');

    const types = new Set(bodies.map((b) => (b.deathType === 'CK' ? 'CK' : 'PK')));
    // Never spell "SECTION n" in a field value: the bot's line scanner switches
    // section on any line containing it, which would drop the following fields.
    const sharedType = types.size === 1 ? [...types][0] : 'MIXED - SEE EACH BODY ABOVE';

    return `[divbox=grey][center][img]https://i.imgur.com/s5acD6S.png[/img][/center][/divbox]
[divbox=white]
[br][/br]
[center][b][size=170]MASS AUTOPSY REQUEST[/size][/b][/center]
[center][size=65]LOS SANTOS DEPARTMENT OF MEDICAL EXAMINER-CORONER[/size][/center]
[center][size=85]${raw(bodies.length)} ${bodies.length === 1 ? 'BODY' : 'BODIES'} — ONE CASE THREAD[/size][/center]
[color=transparent]SPACER[/color]
[hr][/hr]
[divbox=lightgrey][color=#800000][b]SECTION 1: REQUESTER'S INFORMATION[/b][/color][/divbox]
[divbox=white][b]1.) Name:[/b] ${ans(requester.name)}
[b]2.) Rank:[/b] ${ans(requester.rank)}
[b]3.) Department / Assignment:[/b] ${ans(requester.dept)}
[b]4.) Badge/Serial Number:[/b] ${ans(requester.badge)}
[b]5.) Read and understood [url=https://phmc.gta.world/viewtopic.php?t=9572]Autopsy Guidelines[/url][/b]: ${requester.guidelinesRead ? 'YES' : 'NO'}
[b]6.) Contact Information:[/b]:
[list][*]Cell Number: ${ans(requester.cell)}
[*]Forum Account: ${ans(requester.forumAccountUrl)}
[*](( Discord Name: ${ans(requester.discord)} ))[/list]

[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b]SECTION 2: DECEDENT'S INFORMATION[/b][/color][/divbox]
[divbox=white][size=85]Multiple bodies are listed as separate numbered blocks below. Each body is examined and assigned a Medical Examiner individually.[/size]
${blocks}
[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b]SECTION 3: DETAILS[/b][/color][/divbox]
[divbox=white][b]Incident / Operation:[/b] ${ans(incidentLabel)}
[b]1.) Synopsis:[/b] ${ans(details.synopsis)}
[b]2.) Reason for Autopsy:[/b] ${ans(details.causeDetail)}
[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b][ooc]SECTION 4: OOC INFORMATION[/ooc][/b][/color][/divbox]
[divbox=white][size=85](/cexamine and /cinjuries are no longer mandatory fields for PKs, post them if you happen to have them on hand. CKs have a mandatory cexamine and cinjuries)[/size]
[b]1.) PK/CK[/b]: ${sharedType}
[b]2.) /cexamine[/b]: ${raw(details.cexamineImg) ? `[img]${raw(details.cexamineImg)}[/img]` : 'Image not provided'}
[b]3.) /cinjuries[/b]: ${raw(details.cinjuriesImg) ? `[img]${raw(details.cinjuriesImg)}[/img]` : 'Image not provided'}
[/divbox][/divbox]`;
};

/**
 * Client-side guard mirroring the parser's skip rules. Returns the list of
 * problems that would park a whole post or drop a body, so the modal can block
 * submit (and the test can prove the builder never produces them).
 */
export const validateMassRequestBody = (body) => {
    const problems = [];
    const name = String(body?.decedentName || '').trim();
    const ooc = String(body?.oocName || '').trim();
    if (!name) problems.push('missing decedent name');
    // Same policy as parseMassRequestBbcode: a real IC name is an identity on
    // its own, but DOE/UNKNOWN needs the ((OOC)) to tell bodies apart.
    if (name && !ooc && /^(?:unknown|unidentified|j(?:ohn|ane)?\.?\s+doe)\b/i.test(name)) {
        problems.push('unidentified decedent needs an ((OOC)) name');
    }
    return problems;
};

/** Validate the whole batch the same way the modal does. */
export const validateMassRequest = ({ incidentLabel, requester = {}, bodies = [] } = {}) => {
    const missing = [];
    if (!String(incidentLabel || '').trim()) missing.push('Incident / operation name');
    if (!String(requester.name || '').trim()) missing.push("Requester name");
    if (!String(requester.rank || '').trim()) missing.push('Requester rank');
    if (!String(requester.dept || '').trim()) missing.push('Requester department');
    if (!String(requester.forumAccountUrl || '').trim()) missing.push('Forum account URL');
    if (bodies.length < 2) missing.push('At least 2 bodies selected');
    bodies.forEach((b, i) => {
        for (const p of validateMassRequestBody(b)) missing.push(`Body ${i + 1}: ${p}`);
    });
    return missing;
};

/**
 * Firebase payload for `autopsy-requests/pending`. Only topicTitle and
 * requestBBCode are consumed by the bot poster; the rest is diagnostics for
 * the queue and the admin tooling.
 */
export const buildMassAutopsyRequestPayload = ({
    requester = {}, details = {}, bodies = [], incidentLabel = '', characterName = '',
} = {}) => {
    const agency = deriveAgencyTag(requester);
    const label = String(incidentLabel || '').trim();
    return {
        isMass: true,
        isMassRequest: true,
        decedentCount: bodies.length,
        bodyCount: bodies.length,
        bodyCaseIds: bodies.map((b) => String(b.caseId || '')).filter(Boolean),
        // Compact per-body snapshot for the submission Discord embed (and
        // diagnostics). Intake still parses requestBBCode; this is display-only.
        bodies: bodies.map((b) => ({
            caseId: String(b.caseId || ''),
            name: String(b.decedentName || '').trim(),
            oocName: String(b.oocName || '').trim(),
            deathType: b.deathType === 'CK' ? 'CK' : 'PK',
        })),
        incidentLabel: label,
        // The poster's notification summarises the batch instead of naming one body.
        decedentName: `${bodies.length} ${bodies.length === 1 ? 'body' : 'bodies'} — ${label || 'Mass autopsy request'}`,
        oocName: '',
        // Requester / routing (same field names as the singular payload).
        requesterName: String(requester.name || '').trim(),
        requesterRank: String(requester.rank || '').trim(),
        requesterDept: String(requester.dept || '').trim(),
        requesterBadge: String(requester.badge || '').trim(),
        requesterCell: String(requester.cell || '').trim(),
        requesterDiscord: String(requester.discord || '').trim(),
        guidelinesRead: !!requester.guidelinesRead,
        agencyForum: agency === 'PHMC' ? '' : agency,
        forumAccountUrl: String(requester.forumAccountUrl || '').trim(),
        synopsis: String(details.synopsis || '').trim(),
        causeDetail: String(details.causeDetail || '').trim(),
        cexamineImg: String(details.cexamineImg || '').trim(),
        cinjuriesImg: String(details.cinjuriesImg || '').trim(),
        source: 'web-morgue',
        status: 'pending',
        createdAt: Date.now(),
        createdBy: characterName || null,
        topicTitle: buildMassAutopsyTopicTitle({ incidentLabel: label, agency }),
        requestBBCode: buildMassAutopsyRequestBBCode({ requester, details, bodies, incidentLabel: label }),
    };
};
