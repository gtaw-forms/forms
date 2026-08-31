/**
 * completionTemplate.js — Shared autopsy completion reply template.
 *
 * Single source of truth for the completion notice posted to the original
 * autopsy request topic (f=265). Used by the main completion flow
 * (deployAutopsyReply.js), the interactive picker path (deployInteraction.js)
 * and the manual force command (force-autopsy-send.js).
 */

export const COMPLETION_TEMPLATE = `[divbox=white][center][img]https://i.imgur.com/Hxjt4M2.png[/img][/center][/divbox]

[divbox=white]
Dear REQUESTER_NAME

We have completed the autopsy investigation, and the detailed report has been sent out. I have thoroughly reviewed all findings and compiled the results into a comprehensive document. Please review the report at your earliest convenience, and feel free to reach out if you have any questions or require further information.

[b]Autopsy Findings will be sent to your respective Gov Intranet. GOV_LINK_LINE [/b]

[i]Best regards,[/i]
[hr][/hr]
[b]Office of Forensic Medicine Division[/b]
Department of Forensic Medicine and Pathology

[b]Pillbox Hill Medical Center[/b]
[size=85]Elgin Ave/Strawberry Ave, Los Santos, SA
Ph: 50056
Mail: [url=https://phmc.gta.world/ucp.php?i=pm&mode=compose&u=your_id]medical.examiners@phmc.health[/url]
Website: [url]www.phmc.health[/url][/size]

[center][img]https://i.imgur.com/vztjYpe.png[/img][/center]`;

/**
 * Build the completion reply BBCode for the original request topic (f=265).
 *
 * The "Gov Intranet" line is faction-specific:
 *   - completionUrl set → direct completion-reply link on the requesting
 *     faction's own forum (param keeps the historical name `lssdUrl` for
 *     back-compat with the picker/force-copy callers)
 *   - faction 'lssd' → LSSD CASELINK/records fallback
 *   - faction 'sadcr'/'dao' → agency Autopsy Records subforum link
 *     (SADCR f=2328 / DAO f=2331 live on the shared lssd.gta.world domain)
 *   - faction 'lspd' → direct LSPD topic link (lspdUrl) or the f=1361 forum
 *   - otherwise      → tells the requester to check their PHMC Intranet Inbox
 *
 * @param {string} caseTitle — case title (reserved; template has no CASE_TITLE slot)
 * @param {string} requesterName — requester for the template
 * @param {object|string|null} [linkContext] — { faction, lssdUrl, lspdUrl }, or a
 *   plain string treated as the completion reply URL (backward compat)
 * @returns {string}
 */
import { FORUM_FALLBACK_URLS } from './agencyForums.js';

export function buildCompletionBb(caseTitle, requesterName, linkContext = {}) {
    const ctx = typeof linkContext === 'string' ? { lssdUrl: linkContext } : (linkContext || {});
    const { faction, lssdUrl, lspdUrl } = ctx;
    const f = String(faction || '').toLowerCase();
    const facTag = String(faction || '').toUpperCase();

    let govLine;
    if (lssdUrl) {
        const agencyLabel = ['lssd', 'sadcr', 'dao'].includes(f) ? facTag : 'LSSD';
        govLine = `For ${agencyLabel}, please review your completed report here: [url]${lssdUrl}[/url]`;
    } else if (f === 'lssd') {
        govLine = 'For LSSD, please review your completed report here: the CASELINK PORTAL or LSSD Autopsy Records';
    } else if (f === 'sadcr' || f === 'dao') {
        govLine = `For ${facTag}, please review your completed report in the ${facTag} Autopsy Records forum: [url=${FORUM_FALLBACK_URLS[facTag]}]${facTag} Autopsy Records[/url]`;
    } else if (f === 'lspd') {
        govLine = lspdUrl
            ? `For LSPD, please review your completed report here: [url]${lspdUrl}[/url]`
            : 'For LSPD, please navigate to [url]https://lspd.gta.world/viewforum.php?f=1361[/url]';
    } else {
        govLine = 'The completed report has been delivered to your PHMC Intranet Inbox. Please check there for the autopsy findings.';
    }

    return COMPLETION_TEMPLATE
        .replace('CASE_TITLE', caseTitle)
        .replace('REQUESTER_NAME', requesterName)
        .replace('GOV_LINK_LINE', govLine);
}
