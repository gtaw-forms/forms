import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap'; // Added InputGroup
import Select from 'react-select';

const Autopsy = ({
    formData,
    handleChange, // General handleChange for simple inputs
    setFormData, 
    coronerGroupedOptions, // Assuming this is passed for coronerEmployee selection
    handleSelectChange, // If you have a specific handler for Select components
    isUploading, // Assuming this is a state for upload status
    handleAutopsyImageUploadAndCreateAlbum, // Function to handle image upload and album creation 
    setShowMissingEmployeeModal, // Function to show modal for missing employee
    setShowCoronerRankModal, // Function to show modal for updating coroner rank

    // ... other props
}) => {

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
                // If it's the last one, clear its content but keep the field
                newCauses[0] = '';
            }
            return { ...prev, autopsyDeathCauses: newCauses };
        });
    };

    // --- Handler for Anatomic Summary Item Change ---
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
        
            {/* ... Decedent Name inputs ... */}
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
                    placeholder="autopsyDate"
                    required
                    className={`form-control ${!formData.autopsyDate ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="time"
                    name="autopsyTime"
                    value={formData.autopsyTime || ''}
                    onChange={handleChange}
                    placeholder="autopsyTime"
                    required
                    className={`form-control ${!formData.autopsyTime ? 'is-invalid' : ''}`}
                />
            </div>

            {/* ... Cause(s) of Death section ... */}
            <Form.Label>Cause(s) of Death:</Form.Label>
            {(formData.autopsyDeathCauses || ['']).map((cause, index) => (
                <div key={`deathcause-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Form.Control
                        as="textarea"
                        value={cause}
                        rows={2}
                        onChange={(e) => handleDeathCauseChange(index, e.target.value)}
                        placeholder={`Cause of Death ${index + 1}`}
                        required={index === 0 && !cause.trim()} // First cause is required if list is not empty
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
                // Assuming this is required for a complete report, though BBCode has a fallback
                className={`form-control mb-2 ${!formData.deathType ? 'is-invalid' : ''}`}
            />

            <Form.Label>How Injury Occurred:</Form.Label>
            <Form.Control
                type="text"
                name="causeOfDeath"
                value={formData.causeOfDeath || ''}
                onChange={handleChange}
                placeholder="e.g., Multiple gunshot wounds"
                 // Assuming this is required for a complete report, though BBCode has a fallback
                className={`form-control mb-2 ${!formData.causeOfDeath ? 'is-invalid' : ''}`}
            />
                        <Form.Label>External Examination:</Form.Label>
            <Form.Control
                type="text" // Changed to text as it's a description
                name="externalExamination"
                value={formData.externalExamination || ''}
                onChange={handleChange}
                placeholder="External examination findings (e.g., bruises, lacerations)"
                // Assuming this is required for a complete report
                className={`form-control mb-2 ${!formData.externalExamination ? 'is-invalid' : ''}`}
            />

            {/* ... Anatomic Summary Items Section ... */}
            <Form.Label>Anatomic Summary Items:</Form.Label>
            {(formData.autopsyAnatomicSummaryItems || ['']).map((item, index) => (
                <div key={`anatomic-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        value={item}
                        onChange={(e) => handleAnatomicSummaryItemChange(index, e.target.value)}
                        placeholder={`Anatomic Summary Item ${index + 1}`}
                        // First anatomic summary item is required if the list is not empty
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
                type="text"
                name="RadiologyResult"
                value={formData.RadiologyResult || ''}
                onChange={handleChange}
                placeholder="e.g., No foreign objects detected (Bullets, Shrapnel, etc.)"
                // Assuming this is required for a complete report, though BBCode has a fallback
                className={`form-control mb-2 ${!formData.RadiologyResult ? 'is-invalid' : ''}`}
            />

            {/* --- NEW: Photography Section --- */}
            <Form.Label>Photography Album URL:</Form.Label>
            <InputGroup className="mb-1">
                <Form.Control
                    type="text"
                    name="autopsyAlbumUrl"
                    value={formData.autopsyAlbumUrl || ''}
                    onChange={handleChange}
                    placeholder="Imgur Album URL (e.g., https://imgur.com/a/XXXXXX)"
                    className={`form-control ${!formData.autopsyPhotosUnavailable && !formData.autopsyAlbumUrl.trim() ? 'is-invalid' : ''}`}
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
                        fileInput.onchange = handleAutopsyImageUploadAndCreateAlbum; // Use the new handler
                        fileInput.click();
                    }}
                >
                    <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                    {isUploading ? ' Processing...' : ' Upload & Create Album'}
                </Button>
            </InputGroup>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>

            <Form.Check
                type="checkbox"
                label="  Photographs are unavailable for this case"
                name="autopsyPhotosUnavailable"
                checked={formData.autopsyPhotosUnavailable || false}
                onChange={handleChange} // Standard handleChange from App.js will handle this
                className="mb-3" // No is-invalid needed for a checkbox typically
            />
            </div>
            {/* --- End Photography Section --- */}


            <Form.Label>Opinion (Medical Examiner's Synopsis):</Form.Label>
            <Form.Control
                as="textarea"
                name="synopsis" // This is used for the "Opinion" section in BBCode
                value={formData.synopsis || ''}
                onChange={handleChange}
                rows="5"
                placeholder="Medical Examiner's opinion on the decedent's condition and cause of death"
                // Assuming this is required for a complete report, though BBCode has a fallback
                className={`form-control mb-2 ${!formData.synopsis ? 'is-invalid' : ''}`}
            />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Medical Examiner Performing Autopsy</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowMissingEmployeeModal(true)}
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
                <button
                    type="button"
                    onClick={() => setShowCoronerRankModal(true)}
                    className="close-button" 
                    style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8rem',
                        lineHeight: '1.2'
                    }}
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
                        onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                        options={coronerGroupedOptions}
                        isClearable
                        placeholder="Search or select coroner..."
                        className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`} // react-select uses className for the wrapper
                        // For react-select, actual input validation styling is usually done via the `styles` prop
                        // or by targeting specific inner classes if `is-invalid` is meant for the input itself.
                        // The `form-control` class helps with Bootstrap's general layout.
                        styles={{ 
                            control: (base, state) => ({
                                ...base,
                                backgroundColor: '#16202c',
                                color: '#eeeeeeb0',
                                borderColor: !formData.coronerEmployee && state.isFocused ? '#dc3545' : // Example: red border on focus if invalid
                                             !formData.coronerEmployee ? '#dc3545' : // Example: red border if invalid
                                             state.isFocused ? '#86b7fe' : '#6c757d', // Default focus and normal border
                                '&:hover': {
                                    borderColor: !formData.coronerEmployee ? '#dc3545' : '#86b7fe'
                                },
                                boxShadow: !formData.coronerEmployee && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' : // Red focus shadow if invalid
                                           state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null, // Default focus shadow
                            }),
                            menu: (base) => ({
                                ...base,
                                backgroundColor: '#16202c',
                                zIndex: 1000
                            }),
                            option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isFocused ? 'Grey' : '#16202c',
                                color: '#eeeeeeb0'
                            }),
                            singleValue: (base) => ({
                                ...base,
                                color: '#eeeeeeb0'
                            }),
                            input: (base) => ({
                                ...base,
                                color: '#eeeeeeb0'
                            }),
                            placeholder: (base) => ({
                                ...base,
                                color: '#eeeeeeb0'
                            }),
                            group: (base) => ({
                                ...base,
                                paddingTop: 8,
                                paddingBottom: 8
                            }),
                            groupHeading: (base) => ({
                                ...base,
                                color: '#6c757d',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                                marginBottom: 4
                            })
                        }}
                    />
                    <Form.Label></Form.Label> 

        </>
    );
};

export default Autopsy;
