// src/utils/imageUploadUtils.js
import * as Sentry from "@sentry/react";

export const uploadImageToImgBB = async (file) => {
  const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
  if (!imgbbApiKey) {
    throw new Error('ImgBB API Key is not configured.');
  }

  try {
    const formData = new FormData();
    const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    formData.append('image', base64Image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return data.data.url;
    } else {
      console.error('ImgBB upload failed:', data.error.message);
      throw new Error(`ImgBB upload failed: ${data.error.message}`);
    }
  } catch (error) {
    console.error('Upload failed:', error);
    Sentry.captureException(error, { extra: { context: 'imageUploadUtils' } });
    throw error;
  }
};

// If uploadToImgBB is distinct, define it here, otherwise use uploadImageToImgBB
export const uploadToImgBB = uploadImageToImgBB;