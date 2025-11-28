// src/components/form-handler/ImageUploader.jsx
import React, { useState, useCallback } from 'react';
import * as Sentry from "@sentry/react";
import { useNotification } from '../../contexts/NotificationContext';
import LoadingSpinner from '../LoadingSpinner';
import './ImageUploader.css';
import { uploadImageToImgBB } from '../../utils/imageUploadUtils';

const ImageUploader = ({ images: imagesProp, onImagesChange, maxImages = 6, fieldName }) => {
  const [isUploading, setIsUploading] = useState(false);
  const { showNotification } = useNotification();

  // Normalize input: always work with array internally
  const images = React.useMemo(() => {
    if (Array.isArray(imagesProp)) return imagesProp;
    if (typeof imagesProp === 'string' && imagesProp.trim()) {
      return imagesProp.split(', ').filter(Boolean);
    }
    return [];
  }, [imagesProp]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (images.length + files.length > maxImages) {
      showNotification(`Maximum ${maxImages} images allowed.`, 'error');
      return;
    }

    setIsUploading(true);
    const uploaded = [];

    for (const file of files) {
      try {
        const url = await uploadImageToImgBB(file);
        uploaded.push(url);
      } catch (err) {
        Sentry.captureException(err);
        showNotification('One image failed to upload', 'error');
      }
    }

    if (uploaded.length > 0) {
      const newImages = [...images, ...uploaded];
      onImagesChange(newImages); // Now passing array!
      showNotification(`${uploaded.length} image(s) uploaded!`, 'success');
    }
    setIsUploading(false);
  };

  const handleRemove = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages.length > 0 ? newImages : []);
  };

  const handlePaste = useCallback(async (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFile = [...items].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
    if (!imageFile) return;

    event.preventDefault();

    if (images.length >= maxImages) {
        showNotification(`Maximum ${maxImages} images allowed.`, 'error');
        return;
    }

    setIsUploading(true);
    try {
        const url = await uploadImageToImgBB(imageFile);
        const newImages = [...images, url];
        onImagesChange(newImages);
        showNotification('Image pasted & uploaded!', 'success');
    } catch (err) {
        Sentry.captureException(err);
        showNotification('Pasted image failed to upload', 'error');
    } finally {
        setIsUploading(false);
    }
  }, [images, maxImages, onImagesChange, showNotification, fieldName]);

  return (
    <div className="image-uploader-container" onPaste={handlePaste}>
      <div className="image-previews">
        {images.map((url, i) => (
          <div key={i} className="image-preview" style={{ position: 'relative' }}>
            <img src={url} alt={`Upload ${i + 1}`} />
            
            <div style={{
              marginTop: '6px',
              padding: '6px 8px',
              background: '#0f172a',
              borderRadius: 6,
              fontSize: '0.8rem',
              color: '#94a3b8',
              wordBreak: 'break-all',
              border: '1px solid #334155'
            }}>
              <span style={{ color: '#60a5fa' }}>{url}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  showNotification('Image URL copied to clipboard!', 'success');
                }}
                style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Copy URL
              </button>
            </div>

            <button
              type="button"
              className="remove-btn"
              onClick={() => handleRemove(i)}
              style={{ top: 8, right: 8 }}
            >
              X
            </button>
          </div>
        ))}
      </div>
      
      <div style={{ margin: '12px 0', padding: '10px', background: '#1e293b', borderRadius: 8, fontSize: '0.9rem', color: '#94a3b8' }}>
        <strong>Pro tip:</strong> You can <strong>paste images directly</strong> here (Ctrl+V)!
      </div>

      {isUploading ? (
        <LoadingSpinner />
      ) : images.length < maxImages ? (
        <label style={{ cursor: 'pointer', display: 'block' }}>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <div style={{
            padding: '12px',
            background: '#334155',
            border: '2px dashed #64748b',
            borderRadius: 8,
            textAlign: 'center',
            color: '#cbd5e1'
          }}>
            Click to upload or drag & drop<br />
            <small>Max {maxImages} images</small>
          </div>
        </label>
      ) : (
        <p style={{ color: '#f87171' }}>Maximum {maxImages} images reached.</p>
      )}
    </div>
  );
};

export default ImageUploader;