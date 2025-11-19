import React, { useState } from 'react';
import * as Sentry from "@sentry/react";
import { useNotification } from '../../contexts/NotificationContext';
import LoadingSpinner from '../LoadingSpinner';
import './ImageUploader.css';

const ImageUploader = ({ images: imagesProp, onImagesChange, maxImages = 6 }) => {
  const [isUploading, setIsUploading] = useState(false);
  const { showNotification } = useNotification();

  // Internally, work with an array
  const images = typeof imagesProp === 'string' && imagesProp.length > 0 ? imagesProp.split(', ') : (Array.isArray(imagesProp) ? imagesProp : []);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (images.length + files.length > maxImages) {
      showNotification(`You can only upload a maximum of ${maxImages} images.`, 'error');
      return;
    }

    setIsUploading(true);
    const uploadedImageUrls = [];

    const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
    if (!imgbbApiKey) {
      showNotification('ImgBB API Key is not configured.', 'error');
      setIsUploading(false);
      return;
    }

    for (const file of files) {
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
          uploadedImageUrls.push(data.data.url);
        } else {
          console.error('ImgBB upload failed:', data.error.message);
          showNotification(`ImgBB upload failed: ${data.error.message}`, 'exclamation-circle');
        }
      } catch (error) {
        console.error('Upload failed:', error);
        Sentry.captureException(error, { extra: { context: 'ImageUploader' } });
        showNotification('Upload failed!', 'exclamation-circle');
      }
    }

    if (uploadedImageUrls.length > 0) {
      const newImages = [...images, ...uploadedImageUrls];
      onImagesChange(newImages.join(', '));
      showNotification(`${uploadedImageUrls.length} image(s) uploaded successfully!`, 'check-circle');
    }

    setIsUploading(false);
  };

  const handleRemoveImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages.join(', '));
  };

  return (
    <div className="image-uploader-container">
      <div className="image-previews">
        {images.map((img, index) => (
          <div key={index} className="image-preview">
            <img src={img} alt={`preview ${index}`} />
            <button type="button" className="remove-btn" onClick={() => handleRemoveImage(index)}>&times;</button>
          </div>
        ))}
      </div>
      {isUploading ? (
        <LoadingSpinner />
      ) : (
        images.length < maxImages && (
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            disabled={images.length >= maxImages}
          />
        )
      )}
      {images.length >= maxImages && <p>Maximum number of images reached.</p>}
    </div>
  );
};

export default ImageUploader;
