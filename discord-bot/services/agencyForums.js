/**
 * agencyForums.js — Faction registry for autopsy agency crossposting.
 *
 * Single source of truth for which agency forum each faction's autopsy
 * requests live in. All three forums are subforums of lssd.gta.world, so
 * crossposting reuses the FORUM_LSSD_* credentials/session everywhere.
 *
 * Used by:
 *   - autopsyRequestMonitor.js  (request-topic search/create + acknowledgement)
 *   - deployAutopsyReply.js     (combined completion+report reply target)
 *   - completionTemplate.js     (Gov Intranet link line)
 *   - requesterWebhook.js       (CASELINK button URLs)
 */

export const AGENCY_FORUM_BASE_URL = 'https://lssd.gta.world';

/** Faction -> forum id for autopsy request/completion threads. */
export const AGENCY_FORUMS = {
    LSSD: 2263,
    SADCR: 2328,
    DAO: 2331,
};

/** Faction -> forum listing URL (button/link fallback when no topic id exists). */
export const FORUM_FALLBACK_URLS = {
    LSSD: 'https://lssd.gta.world/viewforum.php?f=2263',
    SADCR: 'https://lssd.gta.world/viewforum.php?f=2328',
    DAO: 'https://lssd.gta.world/viewforum.php?f=2331',
};

/**
 * Faction -> Firebase field on autopsy-requested/<topicId> holding the
 * agency request-topic id. lssdRequestTopicId predates this registry and
 * keeps its name for back-compat.
 */
export const REQUEST_TOPIC_ID_FIELD = {
    LSSD: 'lssdRequestTopicId',
    SADCR: 'sadcrRequestTopicId',
    DAO: 'daoRequestTopicId',
};

/**
 * Faction -> forum credential env prefix. SADCR/DAO forums physically sit on
 * the LSSD domain, so they authenticate with the same FORUM_LSSD_* account.
 * LSPD keeps its own prefix for when/if f=1361 joins the registry.
 */
export const AGENCY_CRED_PREFIX = {
    LSSD: 'LSSD',
    SADCR: 'LSSD',
    DAO: 'LSSD',
};

/**
 * Resolve the agency forum config for a faction key.
 * @param {string} factionKey — e.g. 'LSSD' | 'SADCR' | 'DAO'
 * @returns {{ forumId: number, baseUrl: string, topicField: string, credPrefix: string } | null}
 */
export function getAgencyForum(factionKey) {
    const key = String(factionKey || '').toUpperCase();
    const forumId = AGENCY_FORUMS[key];
    if (!forumId) return null;
    return {
        forumId,
        baseUrl: AGENCY_FORUM_BASE_URL,
        topicField: REQUEST_TOPIC_ID_FIELD[key],
        credPrefix: AGENCY_CRED_PREFIX[key] || 'LSSD',
    };
}

/** True when the faction has a registry entry in the shared agency domain. */
export function isAgencyFaction(factionKey) {
    return !!AGENCY_FORUMS[String(factionKey || '').toUpperCase()];
}
