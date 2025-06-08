// src/components/SwitchableFormsModal.js
import React from 'react';
import { Button, Image } from 'react-bootstrap';

// Style definitions (consistent with AgencySelector)
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '5vh',
    zIndex: 1050, // Ensure it's above other content
    overflowY: 'auto',
};

const modalContentStyleBase = {
    backgroundColor: '#212529',
    color: '#f8f9fa',
    padding: '20px',
    borderRadius: '0.3rem',
    boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
    position: 'relative',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
};

const modalHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #495057',
    paddingBottom: '10px',
    marginBottom: '15px',
};
const modalTitleStyle = { fontSize: '1.25rem', margin: 0, color: '#f8f9fa' };
const modalCloseButtonStyle = {
    background: 'none', border: 'none', color: '#f8f9fa',
    fontSize: '1.5rem', lineHeight: 1, opacity: 0.75, cursor: 'pointer',
};
const modalBodyStyle = { overflowY: 'auto', flexGrow: 1 };

const formButtonStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0.75rem',
    height: '8rem',
    textAlign: 'center',
    backgroundColor: '#343a40',
    color: '#f8f9fa',
    border: '1px solid #495057',
    borderRadius: '0.1rem',
    boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
    transition: 'transform 0.15s ease-in-out, background-color 0.15s ease-in-out',
    width: '100%', // Make buttons fill their grid item
    fontSize: '0.875rem',
};

const gridContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    justifyContent: 'center', // Center items if they don't fill the row
};

const gridItemStyleBase = {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
};

const SwitchableFormsModal = ({
    show,
    onHide,
    title,
    forms, // Array of { version, name, icon }
    handleFormSelect, // Renamed from handleAgencySelect for clarity in this context
    isMobile
}) => {
    if (!show || !forms || forms.length === 0) {
        return null;
    }

    // Dynamically adjust modal width and grid item flex based on the number of forms
    const modalContentStyle = {
        ...modalContentStyleBase,
        width: isMobile ? '90%' : (forms.length > 2 ? '75%' : '50%'),
        maxWidth: forms.length > 3 ? '1140px' : (forms.length > 2 ? '900px' : '600px'),
    };

    const gridItemStyle = {
        ...gridItemStyleBase,
        flex: isMobile ? '1 0 48%' : // Mobile: 2 items per row
              forms.length === 1 ? '1 0 98%' : // Desktop: 1 item
              forms.length === 2 ? '1 0 48%' : // Desktop: 2 items
              forms.length === 3 ? '1 0 30%' : // Desktop: 3 items
              '1 0 23%', // Desktop: 4 items
    };

    return (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h4 style={modalTitleStyle}>{title} ({forms.length})</h4>
                    <button
                        type="button"
                        style={modalCloseButtonStyle}
                        onClick={onHide}
                        aria-label="Close selector"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div style={modalBodyStyle}>
                    <div style={gridContainerStyle}>
                        {forms.map(form => (
                            <div key={form.version} style={gridItemStyle}>
                                <Button
                                    variant="custom-dark"
                                    style={formButtonStyle}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#495057'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#343a40'}
                                    onClick={() => handleFormSelect(form.version)}
                                    title={form.name}
                                >
                                    <Image
                                        src={form.icon}
                                        alt={form.name}
                                        fluid
                                        style={{ maxHeight: '3.5rem', objectFit: 'contain', marginBottom: '0.25rem', width: 'auto' }}
                                    />
                                    <span className="text-break">{form.name}</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SwitchableFormsModal;
