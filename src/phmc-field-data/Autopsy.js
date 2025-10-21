import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import AutopsyDiagramModal from '../components/AutopsyDiagramModal';
import * as Sentry from "@sentry/react";
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';

const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    groupedOptions, 
    handleSelectChange, 
    setShowEmployeeModal,
    employeeType = 'coroner'
}) => {
    const {
        user: gtaWorldUser,
        isAuthenticated: isGtaAuthenticated,
        canSwapCharacters,
        swapCharacter,
        swappableCharacters,
        factionData
    } = useGtaWorldAuth();

    const [useGtawName, setUseGtawName] = useState(false);
        const employeeNameField = `${employeeType}Employee`;
    const employeeBadgeField = `${employeeType}Badge`;
    const employeeRankField = `${employeeType}Rank`;
    const employeeDiscordField = `${employeeType}Discord`;
    const employeePHNumberField = `${employeeType}PHNumber`;

    const isDevelopmentEnvironment =
        window.location.hostname === 'localhost' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./); 
    
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !useGtawName) {
            // Check if we have a valid character name
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName && gtawCharacterName !== 'GTAW User') {
                setUseGtawName(true);
                
                // Clean rank by removing dashes
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    gtaWorldUser.faction.rank.replace(/-/g, '').trim() : 'GTAW User';
                
                // Get character data using helper function
                const characterId = getCharacterID(gtaWorldUser);
                
                setFormData(prev => ({
                    ...prev,
                    [employeeNameField]: gtawCharacterName,
                    [employeeBadgeField]: characterId, 
                    [employeeRankField]: cleanRank,
                    [employeeDiscordField]: gtaWorldUser?.username || '',
                    [employeePHNumberField]: '50056'
                }));
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField]);
    
    useEffect(() => {
        if (useGtawName && isGtaAuthenticated && gtaWorldUser && factionData) {
            const cleanRank = factionData.rank ? factionData.rank.split('-')[0].trim() : 'GTAW User';
            setFormData(prev => ({
                ...prev,
                coronerEmployee: factionData.characterName,
                coronerBadge: factionData.characterId || '',
                coronerRank: cleanRank,
                coronerDiscord: gtaWorldUser?.username || '',
                coronerPHNumber: '50056'
            }));
        }
    }, [factionData, useGtawName, isGtaAuthenticated, gtaWorldUser, setFormData]);

    const gtawCharacterName = factionData?.characterName || null;

    const handleSwap = () => {
        if (!canSwapCharacters) return;
        const currentIndex = swappableCharacters.findIndex(c => c.character.characterId === factionData.characterId);
        const nextIndex = (currentIndex + 1) % swappableCharacters.length;
        const nextCharacterId = swappableCharacters[nextIndex].character.characterId;
        swapCharacter(nextCharacterId);
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Name</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="close-button"
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.2'
                    }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Missing Name?
                </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                {(isGtaAuthenticated && gtawCharacterName) && (
                    <button
                        type="button"
                        onClick={() => setUseGtawName(!useGtawName)}
                        className="btn btn-outline-light"
                        style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            border: useGtawName ? '1px solid #28a745' : '1px solid #6c757d',
                            color: useGtawName ? '#28a745' : '#6c757d'
                        }}
                        title={useGtawName ? `Using GTAW: ${gtawCharacterName}` : `Use GTAW name: ${gtawCharacterName}`}
                    >
                        <i className={`fas ${useGtawName ? 'fa-check' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
                        {useGtawName ? 'Using GTAW' : 'Use GTAW'}
                    </button>
                )}
                {canSwapCharacters && useGtawName && (
                    <button type="button" onClick={handleSwap} className="btn btn-outline-info" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
                        <i className="fas fa-random" style={{ marginRight: '5px' }}></i>
                        Switch Employee
                    </button>
                )}
                {isDevelopmentEnvironment && !isGtaAuthenticated && (
                    <div style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#ffc107', 
                        color: '#000', 
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                    }}>
                        <i className="fas fa-code" style={{ marginRight: '5px' }}></i>
                        Development Mode: Manual Selection Enabled
                    </div>
                )}
            </div>
            
            {useGtawName ? (
                <div style={{ 
                    padding: '10px', 
                    backgroundColor: '#1a2332', 
                    border: '1px solid #28a745', 
                    borderRadius: '4px',
                    marginBottom: '1rem'
                }}>
                    <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '5px' }}>
                        <i className="fas fa-user-check" style={{ marginRight: '8px' }}></i>
                        Using GTAW OAuth Credentials
                    </div>
                    <div style={{ color: '#eeeeeeb0' }}>
                        <strong>Character Name:</strong> {gtawCharacterName}<br/>
                        <strong>UCP User:</strong> {gtaWorldUser?.username}<br/>
                        <strong>Badge Number:</strong> {factionData?.characterId || gtaWorldUser?.id}<br/>
                        {factionData?.rank && (
                            <><strong>Rank:</strong> {factionData.rank.split('-')[0].trim()}<br/></>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use GTAW" again to switch back to database selection</small>
                    </div>
                </div>
            ) : isDevelopmentEnvironment ? (
                <Select
                    name={employeeNameField}
                    value={groupedOptions
                        .flatMap(group => group.options)
                        .find(option => option.value === formData[employeeNameField]) || null}
                    onChange={(selectedOption) => handleSelectChange(selectedOption, { name: employeeNameField })}
                    options={groupedOptions}
                    isClearable
                    placeholder={`Search or select ${employeeType}...`}
                    className={`form-control ${!formData[employeeNameField] ? 'is-invalid' : ''}`}
                    styles={{ 
                        control: (base, state) => ({
                            ...base,
                            backgroundColor: '#16202c',
                            color: '#eeeeeeb0',
                            borderColor: !formData[employeeNameField] && state.isFocused ? '#dc3545' :
                                         !formData[employeeNameField] ? '#dc3545' :
                                         state.isFocused ? '#86b7fe' : '#6c757d',
                            '&:hover': {
                                borderColor: !formData[employeeNameField] ? '#dc3545' : '#86b7fe'
                            },
                            boxShadow: !formData[employeeNameField] && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
                                       state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
                        }),
                        menu: (base) => ({ ...base, backgroundColor: '#16202c', zIndex: 1000 }),
                        option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
                        singleValue: (base) => ({ ...base, color: '#eeeeeeb0' }),
                        input: (base) => ({ ...base, color: '#eeeeeeb0' }),
                        placeholder: (base) => ({ ...base, color: '#eeeeeeb0' }),
                        group: (base) => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
                        groupHeading: (base) => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 })
                    }}
                />
            ) : null}
            
            {!useGtawName && !isGtaAuthenticated && !isDevelopmentEnvironment && (
                <div style={{ 
                    padding: '15px', 
                    backgroundColor: '#2a2a2a', 
                    border: '1px solid #6c757d', 
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#6c757d', marginBottom: '10px' }}>
                        <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                        GTAW Authentication Required
                    </div>
                    <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
                        Please log in with your GTAW account to automatically populate your credentials.
                    </div>
                </div>
            )}
        </>
    );
};

const Autopsy = ({
    formData,
    handleChange,
    setFormData,
    groupedOptions,
    coronerGroupedOptions,
    handleSelectChange,
    isUploading,
    setShowEmployeeModal,
    showNotification,
    commitInfo, // <-- Add commitInfo to props
    removeNotification,
    handleImageUpload

}) => {

    const [showAutopsyDiagramModal, setShowAutopsyDiagramModal] = useState(false);

    const handleOpenDiagramModal = () => setShowAutopsyDiagramModal(true);
    const handleCloseDiagramModal = () => setShowAutopsyDiagramModal(false);

    const handleSaveAutopsyDiagram = (markers) => {
        setFormData(prev => ({
            ...prev,
            autopsyDiagramMarkers: markers,
        }));
        handleCloseDiagramModal();
        if (showNotification) {
            showNotification("Autopsy diagram marker data saved!", "save");
        } else {
            console.warn("[Autopsy.js] showNotification is not available in handleSaveAutopsyDiagram");
        }
    };

    const handleAddDeathCause = () => {
        setFormData(prev => ({
            ...prev,
            autopsyDeathCauses: [...(prev.autopsyDeathCauses || ['']), '']
        }));
    };

    const handleDeathCauseChange = (index, value) => {
        setFormData(prev => {
            const newCauses = [...(prev.autopsyDeathCauses || [''])];
            newCauses[index] = value;
            return { ...prev, autopsyDeathCauses: newCauses };
        });
    };

    const handleRemoveDeathCause = (index) => {
        setFormData(prev => {
            const newCauses = [...(prev.autopsyDeathCauses || [''])];
            if (newCauses.length > 1) {
                newCauses.splice(index, 1);
            } else if (newCauses.length === 1 && index === 0) {
                newCauses[0] = '';
            }
            return { ...prev, autopsyDeathCauses: newCauses };
        });
    };
 
    const handleAutopsyImageUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            showNotification('No files selected for autopsy photos.', 'warning');
            return;
        }

        let indefiniteNotificationId = null;
        indefiniteNotificationId = showNotification('Processing autopsy photos, please wait...', 'info-circle', 0);

        const uploadedImageLinks = [];

        try {
            for (const file of files) {
                const imageUrl = await handleImageUpload(file);
                if (imageUrl) {
                    uploadedImageLinks.push(imageUrl);
                }
            }

            if (uploadedImageLinks.length > 0) {
                setFormData(prev => {
                    const existingLinks = prev.autopsyAlbumUrl ? prev.autopsyAlbumUrl.split(',').map(s => s.trim()).filter(s => s) : [];
                    const allLinks = [...existingLinks, ...uploadedImageLinks];
                    const uniqueLinks = [...new Set(allLinks)];
                    return {
                        ...prev,
                        autopsyAlbumUrl: uniqueLinks.join(', '),
                        autopsyPhotosUnavailable: false
                    };
                });
                showNotification(`Successfully uploaded ${uploadedImageLinks.length}/${files.length} image(s). Links added to the photography field.`, 'check-circle', 7000);
            } else if (files.length > 0) {
                showNotification(`No images were successfully uploaded.`, 'warning', 5000);
            }

        } catch (error) {
            console.error('[Autopsy Photos] An error occurred during image upload:', error);
            Sentry.captureException(error, { extra: { context: 'handleAutopsyImageUpload' } });
            showNotification(`Error uploading images: ${error.message}`, 'exclamation-triangle', 7000);
        } finally {
            if (indefiniteNotificationId) {
                removeNotification(indefiniteNotificationId);
            }
        }
    };


    const handleAnatomicSummaryItemChange = (index, value) => {
        setFormData(prev => {
            const currentItems = Array.isArray(prev.autopsyAnatomicSummaryItems) ? prev.autopsyAnatomicSummaryItems : [''];
            const newItems = [...currentItems];
            newItems[index] = value;
            return { ...prev, autopsyAnatomicSummaryItems: newItems };
        });
    };
    const handleAddAnatomicSummaryItem = () => {
        setFormData(prev => ({
            ...prev,
            autopsyAnatomicSummaryItems: [...(prev.autopsyAnatomicSummaryItems || ['']), '']
        }));
    };
    const handleRemoveAnatomicSummaryItem = (index) => {
        setFormData(prev => {
            const currentItems = Array.isArray(prev.autopsyAnatomicSummaryItems) ? prev.autopsyAnatomicSummaryItems : [''];
            const newItems = [...currentItems];
            if (newItems.length > 1) {
                newItems.splice(index, 1);
            } else if (newItems.length === 1 && index === 0) {
                newItems[0] = '';
            }
            return { ...prev, autopsyAnatomicSummaryItems: newItems };
        });
    };


    return (
        <>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <Form.Control
                    type="text"
                    name="decedentName"
                    value={formData.decedentName || ''}
                    onChange={handleChange}
                    placeholder="Decedent's IC name"
                    required
                    className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="decedentOOC"
                    value={formData.decedentOOC || ''}
                    onChange={handleChange}
                    placeholder="Decedent's OOC name"
                    required
                    className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                />
            </div>
            <Form.Label style={{ marginBottom: 0 }}>Date & Time of Autopsy </Form.Label>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                <Form.Control
                    type="date"
                    name="autopsyDate"
                    value={formData.autopsyDate || ''}
                    onChange={handleChange}
                    placeholder="Autopsy Date"
                    required
                    className={`form-control ${!formData.autopsyDate ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="time"
                    name="autopsyTime"
                    value={formData.autopsyTime || ''}
                    onChange={handleChange}
                    placeholder="Autopsy Time"
                    required
                    className={`form-control ${!formData.autopsyTime ? 'is-invalid' : ''}`}
                />
            </div>

            {/* Button to open the Autopsy Diagram Modal */}
            <Form.Group className="mb-3">
                <Form.Label>Autopsy Injury Diagram</Form.Label>
                <div>
                    <Button variant="info" onClick={handleOpenDiagramModal}>
                        <i className="fas fa-male" style={{ marginRight: '5px' }}></i>
                        Open Injury Diagram Tool ({formData.autopsyDiagramMarkers?.length || 0} markers)
                    </Button>
                </div>
            </Form.Group>

            <Form.Label>Cause(s) of Death:</Form.Label>
            {(formData.autopsyDeathCauses || ['']).map((cause, index) => (
                <div key={`deathcause-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Form.Control
                        as="textarea"
                        value={cause}
                        rows={2}
                        onChange={(e) => handleDeathCauseChange(index, e.target.value)}
                        placeholder={`Cause of Death ${index + 1}`}
                        required={index === 0 && !cause.trim()}
                        className={`form-control ${index === 0 && !cause.trim() && (formData.autopsyDeathCauses?.length > 0) ? 'is-invalid' : ''}`}
                    />
                    {formData.autopsyDeathCauses && formData.autopsyDeathCauses.length > 0 && (
                        <Button
                            variant="danger"
                            onClick={() => handleRemoveDeathCause(index)}
                            style={{ marginLeft: '8px', transform: 'translateY(-11px)' }}
                            size="sm"
                            title="Remove Cause"
                        >
                            <i className="fas fa-times"></i>
                        </Button>
                    )}
                </div>
            ))}
            <Button variant="secondary" onClick={handleAddDeathCause} size="sm" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <i className="fas fa-plus"></i> Add New Death Cause
            </Button>

            <Form.Label>Manner of Death:</Form.Label>
            <Form.Control
                type="text"
                name="deathType"
                value={formData.deathType || ''}
                onChange={handleChange}
                placeholder="e.g., Homicide, Accident, Natural"
                className={`form-control mb-2 ${!formData.deathType ? 'is-invalid' : ''}`}
            />

            <Form.Label>How Injury Occurred:</Form.Label>
            <Form.Control
                type="text"
                name="causeOfDeath"
                value={formData.causeOfDeath || ''}
                onChange={handleChange}
                placeholder="e.g., Multiple gunshot wounds"
                className={`form-control mb-2 ${!formData.causeOfDeath ? 'is-invalid' : ''}`}
            />
            <Form.Label>External Examination:</Form.Label>
            <Form.Control
                as="textarea" // Changed to textarea for potentially longer descriptions
                rows={3}
                name="externalExamination"
                value={formData.externalExamination || ''}
                onChange={handleChange}
                placeholder="Detailed external examination findings (e.g., identifying marks, condition of the body, specific injuries observed externally)"
                className={`form-control mb-2 ${!formData.externalExamination ? 'is-invalid' : ''}`}
            />

            <Form.Label>Anatomic Summary Items:</Form.Label>
            {(formData.autopsyAnatomicSummaryItems || ['']).map((item, index) => (
                <div key={`anatomic-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        value={item}
                        onChange={(e) => handleAnatomicSummaryItemChange(index, e.target.value)}
                        placeholder={`Anatomic Summary Item ${index + 1}`}
                        className={`form-control ${index === 0 && !item.trim() && (formData.autopsyAnatomicSummaryItems?.length > 0) ? 'is-invalid' : ''}`}
                    />
                    {formData.autopsyAnatomicSummaryItems && formData.autopsyAnatomicSummaryItems.length > 0 && (
                        <Button
                            variant="danger"
                            onClick={() => handleRemoveAnatomicSummaryItem(index)}
                            style={{ marginLeft: '8px', transform: 'translateY(-11px)' }}
                            size="sm"
                            title="Remove Summary Item"
                        >
                            <i className="fas fa-times"></i>
                        </Button>
                    )}
                </div>
            ))}
            <Button variant="secondary" onClick={handleAddAnatomicSummaryItem} size="sm" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                <i className="fas fa-plus"></i> Add Anatomic Summary Item
            </Button>

            <Form.Label>Radiology Result:</Form.Label>
            <Form.Control
                as="textarea" // Changed to textarea for potentially longer descriptions
                rows={2}
                name="RadiologyResult"
                value={formData.RadiologyResult || ''}
                onChange={handleChange}
                placeholder="e.g., No foreign objects detected. X-rays show three projectiles in the body."
                className={`form-control mb-2 ${!formData.RadiologyResult ? 'is-invalid' : ''}`}
            />

            <Form.Label>Photography (Comma-separated URLs):</Form.Label>
            <InputGroup className="mb-1">
                <Form.Control
                    as="textarea" // Changed to textarea for better visibility of multiple URLs
                    rows={3}
                    name="autopsyAlbumUrl" // Keeping name for consistency, though it's not an album URL anymore
                    value={formData.autopsyAlbumUrl || ''}
                    onChange={handleChange}
                    placeholder="Paste ImgBB URLs here, separated by commas, or use upload button."
                    className={`form-control ${!formData.autopsyPhotosUnavailable && !(formData.autopsyAlbumUrl || '').trim() ? 'is-invalid' : ''}`}
                    disabled={formData.autopsyPhotosUnavailable}
                />
                <Button
                    variant="success"
                    disabled={isUploading || formData.autopsyPhotosUnavailable}
                    onClick={() => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*';
                        fileInput.multiple = true;
                        fileInput.onchange = handleAutopsyImageUpload;
                        fileInput.click();
                    }}
                >
                    <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                    {isUploading ? ' Processing...' : ' Upload Photo(s)'}
                </Button>
            </InputGroup>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Check
                    type="checkbox"
                    label="Photographs are unavailable for this case"
                    name="autopsyPhotosUnavailable"
                    checked={formData.autopsyPhotosUnavailable || false}
                    onChange={handleChange}
                    className="mb-3"
                />
            </div>

            <Form.Label>Opinion (Medical Examiner's Synopsis):</Form.Label>
            <Form.Control
                as="textarea"
                name="synopsis"
                value={formData.synopsis || ''}
                onChange={handleChange}
                rows="5"
                placeholder="Medical Examiner's opinion on the decedent's condition and cause of death"
                className={`form-control mb-2 ${!formData.synopsis ? 'is-invalid' : ''}`}
            />
            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="coroner"
            />

            {/* Autopsy Diagram Modal Instance */}
            <AutopsyDiagramModal
               show={showAutopsyDiagramModal}
               onHide={handleCloseDiagramModal}
               onSaveDiagram={handleSaveAutopsyDiagram}
               handleImageUpload={handleImageUpload}
               initialMarkers={formData.autopsyDiagramMarkers || []}
               showNotification={showNotification}
            />
        </>
    );
};

export default Autopsy;