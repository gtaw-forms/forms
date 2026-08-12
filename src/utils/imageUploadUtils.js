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