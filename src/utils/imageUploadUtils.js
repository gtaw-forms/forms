import * as Sentry from "@sentry/react";
import { httpsCallableFromURL, getFunctions } from 'firebase/functions';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

const uploadImageProxyCallable = () => {
  const url = 'https://europe-west4-gtaw-forms.cloudfunctions.net/uploadImageProxy';
  return httpsCallableFromURL(getFunctions(), url);
};

// P2 (j) cost plan: pre-flight reject before invoking the proxy. The callable
// hard-caps at a 10 MB request and the server rejects >12 MB base64 — a ~7 MB
// base64 ceiling (~5 MB raw file) fails fast locally instead of burning a
// 512MiB/120s invocation on a deterministic failure.
const MAX_PROXY_BASE64_LEN = 7 * 1024 * 1024;
const assertUploadableSize = (base64Image, what) => {
  if (typeof base64Image === 'string' && base64Image.length > MAX_PROXY_BASE64_LEN) {
    throw new Error(
      `${what || 'Image'} is too large (${(base64Image.length / 1024 / 1024).toFixed(1)} MB). Please use an image under ~5 MB.`
    );
  }
};

const logUploadFailureToDiscord = async (error, service, context) => {
  const payload = {
    embeds: [{
      title: "🚨 Image Upload Failure",
      color: 0xff0000,
      fields: [
        { name: "Service", value: service, inline: true },
        { name: "Context", value: context, inline: true },
        { name: "Error", value: error.message || String(error), inline: false },
        { name: "User", value: window.location.hostname, inline: true },
        { name: "Timestamp", value: new Date().toISOString(), inline: true }
      ]
    }]
  };

  try {
    await triggerWebhookProxy('error', payload);
  } catch (e) {
    console.error("Failed to log upload failure to Discord:", e);
  }
};

const callUploadImageProxy = async (image, service, title) => {
  // Single choke point: covers File and data-URL paths alike.
  assertUploadableSize(image, 'Image');
  const uploadProxy = uploadImageProxyCallable();
  const result = await uploadProxy({ image, service, title });
  return result.data;
};

export const uploadImageToImgBB = async (file) => {
  try {
    if (file?.size > 5 * 1024 * 1024) {
      throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use an image under ~5 MB.`);
    }
    const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const data = await callUploadImageProxy(base64Image, 'imgbb');

    if (data.success) {
      return { url: data.url, thumb: data.thumb || data.url };
    }
    else {
      console.error('ImgBB proxy upload failed:', data.error);
      throw new Error(`ImgBB upload failed: ${data.error}`);
    }
  } catch (error) {
    console.error('Upload failed:', error);
    Sentry.captureException(error, { extra: { context: 'imageUploadUtils proxy' } });
    throw error;
  }
};

export const uploadImageToImgur = async (file) => {
  try {
    if (file?.size > 5 * 1024 * 1024) {
      throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use an image under ~5 MB.`);
    }
    const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const data = await callUploadImageProxy(base64Image, 'imgur');

    if (data.success) {
      return { url: data.url, thumb: data.url };
    }
    else {
      console.error('Imgur proxy upload failed:', data.error);
      throw new Error(`Imgur upload failed: ${data.error}`);
    }
  } catch (error) {
    console.error('Imgur upload failed:', error);
    Sentry.captureException(error, { extra: { context: 'imageUploadUtils imgur proxy' } });
    throw error;
  }
};

export const uploadImageWithFallback = async (file) => {
  try {
    // Use ImgBB as primary — Imgur is frequently blocked from cloud provider IP ranges
    // and the fallback system already catches it, but there's no point trying a service
    // that consistently fails.
    console.log('[Upload] Attempting ImgBB upload...');
    const result = await uploadImageToImgBB(file);
    return result;
  } catch (error) {
    // Last-resort: try Imgur in case ImgBB is temporarily down
    console.warn(`[Upload] ImgBB failed (${error.message}). Falling back to Imgur...`);
    try {
      const result = await uploadImageToImgur(file);
      return result;
    } catch (fallbackError) {
      console.error('[Upload] Both ImgBB and Imgur failed:', fallbackError);
      throw new Error('All image upload services failed. Please try again or check your connection.');
    }
  }
};

export const uploadDataUrlToImgBB = async (dataUrl) => {
  try {
    const base64Image = dataUrl.split(',')[1];

    const data = await callUploadImageProxy(base64Image, 'imgbb');

    if (data.success) {
      return { url: data.url, thumb: data.thumb || data.url };
    }
    else {
      console.error('ImgBB proxy upload failed:', data.error);
      throw new Error(`ImgBB upload failed: ${data.error}`);
    }
  } catch (error) {
    console.error('Upload failed:', error);
    Sentry.captureException(error, { extra: { context: 'imageUploadUtils dataUrl proxy' } });
    throw error;
  }
};

// If uploadToImgBB is distinct, define it here, otherwise use uploadImageToImgBB
export const uploadToImgBB = uploadImageToImgBB;