import React, { useState, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { useNotification } from '../../contexts/NotificationContext';
import LoadingSpinner from '../UI/LoadingSpinner';
import { uploadImageWithFallback } from '../../utils/imageUploadUtils';
import Tesseract from 'tesseract.js';

const ImageUploader = ({ images: imagesProp, onImagesChange, notes, onNotesChange, maxImages = 6, fieldName }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [manualUrl, setManualUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const { showNotification } = useNotification();
  
  const showNotes = fieldName?.toLowerCase().includes('morgue') || 
                   fieldName?.toLowerCase().includes('damage') || 
                   fieldName?.toLowerCase().includes('cdna') ||
                   fieldName?.toLowerCase().includes('additional');

  // OCR State
  const [ocrResults, setOcrResults] = useState({}); // { [url]: text }
  const [isOcrLoading, setIsOcrLoading] = useState({}); // { [url]: boolean }

  const performOcr = useCallback(async (url) => {
    if (!url) return;
    
    setIsOcrLoading(prev => ({ ...prev, [url]: true }));
    try {
      const { data: { text } } = await Tesseract.recognize(
        url,
        'eng',
        { logger: m => console.debug(`[OCR:${url}]`, m) }
      );
      const cleanedText = text.trim();
      setOcrResults(prev => ({ ...prev, [url]: cleanedText }));
    } catch (err) {
      console.error(`[OCR] Failed to scan image:`, err);
    } finally {
      setIsOcrLoading(prev => ({ ...prev, [url]: false }));
    }
  }, []);

  const images = React.useMemo(() => {
    if (Array.isArray(imagesProp)) return imagesProp;
    if (typeof imagesProp === 'string' && imagesProp.trim()) {
      return imagesProp.split(', ').filter(Boolean);
    }
    return [];
  }, [imagesProp]);

  const handleImageUrlAdd = useCallback((url) => {
    if (!url) return;
    if (images.length >= maxImages) {
        showNotification(`Maximum ${maxImages} images allowed.`, 'error');
        return;
    }
    
    if (images.includes(url)) {
        showNotification('Image already added.', 'info');
        return;
    }

    const newImages = [...images, url];
    onImagesChange(newImages);
    
    const autoOcrFields = ['additionalImages', 'additionalPhotos', 'morguePhotos', 'cdamages', 'cdna'];
    const shouldAutoOcr = autoOcrFields.some(f => fieldName?.toLowerCase().includes(f.toLowerCase()));
    
    if (shouldAutoOcr) {
        performOcr(url);
    }
  }, [images, maxImages, onImagesChange, fieldName, performOcr, showNotification]);

  const detectAndAddImageUrl = useCallback((data) => {
    const text = data.getData('text/plain')?.trim();
    const uriList = data.getData('text/uri-list');
    const html = data.getData('text/html');
    
    let url = uriList?.split('\n')[0].trim() || text;
    if (url && !/^http/i.test(url)) url = null;
    
    if (!url && html) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const img = doc.querySelector('img');
            if (img && img.src && /^http/i.test(img.src)) {
                url = img.src;
            }
        } catch (e) {}
    }
    
    if (!url) return false;

    const isValid = (
        /\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(url) || 
        /puu\.sh\//i.test(url) || 
        /imgur\.com\//i.test(url) ||
        /postimg\.cc\//i.test(url) ||
        /prnt\.sc\//i.test(url) ||
        /discordapp\.com\/attachments\//i.test(url)
    );

    if (isValid) {
        handleImageUrlAdd(url);
        return true;
    }
    
    return false;
  }, [handleImageUrlAdd]);

  const processFiles = async (files) => {
    if (images.length + files.length > maxImages) {
      showNotification(`Maximum ${maxImages} images allowed.`, 'error');
      return;
    }

    setIsUploading(true);
    const uploaded = [];

    for (const file of files) {
      try {
        const result = await uploadImageWithFallback(file);
        uploaded.push(result.url);
      } catch (err) {
        console.error(`[ImageUploader] Image upload failed:`, err);
        showNotification(err.message || 'Image upload failed.', 'error');
        Sentry.captureException(err);
      }
    }

    if (uploaded.length > 0) {
      const newImages = [...images, ...uploaded];
      onImagesChange(newImages);
      
      const autoOcrFields = ['additionalImages', 'additionalPhotos', 'morguePhotos', 'cdamages', 'cdna'];
      const shouldAutoOcr = autoOcrFields.some(f => fieldName?.toLowerCase().includes(f.toLowerCase()));
      
      if (shouldAutoOcr) {
        uploaded.forEach(url => performOcr(url));
      }
    }
    setIsUploading(false);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  const handleManualUrlAdd = () => {
    if (!manualUrl.trim()) return;
    
    if (!manualUrl.startsWith('http')) {
        showNotification('Please enter a valid URL', 'error');
        return;
    }

    handleImageUrlAdd(manualUrl.trim());
    setManualUrl('');
  };

  const handleRemove = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages.length > 0 ? newImages : []);
  };

  const handlePaste = useCallback(async (event) => {
    if (detectAndAddImageUrl(event.clipboardData)) {
        event.preventDefault();
        return;
    }

    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFile = [...items].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
    if (!imageFile) return;

    event.preventDefault();
    processFiles([imageFile]);
  }, [detectAndAddImageUrl, processFiles]);

  // Drag and Drop Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (detectAndAddImageUrl(e.dataTransfer)) {
        return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    if (files && files.length > 0) {
        processFiles(files);
    }
  };

  return (
    <div 
        className="image-uploader-container" 
        onPaste={handlePaste} 
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ width: '100%' }}
    >
      {/* Information Bubble */}
      <div style={{ 
          background: 'rgba(59, 130, 246, 0.1)', 
          border: '1px solid rgba(59, 130, 246, 0.3)', 
          borderRadius: '8px', 
          padding: '0.8rem 1rem', 
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#60a5fa',
          fontSize: '0.85rem'
      }}>
          <i className="fas fa-info-circle" style={{ fontSize: '1.1rem' }}></i>
          <div>
              <strong>Quick Actions:</strong> Paste raw image URLs or images directly (<strong>Ctrl+V</strong>) to add them instantly. We'll avoid re-uploading if a valid URL is detected.
          </div>
      </div>

      {/* Manual URL Input (Priority) */}
      <div style={{ marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <input
                  type="text"
                  placeholder="Paste raw image URL and press Enter..."
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualUrlAdd()}
                  style={{ 
                      width: '100%', 
                      padding: '0.6rem 0.8rem', 
                      background: '#1e293b', 
                      border: '1px solid #334155', 
                      color: '#f8fafc', 
                      borderRadius: 8, 
                      fontSize: '0.85rem',
                      boxSizing: 'border-box'
                  }}
              />
          </div>
      </div>

      {/* Narrative Section (if applicable) */}
      {showNotes && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>
            Text Field for CDAMAGES and CDNA (Optional)
          </label>
          <textarea
            value={notes || ''}
            onChange={(e) => onNotesChange?.(e.target.value)}
            placeholder="This section is required if you forgot to take a screenshot of the cdamages and CDNA."
            style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
                borderRadius: 8,
                fontSize: '0.85rem',
                minHeight: '80px',
                resize: 'vertical'
            }}
          />
        </div>
      )}

      {/* Gallery Section */}
      <div className="image-previews" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
        {images.map((url, i) => (
          <div key={i} className="image-preview" style={{ 
              flexBasis: 'calc(33.333% - 7px)', 
              aspectRatio: '1/1', 
              position: 'relative', 
              borderRadius: '8px', 
              overflow: 'hidden',
              border: '1px solid #334155',
              background: '#0f172a'
          }}>
            <img 
                src={url} 
                alt={`Preview ${i}`} 
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => {
                    setCurrentImageIndex(i);
                    setShowGalleryModal(true);
                }}
            />
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                bottom: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.5) 100%)',
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '5px'
            }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                        type="button" 
                        onClick={() => handleRemove(i)}
                        style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                        type="button" 
                        onClick={() => {
                            navigator.clipboard.writeText(url);
                            showNotification('URL copied!', 'success');
                        }}
                        style={{ flex: 1, background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '2px', fontSize: '0.6rem', cursor: 'pointer' }}
                    >
                        <i className="fas fa-link"></i>
                    </button>
                    <button 
                        type="button" 
                        onClick={() => performOcr(url)}
                        style={{ flex: 1, background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', padding: '2px', fontSize: '0.6rem', cursor: 'pointer' }}
                        disabled={isOcrLoading[url]}
                    >
                        <i className={`fas ${isOcrLoading[url] ? 'fa-spinner fa-spin' : 'fa-font'}`}></i>
                    </button>
                </div>
            </div>
            {ocrResults[url] && (
                <div style={{ position: 'absolute', bottom: '25px', left: 0, right: 0, background: 'rgba(16, 185, 129, 0.9)', color: 'white', fontSize: '0.6rem', padding: '2px 5px', textAlign: 'center' }}>
                    <i className="fas fa-check-circle"></i> Text Scanned
                </div>
            )}
          </div>
        ))}
        
        {isUploading && (
            <div style={{ 
                flexBasis: 'calc(33.333% - 7px)', 
                aspectRatio: '1/1', 
                borderRadius: '8px', 
                border: '1px solid #3b82f6', 
                background: '#1e293b', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#3b82f6', 
                gap: '8px' 
            }}>
                <i className="fas fa-spinner fa-spin fa-lg"></i>
                <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Uploading...</span>
            </div>
        )}
      </div>

      {/* Upload Zone (Bottom) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {images.length < maxImages && !isUploading && (
            <label style={{ cursor: 'pointer', display: 'block', margin: 0 }}>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />
                <div style={{
                    padding: '1.5rem',
                    background: isDragging ? 'rgba(59, 130, 246, 0.1)' : '#162032',
                    border: isDragging ? '2px solid #3b82f6' : '2px dashed #334155',
                    borderRadius: 8,
                    textAlign: 'center',
                    color: isDragging ? '#3b82f6' : '#94a3b8',
                    transition: 'all 0.2s',
                    fontSize: '0.9rem'
                }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}>
                    <i className="fas fa-cloud-upload-alt" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }}></i>
                    <strong>{isDragging ? 'Drop to upload!' : 'Click to upload'}</strong> or drag & drop<br />
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Paste screenshots (Ctrl+V) anywhere here</span>
                </div>
            </label>
        )}
      </div>

      {showGalleryModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowGalleryModal(false)}
        >
          <button onClick={() => setShowGalleryModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'white', fontSize: '2rem', cursor: 'pointer' }}>&times;</button>
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1)); }} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: 'white', fontSize: '2rem', padding: '10px 20px', cursor: 'pointer', borderRadius: '8px', marginRight: '20px' }}>&#8249;</button>
            <img src={images[currentImageIndex]} alt="Gallery" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} onClick={() => window.open(images[currentImageIndex], '_blank')} />
            <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1)); }} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: 'white', fontSize: '2rem', padding: '10px 20px', cursor: 'pointer', borderRadius: '8px', marginLeft: '20px' }}>&#8250;</button>
          </div>
          <div style={{ color: 'white', marginTop: '15px' }}>{currentImageIndex + 1} / {images.length}</div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
