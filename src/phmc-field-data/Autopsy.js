import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';
import AutopsyDiagramModal from '../components/AutopsyDiagramModal';

const Autopsy = ({
    formData,
    handleChange,
    setFormData,
    coronerGroupedOptions,
    handleSelectChange,
    isUploading,
    handleAutopsyImageUploadAndCreateAlbum,
    setShowMissingEmployeeModal,
    setShowCoronerRankModal,
    showNotification,
}) => {
    // This useEffect is currently empty and can be removed if not used for other debugging.
    // useEffect(() => {
    // console.log('[Autopsy.js] Received showNotification prop:', typeof showNotification, showNotification);
    // }, [showNotification]);

    const [showAutopsyDiagramModal, setShowAutopsyDiagramModal] = useState(false);

    const handleOpenDiagramModal = () => setShowAutopsyDiagramModal(true);
    const handleCloseDiagramModal = () => setShowAutopsyDiagramModal(false);

    const handleSaveAutopsyDiagram = (markers) => {
        setFormData(prev => ({
            ...prev,
            autopsyDiagramMarkers: markers,
        }));
        // Note: Closing the modal here means if a user uploads to Imgur
        // and then clicks "Done & Save Diagram", the modal closes.
        // The Imgur URL is handled separately by onDiagramImgurUpload.
        handleCloseDiagramModal();
        if (showNotification) {
            showNotification("Autopsy diagram marker data saved!", "save");
        } else {
            console.warn("[Autopsy.js] showNotification is not available in handleSaveAutopsyDiagram");
        }
    };

    // New handler for when the diagram is successfully uploaded to Imgur from the modal
    const handleDiagramImgurUploadSuccess = (imgurUrl) => {
        setFormData(prev => ({
            ...prev,
            autopsyDiagramImgurUrl: imgurUrl, // Store the Imgur URL
        }));
        if (showNotification) {
            showNotification("Autopsy Diagram image uploaded and URL saved!", "upload");
        }
        // Optionally, you might want to close the modal here too, or let the user close it.
        // handleCloseDiagramModal(); 
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
                    placeholder="Paste Imgur URLs here, separated by commas, or use upload button."
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
                        fileInput.onchange = handleAutopsyImageUploadAndCreateAlbum;
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Medical Examiner Performing Autopsy</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowMissingEmployeeModal(true)}
                    className="close-button"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', lineHeight: '1.2' }}
                >
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
                    Missing Name?
                </button>
                <button
                    type="button"
                    onClick={() => setShowCoronerRankModal(true)}
                    className="close-button"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', lineHeight: '1.2' }}
                    title="Update Coroner Rank"
                >
                    <i className="fas fa-user-md" style={{ marginRight: '5px' }}></i>
                    Update Coroner Rank
                </button>
            </div>
            <Select
                name="coronerEmployee"
                value={coronerGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.coronerEmployee) || null}
                onChange={(selectedOption) => handleSelectChange(selectedOption, { name: 'coronerEmployee' })}
                options={coronerGroupedOptions}
                isClearable
                placeholder="Search or select coroner..."
                className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                styles={{
                    control: (base, state) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: !formData.coronerEmployee && state.isFocused ? '#dc3545' :
                                     !formData.coronerEmployee ? '#dc3545' :
                                     state.isFocused ? '#86b7fe' : '#6c757d',
                        '&:hover': {
                            borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                        },
                        boxShadow: !formData.coronerEmployee && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
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
            <Form.Label></Form.Label>

            {/* Autopsy Diagram Modal Instance */}
            <AutopsyDiagramModal
               show={showAutopsyDiagramModal}
               onHide={handleCloseDiagramModal}
               onSaveDiagram={handleSaveAutopsyDiagram} // Saves markers
               onDiagramImgurUpload={handleDiagramImgurUploadSuccess} // New prop for Imgur URL
               initialMarkers={formData.autopsyDiagramMarkers || []}
               showNotification={showNotification}
            />
        </>
    );
};

export default Autopsy;
