import React, { useEffect, useRef } from 'react';
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

    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement;
            document.body.style.overflow = 'hidden';

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

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget && onClose) {
            onClose();
        }
    };

    // Map modalSize to CSS class
    const sizeClass = modalSize === 'large' || modalSize === 'xl' ? ' wide' : modalSize === 'full' ? ' full' : '';

    const modalContent = (
        <div
            className={`modal-overlay variant-${variant}`}
            onClick={handleOverlayClick}
            style={{ zIndex, display: 'flex' }}
            role="presentation"
        >
            <div
                ref={modalRef}
                className={`modal-box${sizeClass} modal-variant-${variant} ${className}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                tabIndex={-1}
            >
                {(title || showCloseButton) && (
                    <div className="modal-head">
                        {title && <h3 id="modal-title" className="modal-title">{title}</h3>}
                        {showCloseButton && (
                            <button
                                type="button"
                                className="modal-close"
                                onClick={onClose}
                                aria-label="Close modal"
                                title="Close"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                )}

                <div className={`modal-body${noPadding ? ' modal-no-padding' : ''}`}>
                    {children}
                </div>

                {footer && (
                    <div className="modal-foot">
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
