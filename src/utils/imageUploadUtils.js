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