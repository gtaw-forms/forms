// ──────────────────────────────────────────
// Client-IP resolution + reverse-proxy trust
// ──────────────────────────────────────────
// Why this exists (2026-10-24 incident): `X-Forwarded-For` is client-writable.
// morgue-api used to take its LEFTMOST token, so a scanner that sent
// `X-Forwarded-For: 127.0.0.1` was logged as loopback. Loopback is a trusted
// IP, so the keyless-404 instant ban, the strike counter and the suspicious
// alert were all skipped — 418 distinct scanned paths went unattributed and
// unbanned (see 185.177.72.29 in the 2026-10-24 Stripe sweep).
//
// Rules enforced here:
//   1. Forwarded headers are honoured ONLY when the direct socket peer is a
//      trusted proxy (loopback, i.e. nginx on the same host, or an explicit
//      MORGUE_API_TRUSTED_PROXIES entry).
//   2. `X-Real-IP` wins over XFF because nginx overwrites it with $remote_addr.
//   3. An XFF chain is read RIGHT to LEFT: the rightmost hop is the one our
//      own proxy appended, so attacker-supplied leftmost values are ignored.
//   4. A direct caller that sends either header at all is spoofing — that is
//      reported by detectForwardedSpoof() so callers can ban it.

import { isIP } from 'net';

/** Strip IPv6-mapped IPv4 prefixes and whitespace. */
export function normalizeIp(value) {
    if (value == null) return '';
    let s = String(value).trim();
    if (!s) return '';
    if (s.startsWith('::ffff:')) s = s.slice(7);
    return s;
}

/** True for 127.0.0.0/8 and ::1. */
export function isLoopbackIp(value) {
    const ip = normalizeIp(value);
    if (!ip) return false;
    if (ip === '::1') return true;
    return isIP(ip) === 4 && /^127\./.test(ip);
}

/**
 * Parse MORGUE_API_TRUSTED_PROXIES ("10.0.0.5,100.64.0.1") into a Set.
 * Loopback is always trusted and does not need to be listed.
 */
export function parseTrustedProxies(raw) {
    return new Set(
        String(raw || '')
            .split(',')
            .map(s => normalizeIp(s))
            .filter(Boolean)
    );
}

/** True when the direct TCP peer is allowed to set forwarded headers. */
export function isTrustedProxyPeer(peer, trustedProxies = new Set()) {
    const p = normalizeIp(peer);
    if (!p) return false;
    if (isLoopbackIp(p)) return true;
    return trustedProxies.has(p);
}

function firstValidIp(headerValue) {
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const first = String(raw || '').split(',')[0].trim();
    return isIP(first) ? first : '';
}

function socketPeer(req) {
    return normalizeIp(req?.socket?.remoteAddress || req?.connection?.remoteAddress || '');
}

/**
 * Resolve the client IP for a request.
 * Never returns a value an unauthenticated caller could have chosen, except
 * when the peer is a trusted proxy that set the header itself.
 */
export function getClientIp(req, trustedProxies = new Set()) {
    const peer = socketPeer(req);
    if (isTrustedProxyPeer(peer, trustedProxies)) {
        const realIp = firstValidIp(req?.headers?.['x-real-ip']);
        if (realIp) return realIp;

        const chain = String(req?.headers?.['x-forwarded-for'] || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        for (let i = chain.length - 1; i >= 0; i -= 1) {
            if (isIP(chain[i])) return chain[i];
        }
    }
    return peer || 'unknown';
}

/**
 * Detect a caller that is NOT a trusted proxy but sent forwarding headers.
 * Returns { header, value } or null.
 */
export function detectForwardedSpoof(req, trustedProxies = new Set()) {
    const peer = socketPeer(req);
    if (isTrustedProxyPeer(peer, trustedProxies)) return null;
    // eslint-disable-next-line no-control-regex -- sanitizes attacker-controlled header before logging
    const clean = (v) => String(v || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 120);

    const xff = clean(req?.headers?.['x-forwarded-for']);
    if (xff) return { header: 'x-forwarded-for', value: xff };

    const xri = clean(req?.headers?.['x-real-ip']);
    if (xri) return { header: 'x-real-ip', value: xri };

    return null;
}
