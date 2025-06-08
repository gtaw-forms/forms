import React from 'react';
import { Button, Form, Image } from 'react-bootstrap';

const AgencySelector = ({
    showAgencySelector,
    setShowAgencySelector,
    handleAgencySelect,
    isMobile,
    hideAgencySelector,
    setHideAgencySelector,
    selectedAgencyGroup,
    formDefinitions
}) => {
    if (!showAgencySelector || !selectedAgencyGroup) {
        return null;
    }

    const availableForms = formDefinitions
        .filter(form => form.group === selectedAgencyGroup && !form.name.includes('(PBC)') && !form.isHiddenInSelector) // Added !form.isHiddenInSelector
        .sort((a, b) => {
            // Primary sort by sortOrder (ascending)
            const orderA = a.sortOrder !== undefined ? a.sortOrder : Infinity;
            const orderB = b.sortOrder !== undefined ? b.sortOrder : Infinity;

            if (orderA !== orderB) {
                return orderA - orderB;
            }
            // Secondary sort by name (alphabetical) if sortOrder is the same or undefined
            return a.name.localeCompare(b.name);
        });

    // Styles (keep your existing styles: overlayStyle, modalContentStyle, etc.)
    const overlayStyle = {
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
        zIndex: 1050,
        overflowY: 'auto',
    };

    const modalContentStyle = {
        backgroundColor: '#212529',
        color: '#f8f9fa',
        padding: '20px',
        borderRadius: '0.3rem',
        width: isMobile ? '90%' : '75%',
        maxWidth: '1140px',
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
    const modalTitleStyle = { fontSize: '1.25rem', margin: 0 };
    const closeButtonStyle = {
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
        borderRadius: '0.1rem', // Note: '0.1 rem' might be a typo, usually '0.1rem' or '.1rem'
        boxShadow: '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
        transition: 'transform 0.15s ease-in-out, background-color 0.15s ease-in-out',
        width: '85%', // Consider setting to '100%' if you want buttons to fill their grid item
        fontSize: '0.875rem',
    };

    const gridContainerStyle = {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
    };

    const gridItemStyle = {
        flex: isMobile ? '1 0 48%' : '1 0 23%', // ~2 items on mobile, ~4 on desktop
        boxSizing: 'border-box',
        display: 'flex', // Added to help center the button if its width is less than 100% of gridItem
        justifyContent: 'center', // Added
    };


    return (
        <div style={overlayStyle} onClick={() => setShowAgencySelector(false)}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h4 style={modalTitleStyle}>{selectedAgencyGroup} Form Selection</h4>
                    <button
                        type="button"
                        style={closeButtonStyle}
                        onClick={() => setShowAgencySelector(false)}
                        aria-label="Close"
                    >
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>

                <div style={modalBodyStyle}>
                    {isMobile ? (
                        <Form.Select
                            aria-label={`Select a ${selectedAgencyGroup} form`}
                            onChange={(e) => {
                                if (e.target.value) {
                                    handleAgencySelect(parseInt(e.target.value));
                                }
                            }}
                            defaultValue=""
                            className="bg-secondary text-white border-secondary mb-3"
                        >
                            <option value="" disabled>Select a {selectedAgencyGroup} form</option>
                            {availableForms.map(form => ( // This list is now sorted
                                <option key={form.version} value={form.version}>{form.name}</option>
                            ))}
                        </Form.Select>
                    ) : (
                        <div style={gridContainerStyle}>
                            {availableForms.map(form => ( // This list is now sorted
                                <div key={form.version} style={gridItemStyle}>
                                    <Button
                                        variant="custom-dark"
                                        style={formButtonStyle}
                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#495057'}
                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#343a40'}
                                        onClick={() => handleAgencySelect(form.version)}
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
                    )}
                    <div className="mt-4">
                        <Form.Check
                            type="checkbox"
                            id="hideMainFormSelector"
                            label=" Don't show this popup again (for this session)"
                            checked={hideAgencySelector}
                            onChange={(e) => {
                                setHideAgencySelector(e.target.checked);
                                if (e.target.checked) {
                                    setShowAgencySelector(false);
                                }
                            }}
                            className="text-muted"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgencySelector;
