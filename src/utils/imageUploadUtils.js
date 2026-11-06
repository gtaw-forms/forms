import * as Sentry from "@sentry/react";
import { httpsCallableFromURL, getFunctions } from 'firebase/functions';

/**
 * Image uploads go through the `uploadImageProxy` Cloud Function, which files
 * every image in the `Coroners` album on ImgLink.cc. The API key stays
 * server-side; the browser only ever sends base64 to the callable.
 */

const uploadImageProxyCallable = () => {
  const url = 'https://europe-west4-gtaw-forms.cloudfunctions.net/uploadImageProxy';
  return httpsCallableFromURL(getFunctions(), url);
};

// P2 (j) cost plan: pre-flight reject before invoking the proxy. The callable
// hard-caps at a 10 MB request, so a ~7 MB base64 ceiling (~5 MB raw file)
// fails fast locally instead of burning a 512MiB/120s invocation on a
// deterministic failure.
const MAX_PROXY_BASE64_LEN = 7 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const assertUploadableSize = (base64Image) => {
  if (typeof base64Image === 'string' && base64Image.length > MAX_PROXY_BASE64_LEN) {
    throw new Error(
      `Image is too large (${(base64Image.length / 1024 / 1024).toFixed(1)} MB). Please use an image under ~5 MB.`
    );
  }
};

const assertFileSize = (file) => {
  if (file?.size > MAX_FILE_BYTES) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please use an image under ~5 MB.`);
  }
};

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const callUploadImageProxy = async (image) => {
  // Single choke point: covers File and data-URL paths alike.
  assertUploadableSize(image);
  const uploadProxy = uploadImageProxyCallable();
  const result = await uploadProxy({ image });
  return result.data;
};

/** Normalise the proxy response into the shape callers consume. */
const toUploadResult = (data) => {
  if (!data?.success || !data?.url) {
    const detail = data?.error || 'the image host returned no URL';
    console.error('[Upload] ImgLink proxy upload failed:', detail);
    throw new Error(`Image upload failed: ${detail}`);
  }
  return {
    url: data.url,
    thumb: data.thumb || data.url,
    viewer: data.viewer || null,
  };
};

/** Upload a File/Blob and return its ImgLink URL. */
export const uploadImageToImgLink = async (file) => {
  try {
    assertFileSize(file);
    const base64Image = await readFileAsBase64(file);
    const data = await callUploadImageProxy(base64Image);
    return toUploadResult(data);
  } catch (error) {
    console.error('[Upload] ImgLink upload failed:', error);
    Sentry.captureException(error, { extra: { context: 'imageUploadUtils imglink file' } });
    throw error;
  }
};

/** Upload a data URL (e.g. a canvas render) and return its ImgLink URL. */
export const uploadDataUrlToImgLink = async (dataUrl) => {
  try {
    if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
      throw new Error('Image data is not a valid data URL.');
    }
    const base64Image = dataUrl.split(',')[1];
    const data = await callUploadImageProxy(base64Image);
    return toUploadResult(data);
  } catch (error) {
    console.error('[Upload] ImgLink upload failed:', error);
    Sentry.captureException(error, { extra: { context: 'imageUploadUtils imglink dataUrl' } });
    throw error;
  }
};

/** Back-compat alias: the old fallback chain is gone, ImgLink is the only host. */
export const uploadImage = uploadImageToImgLink;
