import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { sendWebhook } from "../utils/helpers.js";

initializeApp();

const MORGUE_API_URL = process.env.MORGUE_API_URL || 'http://88.208.243.254';
const MORGUE_API_KEY = process.env.MORGUE_API_KEY;

// P0 (c) cost plan: per-UID token bucket (best-effort, per instance). 10 calls
// per rolling 60s; over that → resource-exhausted, fail-closed, no retry.
const RATE_WINDOW_MS = 60000;
const RATE_MAX_CALLS = 10;
const rateBuckets = new Map(); // uid -> number[] (epoch ms of recent calls)
function checkWebhookRateLimit(uid) {
  const now = Date.now();
  const calls = (rateBuckets.get(uid) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (calls.length >= RATE_MAX_CALLS) {
    rateBuckets.set(uid, calls);
    return false;
  }
  calls.push(now);
  if (rateBuckets.size > 5000) rateBuckets.clear();
  rateBuckets.set(uid, calls);
  return true;
}

// Fixed webhook types deliver bot-natively: type -> morgue-api channel key.
// (morgue-api owns the key->channel-ID allowlist; unknown keys are rejected
// there too.) Custom per-agency entries (webhookId path below) still resolve
// legacy webhook URLs until the admin UI migrates to channel IDs.
const CHANNEL_MAP = {
  admin:   "admin",
  auth:    "auth",
  forms:   "forms",
  error:   "error",
  coroner: "coroner",
  morgue_search: "admin",
  phmc:    "phmc",
  dev:     "dev",
};

/**
 * Failure-path only: GET the webhook URL to check whether Discord reports it
 * as deleted (404 + code 10015). Never throws; false = unknown/other failure.
 * (Legacy webhookId path only — fixed types no longer touch Discord.)
 */
async function isWebhookDeleted(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.status !== 404) return false;
    const body = await res.text().catch(() => "");
    return body.includes("10015") || body.includes("Unknown Webhook");
  } catch {
    return false;
  }
}

