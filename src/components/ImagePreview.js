import React, { useState, useEffect, useCallback } from 'react';
import { Button } from 'react-bootstrap';

const ImagePreview = ({ imageUrls, showPreviews = true, onImageRemove = null }) => {
    const [previewUrls, setPreviewUrls] = useState([]);
    const [showCarousel, setShowCarousel] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [imageErrors, setImageErrors] = useState([]);

    useEffect(() => {
        if (!imageUrls || !showPreviews) {
            setPreviewUrls([]);
            return;
        }

        const urls = imageUrls
            .split(',')
            .map(url => url.trim())
            .filter(url => url && isValidImageUrl(url));
        
        setPreviewUrls(urls);
        setImageErrors([]); // Reset errors when images change
    }, [imageUrls, showPreviews]);

    const isValidImageUrl = (url) => {
        try {
            new URL(url);
            return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.includes('ibb.co') || url.includes('imgur.com');
        } catch {
            return false;
        }
    };

    const handleImageClick = (url) => {
        const index = previewUrls.findIndex(u => u === url);
        setCurrentImageIndex(index >= 0 ? index : 0);
        setShowCarousel(true);
    };

    const closeCarousel = () => {
        setShowCarousel(false);
    };

    const nextImage = useCallback(() => {
        setCurrentImageIndex((prev) => (prev + 1) % previewUrls.length);
    }, [previewUrls.length]);

    const prevImage = useCallback(() => {
        setCurrentImageIndex((prev) => (prev - 1 + previewUrls.length) % previewUrls.length);
    }, [previewUrls.length]);

    const removeImage = useCallback((indexToRemove) => {
        if (!onImageRemove) return;
        
        const urlToRemove = previewUrls[indexToRemove];
        const updatedUrls = previewUrls.filter((_, index) => index !== indexToRemove);
        
        const newImageUrlsString = updatedUrls.join(', ');
        onImageRemove(newImageUrlsString);
        
        setPreviewUrls(updatedUrls);
        
        if (updatedUrls.length === 0) {
            setShowCarousel(false);
        } else if (indexToRemove <= currentImageIndex) {
            setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
        }
    }, [previewUrls, currentImageIndex, onImageRemove]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!showCarousel) return;
            
            switch (e.key) {
                case 'Escape':
                    closeCarousel();
                    break;
                case 'ArrowLeft':
                    prevImage();
                    break;
                case 'ArrowRight':
                    nextImage();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showCarousel, nextImage, prevImage]);

    useEffect(() => {
        if (showCarousel) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showCarousel]);

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    if (!showPreviews || previewUrls.length === 0) {
        return null;
    }

    return (
        <>
            <div className="image-preview-container" style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85em', color: '#6c757d', marginRight: '8px' }}>
                        Image Preview{previewUrls.length > 1 ? `s (${previewUrls.length})` : ''}:
                    </span>
                    {previewUrls.slice(0, 3).map((url, index) => (
                        <div
                            key={index}
                            style={{
                                position: 'relative',
                                cursor: 'pointer',
                                border: '1px solid #30363d',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                width: '60px',
                                height: '60px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#161b22',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                            }}
                            title={`Click to open gallery: ${url}`}
                            onMouseEnter={(e) => {
                                const container = e.currentTarget;
                                container.style.transform = 'scale(1.05)';
                                container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                                if (onImageRemove) {
                                    const removeBtn = container.querySelector('.preview-remove-btn');
                                    if (removeBtn) removeBtn.style.opacity = '1';
                                }
                            }}
                            onMouseLeave={(e) => {
                                const container = e.currentTarget;
                                container.style.transform = 'scale(1)';
                                container.style.boxShadow = 'none';
                                if (onImageRemove) {
                                    const removeBtn = container.querySelector('.preview-remove-btn');
                                    if (removeBtn) removeBtn.style.opacity = '0';
                                }
                            }}
                        >
                            {imageErrors.includes(url) ? (
                                <i className="fas fa-image" style={{ color: '#6c757d' }}></i>
                            ) : (
                                <img
                                    src={url}
                                    alt={`Preview ${index + 1}`}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        objectFit: 'cover'
                                    }}
                                    onClick={() => handleImageClick(url)}
                                    onError={() => setImageErrors(prev => [...prev, url])}
                                />
                            )}
                            {onImageRemove && (
                                <button
                                    className="preview-remove-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Remove this image?')) {
                                            removeImage(index);
                                        }
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        border: 'none',
                                        backgroundColor: 'rgba(220, 53, 69, 0.9)',
                                        color: 'white',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: '0',
                                        transition: 'opacity 0.2s ease',
                                        zIndex: 10
                                    }}
                                    title="Remove image"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    ))}
                    {previewUrls.length > 3 && (
                        <div 
                            style={{
                                fontSize: '0.8em',
                                color: '#6c757d',
                                padding: '4px 8px',
                                backgroundColor: '#21262d',
                                borderRadius: '4px',
                                border: '1px solid #30363d',
                                cursor: 'pointer'
                            }}
                            onClick={() => handleImageClick(previewUrls[3])}
                            title="Click to view all images"
                        >
                            +{previewUrls.length - 3} more
                        </div>
                    )}
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setPreviewUrls([])}
                        style={{ fontSize: '0.7em', padding: '2px 6px' }}
                        title="Hide previews"
                    >
                        Hide
                    </Button>
                </div>
            </div>

            {showCarousel && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.95)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'fadeIn 0.3s ease'
                    }}
                    onClick={closeCarousel}
                >
                    <button
                        onClick={closeCarousel}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '20px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            color: 'white',
                            fontSize: '24px',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.2s ease',
                            zIndex: 10001
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                        title="Close (Esc)"
                    >
                        <i className="fas fa-times"></i>
                    </button>

                    {onImageRemove && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Are you sure you want to remove this image?')) {
                                    removeImage(currentImageIndex);
                                }
                            }}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '80px',
                                background: 'rgba(220, 53, 69, 0.8)',
                                border: 'none',
                                color: 'white',
                                fontSize: '20px',
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s ease',
                                zIndex: 10001
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = 'rgba(220, 53, 69, 1)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.8)';
                            }}
                            title="Remove Image"
                        >
                            <i className="fas fa-trash"></i>
                        </button>
                    )}

                    <div
                        style={{
                            position: 'absolute',
                            top: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            color: 'white',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            zIndex: 10001
                        }}
                    >
                        {currentImageIndex + 1} of {previewUrls.length}
                    </div>

                    {previewUrls.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                prevImage();
                            }}
                            style={{
                                position: 'absolute',
                                left: '20px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                color: 'white',
                                fontSize: '24px',
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s ease',
                                zIndex: 10001
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                            title="Previous (←)"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                    )}

                    {previewUrls.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                nextImage();
                            }}
                            style={{
                                position: 'absolute',
                                right: '20px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                color: 'white',
                                fontSize: '24px',
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s ease',
                                zIndex: 10001
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            }}
                            title="Next (→)"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    )}

                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {imageErrors.includes(previewUrls[currentImageIndex]) ? (
                            <div style={{
                                color: 'white', 
                                textAlign: 'center', 
                                padding: '40px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                            }}>
                                <i className="fas fa-exclamation-triangle" style={{fontSize: '48px', marginBottom: '16px'}}></i>
                                <div>Failed to load image</div>
                                <div style={{fontSize: '12px', marginTop: '8px', opacity: 0.7}}>{previewUrls[currentImageIndex]}</div>
                            </div>
                        ) : (
                            <img
                                src={previewUrls[currentImageIndex]}
                                alt={`Image ${currentImageIndex + 1}`}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                                    transition: 'opacity 0.3s ease'
                                }}
                                onError={() => setImageErrors(prev => [...prev, previewUrls[currentImageIndex]])}
                            />
                        )}
                    </div>

                    {previewUrls.length > 1 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                gap: '8px',
                                maxWidth: '90vw',
                                overflowX: 'auto',
                                padding: '10px',
                                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                                borderRadius: '12px',
                                zIndex: 10001
                            }}
                        >
                            {previewUrls.map((url, index) => (
                                <div
                                    key={index}
                                    style={{
                                        position: 'relative',
                                        width: '60px',
                                        height: '60px',
                                        borderRadius: '6px',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        border: index === currentImageIndex ? '3px solid #007bff' : '3px solid transparent',
                                        opacity: index === currentImageIndex ? 1 : 0.7,
                                        transition: 'all 0.2s ease',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={(e) => {
                                        const container = e.currentTarget;
                                        if (index !== currentImageIndex) {
                                            container.style.opacity = '1';
                                        }
                                        if (onImageRemove) {
                                            const removeBtn = container.querySelector('.thumbnail-remove-btn');
                                            if (removeBtn) removeBtn.style.opacity = '1';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        const container = e.currentTarget;
                                        if (index !== currentImageIndex) {
                                            container.style.opacity = '0.7';
                                        }
                                        if (onImageRemove) {
                                            const removeBtn = container.querySelector('.thumbnail-remove-btn');
                                            if (removeBtn) removeBtn.style.opacity = '0';
                                        }
                                    }}
                                >
                                    {imageErrors.includes(url) ? (
                                        <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#161b22'}}>
                                            <i className="fas fa-image" style={{ color: '#6c757d' }}></i>
                                        </div>
                                    ) : (
                                        <img
                                            src={url}
                                            alt={`Thumbnail ${index + 1}`}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentImageIndex(index);
                                            }}
                                            onError={() => setImageErrors(prev => [...prev, url])}
                                        />
                                    )}
                                    {onImageRemove && (
                                        <button
                                            className="thumbnail-remove-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('Remove this image?')) {
                                                    removeImage(index);
                                                }
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '2px',
                                                right: '2px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                backgroundColor: 'rgba(220, 53, 69, 0.9)',
                                                color: 'white',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                opacity: '0',
                                                transition: 'opacity 0.2s ease',
                                                zIndex: 10002
                                            }}
                                            title="Remove image"
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </>
    );
};

export default ImagePreview;