import React from 'react';
import BaseModal from './BaseModal';

/**
 * A specialized modal for previewing images with navigation support for galleries.
 * Adheres to the project's custom modal standards using BaseModal.
 */
const ImagePreviewModal = ({ 
    isOpen, 
    onClose, 
    imageUrl, 
    images = [], 
    currentIndex = 0, 
    onIndexChange 
}) => {
    const currentUrl = images.length > 0 ? images[currentIndex] : imageUrl;
    
    if (!currentUrl) return null;

    const handlePrevious = (e) => {
        e.stopPropagation();
        if (onIndexChange && images.length > 1) {
            onIndexChange(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
        }
    };

    const handleNext = (e) => {
        e.stopPropagation();
        if (onIndexChange && images.length > 1) {
            onIndexChange(currentIndex === images.length - 1 ? 0 : currentIndex + 1);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={images.length > 1 ? `Image ${currentIndex + 1} of ${images.length}` : 'Image Preview'}
            modalSize="xl"
            noPadding
            variant="default"
            zIndex={2000}
        >
            <div 
                style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    minHeight: '400px',
                    height: 'calc(85vh - 60px)', // Account for header
                    background: '#020617',
                    overflow: 'hidden',
                    userSelect: 'none'
                }}
                onClick={(e) => {
                    // Clicking the background closes the modal
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                {/* Navigation Buttons */}
                {images.length > 1 && (
                    <>
                        <button 
                            onClick={handlePrevious}
                            className="preview-nav-button prev"
                            style={{
                                position: 'absolute',
                                left: '20px',
                                zIndex: 10,
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid #334155',
                                color: 'white',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                fontSize: '1.5rem',
                                transition: 'all 0.2s'
                            }}
                            title="Previous (Left Arrow)"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <button 
                            onClick={handleNext}
                            className="preview-nav-button next"
                            style={{
                                position: 'absolute',
                                right: '20px',
                                zIndex: 10,
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid #334155',
                                color: 'white',
                                borderRadius: '50%',
                                width: '50px',
                                height: '50px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                fontSize: '1.5rem',
                                transition: 'all 0.2s'
                            }}
                            title="Next (Right Arrow)"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </>
                )}

                {/* Main Image */}
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '20px'
                }}>
                    <img 
                        src={currentUrl} 
                        alt={`Preview ${currentIndex + 1}`} 
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            objectFit: 'contain',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            borderRadius: '4px'
                        }} 
                    />
                </div>

                {/* Actions Overlay (Bottom Right) */}
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    display: 'flex',
                    gap: '10px',
                    zIndex: 20
                }}>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(currentUrl);
                            // We can't easily trigger showNotification here without context, 
                            // but usually the parent handles notifications or we could use an alert
                            window.alert('URL copied to clipboard!');
                        }}
                        style={{
                            background: '#334155',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 15px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        title="Copy Image URL"
                    >
                        <i className="fas fa-link"></i> Copy URL
                    </button>
                    <button 
                        onClick={() => window.open(currentUrl, '_blank')}
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 15px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600'
                        }}
                        title="Open in new tab"
                    >
                        <i className="fas fa-external-link-alt"></i> Open Original
                    </button>
                </div>
                
                {/* Keyboard shortcuts hint */}
                <div style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '20px',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '4px 8px',
                    borderRadius: '4px'
                }}>
                    <i className="fas fa-keyboard"></i> Use Arrow Keys to navigate
                </div>
            </div>
            
            <style>{`
                .preview-nav-button:hover {
                    background: #3b82f6 !important;
                    transform: scale(1.1);
                }
            `}</style>
        </BaseModal>
    );
};

export default ImagePreviewModal;
