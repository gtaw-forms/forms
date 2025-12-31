// src/utils/imageUploadUtils.js
import * as Sentry from "@sentry/react";
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

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
      return data.url;
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
      return data.url;
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