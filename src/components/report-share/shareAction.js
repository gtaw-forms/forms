// One "Share" action for every report surface (records view, LEO reports).
//
// The share code is minted by the `ensureReportShareCode` callable: the reverse
// index (`shortLinksByReport/<author>/<key>`) is author-scoped in the RTDB rules,
// so a read-only viewer — an LEO officer opening a forwarded coroner report, or
// a colleague sharing someone else's work — cannot create it client-side. The
// fallback below keeps the old author path working if the callable is
// unreachable (e.g. undeployed), which is also how links behaved before.
//
// Both views call this so the labels, fallbacks and messages cannot drift.
import { ensureShareCode } from '../../utils/shareCodes';
import { buildShortReportUrl } from './shareLink';

export const SHARE_COPIED_MESSAGE = 'Share link copied.';
export const SHARE_NO_CODE_MESSAGE = 'Could not create a share link right now.';

/**
 * Resolve (or create) a report's short link, copy it, and report the outcome.
 *
 * @returns {Promise<{ ok: boolean, url?: string, error?: string }>}
 */
export async function copyReportShareLink({ author, key, formId = '', showNotification } = {}) {
    const notify = typeof showNotification === 'function' ? showNotification : () => {};
    if (!author || !key) {
        notify('No share link for this view.', 'error');
        return { ok: false, error: 'missing-report-address' };
    }

    let code = null;
    try {
        code = await ensureShareCode({ author, key, formId });
    } catch {
        code = null;
    }
    if (!code) {
        notify(SHARE_NO_CODE_MESSAGE, 'error');
        return { ok: false, error: 'no-code' };
    }

    const url = buildShortReportUrl(code);
    try {
        await navigator.clipboard.writeText(url);
        notify(SHARE_COPIED_MESSAGE, 'success');
    } catch {
        // Clipboard blocked (insecure context / permissions): show the link so
        // the user can copy it by hand instead of losing it.
        notify(`Copy this link: ${url}`, 'success', 15000);
    }
    return { ok: true, url };
}
