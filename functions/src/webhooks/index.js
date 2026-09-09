import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { sendWebhook } from "../utils/helpers.js";

initializeApp();

const MORGUE_API_URL = process.env.MORGUE_API_URL || 'http://88.208.243.254';
const MORGUE_API_KEY = process.env.MORGUE_API_KEY;

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
  cors: [
    'https://gtaw-forms.github.io',
    'https://phmc-tools.gta.world',
    'http://localhost:3000'
  ],
  secrets: ["PHMC_CONFIG"]
}, async (request) => {
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
  const channelKey = CHANNEL_MAP[webhookType];
  if (!channelKey) {
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
      signal: AbortSignal.timeout(15000),
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
