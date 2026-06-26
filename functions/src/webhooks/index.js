import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getConfigValue } from "../utils/config.js";
import { sendWebhook } from "../utils/helpers.js";

initializeApp();

const WEBHOOK_URL_MAP = {
  admin:   "admin",
  auth:    "auth",
  forms:   "forms",
  error:   "error",
  cctv_dev: "cctv_dev",
  cctv_leo: "cctv_leo",
  coroner: "coroner",
  morgue_search: "admin",
  phmc:    "phmc",
  dev:     "dev",
};

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

  let url;

  if (webhookId) {
    const snapshot = await getDatabase().ref(`webhooks/${webhookId}`).get();
    if (!snapshot.exists()) {
      throw new functions.https.HttpsError(
        "not-found",
        `Webhook not found: ${webhookId}`
      );
    }
    url = snapshot.val().url;
  } else {
    const configKey = WEBHOOK_URL_MAP[webhookType];
    if (!configKey) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Unknown webhook type: ${webhookType}`
      );
    }

    url = getConfigValue(configKey);
    if (!url) {
      console.error(`[sendWebhookProxy] No URL configured for type: ${webhookType} (key: ${configKey})`);
      throw new functions.https.HttpsError(
        "not-found",
        `Webhook URL not configured for type: ${webhookType}`
      );
    }
  }

  const urlLog = url ? `${url.substring(0, 50)}...` : 'NOT SET';
  console.log(
    `[sendWebhookProxy] Dispatching ${webhookType} webhook${webhookId ? ` (custom: ${webhookId})` : ''} | URL: ${urlLog} | Auth: ${!!request.auth} | UID: ${request.auth?.uid || "none"}`
  );

  try {
    const result = await sendWebhook(payload, url);
    if (!result) {
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
});