export const sendWebhookProxy = onCall({
  region: "europe-west2",
  memory: "256MiB",
  cors: [
    'https://gtaw-forms.github.io',
    'https://phmc-tools.gta.world',
    'http://localhost:3000'
  ],
  secrets: ["PHMC_CONFIG"]
}, async (request) => {
  // P0 (c) cost plan: this proxy was anonymously postable and unthrottled.
  // All callers (web app, logging pipeline) run authed — fail closed otherwise.
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  if (!checkWebhookRateLimit(request.auth.uid)) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Webhook rate limit exceeded. Try again in a minute."
    );
  }

  const { webhookType, payload, webhookId } = request.data;

  if (!webhookType || !payload) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "webhookType and payload are required."
    );
  }

  // ── Legacy custom-webhook path (RTDB webhooks/<id> = { url }) ──
  // Deprecated: pending admin-UI migration to channel IDs. Still served so
  // the WebhookManager test buttons keep working until then.
  if (webhookId) {
    const snapshot = await getDatabase().ref(`webhooks/${webhookId}`).get();
    if (!snapshot.exists()) {
      throw new functions.https.HttpsError(
        "not-found",
        `Webhook not found: ${webhookId}`
      );
    }
    const url = snapshot.val()?.url;
    if (!url) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Webhook '${webhookId}' has no URL stored at webhooks/${webhookId} — add its url field.`
      );
    }
    console.log(
      `[sendWebhookProxy] Dispatching ${webhookType} webhook (legacy custom: ${webhookId}) | Auth: ${!!request.auth} | UID: ${request.auth?.uid || "none"}`
    );
    try {
      const result = await sendWebhook(payload, url);
      if (!result) {
        if (await isWebhookDeleted(url)) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Discord webhook '${webhookId}' no longer exists (Unknown Webhook) — it was deleted or rotated.`
          );
        }
        throw new Error("sendWebhook returned false");
      }
      return { success: true, webhookType };
    } catch (error) {
      console.error(`[sendWebhookProxy] Failed to send ${webhookType} webhook:`, error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to forward webhook: ${error.message}`
      );
    }
  }

  // ── Bot-native path (fixed types) ──
  const channelKey = CHANNEL_MAP[webhookType];  if (!channelKey) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Unknown webhook type: ${webhookType}`
    );
  }
  if (!MORGUE_API_KEY) {
    console.error("[sendWebhookProxy] MORGUE_API_KEY is not set — cannot reach notify transport.");
    throw new functions.https.HttpsError(
      "internal",
      "Server configuration error."
    );
  }

  console.log(
    `[sendWebhookProxy] Dispatching ${webhookType} via bot (channel: ${channelKey}) | Auth: ${!!request.auth} | UID: ${request.auth?.uid || "none"}`
  );

  try {
    const res = await fetch(`${MORGUE_API_URL}/api/notify`, {
      method: "POST",
      headers: { "x-api-key": MORGUE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: channelKey,
        content: payload.content,
        embeds: payload.embeds,
      }),
      // P0 (c) cost plan: 5s (was 15s) — observability posts are fire-and-forget.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[sendWebhookProxy] Notify transport returned ${res.status}: ${text.slice(0, 300)}`);
      if (res.status === 400) {
        throw new functions.https.HttpsError("invalid-argument", "Bad notify payload.");
      }
      throw new functions.https.HttpsError("internal", "Bot notify transport failed.");
    }
    return { success: true, webhookType };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error(`[sendWebhookProxy] Failed to send ${webhookType} via bot:`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to forward via bot: ${error.message}`
    );
  }
});

/**
 * appendTelemetry — hourly client-telemetry beacon transport.
 *
 * The browser accumulates data-request telemetry locally and flushes one
 * aggregate per hour. This callable validates + sanitizes the aggregate and
 * appends it to the VPS JSONL store (data/telemetry.jsonl), which the bot's
 * hourly rollup reads. 1 invocation/client/hour; the bot posts ONE rollup.
 * Replaces per-event sendWebhookProxy telemetry (useWebhooks.js).
 */
const TELEMETRY_NUM_FIELDS = ['events', 'cacheHits', 'network', 'errors', 'inactive', 'totalKb', 'netKb'];

const cleanTelemetryNum = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 1e7 ? num : null;
};

const cleanTelemetryStr = (value, max = 200) => {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex -- strips control chars from untrusted telemetry strings (ban-evasion + log-injection defense)
  const clean = value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, max);
  return clean || null;
};

export const appendTelemetry = onCall({
  region: "europe-west2",
  memory: "256MiB",
  timeoutSeconds: 30,
  cors: [
    'https://gtaw-forms.github.io',
    'https://phmc-tools.gta.world',
    'http://localhost:3000'
  ],
}, async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!checkWebhookRateLimit(`telemetry:${request.auth.uid}`)) {
    throw new functions.https.HttpsError('resource-exhausted', 'Telemetry rate limit exceeded.');
  }
  if (!MORGUE_API_KEY) {
    throw new functions.https.HttpsError('internal', 'Server configuration error.');
  }

  const body = request.data || {};
  const clean = {};
  for (const field of TELEMETRY_NUM_FIELDS) {
    const num = cleanTelemetryNum(body[field]);
    if (num === null) {
      throw new functions.https.HttpsError('invalid-argument', `bad telemetry field: ${field}`);
    }
    clean[field] = num;
  }
  if (body.byTrigger !== undefined) {
    if (!body.byTrigger || typeof body.byTrigger !== 'object' || Array.isArray(body.byTrigger)) {
      throw new functions.https.HttpsError('invalid-argument', 'bad telemetry field: byTrigger');
    }
    clean.byTrigger = {};
    for (const [key, val] of Object.entries(body.byTrigger).slice(0, 20)) {
      const count = cleanTelemetryNum(val);
      const cleanKey = cleanTelemetryStr(key, 80);
      if (count === null || !cleanKey || count > 1e6) {
        throw new functions.https.HttpsError('invalid-argument', 'bad telemetry field: byTrigger value');
      }
      clean.byTrigger[cleanKey] = count;
    }
  } else {
    clean.byTrigger = {};
  }
  // Per-user activity rows ("who did what") for the V2 rollup. Sanitized, never
  // strict: a single bad user row defaults to zeros rather than dropping the
  // whole beacon (the aggregate counters above already guard the important path).
  if (body.userActivity !== undefined) {
    if (!body.userActivity || typeof body.userActivity !== 'object' || Array.isArray(body.userActivity)) {
      throw new functions.https.HttpsError('invalid-argument', 'bad telemetry field: userActivity');
    }
    clean.userActivity = {};
    const numOrZero = (v) => { const n = cleanTelemetryNum(v); return n === null ? 0 : Math.min(n, 1e7); };
    for (const [user, act] of Object.entries(body.userActivity).slice(0, 20)) {
      const cleanUser = cleanTelemetryStr(user, 80);
      if (!cleanUser || !act || typeof act !== 'object') continue;
      clean.userActivity[cleanUser] = {
        events: numOrZero(act.events),
        errors: numOrZero(act.errors),
        cacheHits: numOrZero(act.cacheHits),
        network: numOrZero(act.network),
        totalKb: numOrZero(act.totalKb),
        netKb: numOrZero(act.netKb),
        routes: (Array.isArray(act.routes) ? act.routes : []).slice(0, 10)
          .map((v) => cleanTelemetryStr(v, 80))
          .filter(Boolean),
      };
    }
  } else {
    clean.userActivity = {};
  }
  for (const field of ['routes', 'users', 'errorSamples']) {
    const arr = body[field];
    if (arr !== undefined && !Array.isArray(arr)) {
      throw new functions.https.HttpsError('invalid-argument', `bad telemetry field: ${field}`);
    }
    clean[field] = (Array.isArray(arr) ? arr : []).slice(0, 30)
      .map((v) => cleanTelemetryStr(v))
      .filter(Boolean);
  }

  try {
    const res = await fetch(`${MORGUE_API_URL}/api/telemetry`, {
      method: "POST",
      headers: { "x-api-key": MORGUE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(clean),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[appendTelemetry] VPS returned ${res.status}: ${text.slice(0, 200)}`);
      throw new functions.https.HttpsError('internal', 'Telemetry store failed.');
    }
    return { success: true };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('[appendTelemetry] Forward failed:', error.message);
    throw new functions.https.HttpsError('internal', 'Telemetry store failed.');
  }
});
