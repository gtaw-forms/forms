import * as Sentry from "@sentry/react";
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { sendDiscordWebhook } from './webhookUtils';

const logUploadFailureToDiscord = async (error, service, context) => {
  const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_ERRORS || import.meta.env.VITE_DEV_WEBHOOK;
  if (!webhookUrl) return;

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
    await sendDiscordWebhook(webhookUrl, payload);
  } catch (e) {
    console.error("Failed to log upload failure to Discord:", e);
  }
};

export const uploadImageToImgBB = async (file) => {
  try {
    const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const uploadProxy = httpsCallable(functions, 'uploadImageProxy');
    const result = await uploadProxy({
        image: base64Image,
        service: 'imgbb'
    });

    const data = result.data;

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

    const uploadProxy = httpsCallable(functions, 'uploadImageProxy');
    const result = await uploadProxy({
        image: base64Image,
        service: 'imgur'
      });

    const data = result.data;

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
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

  try {
    // Try ImgBB with a 15 second timeout
    console.log('[Upload] Attempting ImgBB upload...');
    const result = await Promise.race([
      uploadImageToImgBB(file),
      timeout(15000)
    ]);
    return result;
  } catch (error) {
    console.warn(`[Upload] ImgBB failed or timed out (${error.message}). Falling back to Imgur...`);
    await logUploadFailureToDiscord(error, 'ImgBB', 'Primary Upload Attempt');

    try {
      // Fallback to Imgur
      const result = await uploadImageToImgur(file);
      console.log('[Upload] Imgur fallback successful.');
      return result;
    } catch (fallbackError) {
      console.error('[Upload] Both ImgBB and Imgur failed:', fallbackError);
      await logUploadFailureToDiscord(fallbackError, 'Imgur', 'Fallback Upload Attempt');
      throw new Error('All image upload services failed. Please try again or check your connection.');
    }
  }
};

export const uploadDataUrlToImgBB = async (dataUrl) => {
  try {
    const base64Image = dataUrl.split(',')[1];

    const uploadProxy = httpsCallable(functions, 'uploadImageProxy');
    const result = await uploadProxy({
        image: base64Image,
        service: 'imgbb'
    });

    const data = result.data;

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

export const uploadImageToImgBBWithProgress = (file, onProgress) => {
    return new Promise((resolve, reject) => {
        const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
        if (!apiKey) {
            reject(new Error("ImgBB API Key is missing"));
            return;
        }

        const formData = new FormData();
        formData.append("image", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://api.imgbb.com/1/upload?key=${apiKey}`);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        resolve({
                            url: response.data.url,
                            thumb: response.data.thumb?.url || response.data.url
                        });
                    } else {
                        reject(new Error(response.error?.message || "Upload failed"));
                    }
                } catch (e) {
                    reject(new Error("Invalid JSON response"));
                }
            } else {
                reject(new Error(`HTTP Error ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network Error"));
        xhr.send(formData);
    });
};