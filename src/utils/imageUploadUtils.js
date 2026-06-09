import * as Sentry from "@sentry/react";
import { httpsCallableFromURL, getFunctions } from 'firebase/functions';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

const uploadImageProxyCallable = () => {
  const url = 'https://europe-west4-gtaw-forms.cloudfunctions.net/uploadImageProxy';
  return httpsCallableFromURL(getFunctions(), url);
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
  const uploadProxy = uploadImageProxyCallable();
  const result = await uploadProxy({ image, service, title });
  return result.data;
};

export const uploadImageToImgBB = async (file) => {
  try {
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

const isLikelyUK = () => {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language || "";
    return timeZone === 'Europe/London' || language.includes('en-GB');
  } catch (e) {
    return false;
  }
};

export const uploadImageWithFallback = async (file) => {
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

  const skipImgur = isLikelyUK();

  try {
    if (skipImgur) {
      console.log('[Upload] Likely UK user detected, skipping Imgur to avoid blocks...');
      throw new Error('Skipping Imgur (UK Region)');
    }

    // Try Imgur first as it is generally faster
    console.log('[Upload] Attempting Imgur upload...');
    const result = await Promise.race([
      uploadImageToImgur(file),
      timeout(10000) // 10s timeout for Imgur
    ]);
    return result;
  } catch (error) {
    if (!skipImgur) {
      console.warn(`[Upload] Imgur failed or timed out (${error.message}). Falling back to ImgBB...`);
      await logUploadFailureToDiscord(error, 'Imgur', 'Primary Upload Attempt');
    }

    try {
      // Fallback to ImgBB
      console.log('[Upload] Attempting ImgBB fallback...');
      const result = await uploadImageToImgBB(file);
      console.log('[Upload] ImgBB fallback successful.');
      return result;
    } catch (fallbackError) {
      console.error('[Upload] Both Imgur and ImgBB failed:', fallbackError);
      await logUploadFailureToDiscord(fallbackError, 'ImgBB', 'Fallback Upload Attempt');
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