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

[b]Autopsy Findings will be sent to your respective Gov Intranet. For LSPD, please navigate to [url]https://lspd.gta.world/viewforum.php?f=1361[/url] and for LSSD please review your completed report here: LSSD_COMPLETION_LINK [/b]

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
 * LSSD requests post their combined completion + report to the LSSD forum first,
 * so a direct link to that reply can be embedded here (LSSD_COMPLETION_LINK).
 * Falls back to the static CASELINK text when no LSSD post URL is available.
 *
 * @param {string} caseTitle — case title for the template
 * @param {string} requesterName — requester for the template
 * @param {string|null} lssdUrl — direct URL of the posted LSSD reply, if any
 * @returns {string}
 */
export function buildCompletionBb(caseTitle, requesterName, lssdUrl) {
    const lssdLink = lssdUrl
        ? `[url]${lssdUrl}[/url]`
        : 'the CASELINK PORTAL or LSSD Autopsy Records';
    return COMPLETION_TEMPLATE
        .replace('CASE_TITLE', caseTitle)
        .replace('REQUESTER_NAME', requesterName)
        .replace('LSSD_COMPLETION_LINK', lssdLink);
}
