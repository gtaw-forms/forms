import React, { useState } from 'react';
import * as Sentry from "@sentry/react";
import { useNotification } from '../../contexts/NotificationContext';
import LoadingSpinner from '../LoadingSpinner';
import './ImageUploader.css';
import { uploadImageToImgBB } from '../../utils/imageUploadUtils';

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

    for (const file of files) {
      try {
        const url = await uploadImageToImgBB(file);
        uploadedImageUrls.push(url);
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
