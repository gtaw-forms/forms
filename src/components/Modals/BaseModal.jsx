import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './BaseModal.css';

const BaseModal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    className = '',
    showCloseButton = true,
    closeOnOverlayClick = true,
    modalSize = 'medium', // small, medium, large, xl, full
    variant = 'default', // default, danger, warning, success, info, cctv
    zIndex = 1050,
    noPadding = false,
}) => {
    const modalRef = useRef(null);
    const previousActiveElement = useRef(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement;
            document.body.style.overflow = 'hidden';
            
            // Small timeout to ensure render before focus
            setTimeout(() => {
                if (modalRef.current) {
                    modalRef.current.focus();
                }
            }, 50);

            const handleEscape = (e) => {
                if (e.key === 'Escape' && onCloseRef.current) {
                    onCloseRef.current();
                }
            };
            window.addEventListener('keydown', handleEscape);

            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleEscape);
                
                if (previousActiveElement.current) {
                    previousActiveElement.current.focus();
                }
            };
        }
    }, [isOpen, title]);

    if (!isOpen || !mounted) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget && onClose) {
            onClose();
        }
    };

    const modalContent = (
        <div 
            className={`modal-overlay variant-${variant}`}
            onClick={handleOverlayClick}
            style={{ zIndex }}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`modal-container modal-size-${modalSize} modal-variant-${variant} ${className}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                tabIndex={-1}
            >
                {(title || showCloseButton) && (
                    <div className="modal-header">
                        {title && <h2 id="modal-title" className="modal-title">{title}</h2>}
                        {showCloseButton && (
                            <button
                                type="button"
                                className="modal-close-button"
                                onClick={() => {
                                    onClose();
                                }}
                                aria-label="Close modal"
                                title="Close"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                )}
                
                <div className={`modal-content ${noPadding ? 'modal-no-padding' : ''}`}>
                    {children}
                </div>

                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    const portalTarget = document.getElementById('modal-root') || document.body;
    return createPortal(modalContent, portalTarget);
};

export default BaseModal;
