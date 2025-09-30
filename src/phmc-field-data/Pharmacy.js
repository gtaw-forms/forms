import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select'; // Make sure react-select is imported

// Destructure the props that this component will need from App.js
const PHMCCommentaryNoteQuestions = ({
    formData,
    handleChange,
    setShowEmployeeModal,
    phmcGroupedOptions,
    isUploading,
    handleImageUpload, 
    setFormData // We need this for the Select's onChange logic
}) => {
    return (
        <>
            {/* The JSX code block for bbCodeVersion === 22 */}
            <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="Patient ID (If available)"
                required
                className="form-control"
            />

            <Form.Label>Perscription Issued Date:</Form.Label>
            <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="form-control"
            />
            <Form.Control
                type="text" 
                name="drugName"
                value={formData.drugName}
                onChange={handleChange}
                placeholder="Drug Name"
                required
                className={`form-control ${!formData.drugName ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugDiag"
                value={formData.drugDiag}
                onChange={handleChange}
                placeholder="Diagnosis / Reasoning for Drug"
                required
                className={`form-control ${!formData.drugDiag ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugStr"
                value={formData.drugStr}
                onChange={handleChange}
                placeholder="Drug Strength"
                required
                className={`form-control ${!formData.drugStr ? 'is-invalid' : ''}`}
            />
            <Form.Control
                type="text" 
                name="drugCourse"
                value={formData.drugCourse}
                onChange={handleChange}
                placeholder="Drug Course"
                required
                className={`form-control ${!formData.drugCourse ? 'is-invalid' : ''}`}
            />
            <Form.Group className="mb-3 upload-container">
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        name="scenePhotos"
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        rows="2"
                        required
                        className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                        placeholder="Upload Scene Photos (comma-separated)"
                        onPaste={(e) => { // Keep the paste logic
                            const clipboardData = e.clipboardData || window.clipboardData;
                            const pastedData = clipboardData.getData('text');
                            const items = clipboardData.items;
                            let hasImageItem = false;
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const containsUrl = urlRegex.test(pastedData);

                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    hasImageItem = true;
                                    const file = items[i].getAsFile();
                                    handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.scenePhotos || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
                            }
                        }}
                    />
                    <Button
                        variant="success"
                        disabled={isUploading}
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true;
                            input.onchange = (e) => handleImageUpload(e, 'scenePhotos');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Uploading...' : 'Upload Images'}
                    </Button>
                </InputGroup>
                <span className="helper-text">
                    This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                </span>
            </Form.Group>
            <Form.Group className="mb-3 upload-container">
                <div className="input-group">
                    <Form.Control
                        as="textarea"
                        name="additionalImages"
                        value={formData.additionalImages}
                        onChange={handleChange}
                        rows="2"
                        required
                        className={`form-control ${!formData.additionalImages ? 'is-invalid' : ''}`}
                        placeholder="Morgue Screen, Cinjuries, CDNA Links (comma-separated)"
                        onPaste={(e) => { // Keep the paste logic
                            const clipboardData = e.clipboardData || window.clipboardData;
                            const pastedData = clipboardData.getData('text');
                            const items = clipboardData.items;
                            let hasImageItem = false;
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const containsUrl = urlRegex.test(pastedData);

                            for (let i = 0; i < items.length; i++) {
                                if (items[i].type.indexOf('image') !== -1) {
                                    hasImageItem = true;
                                    const file = items[i].getAsFile();
                                    handleImageUpload({ target: { files: [file] } }, 'additionalImages');
                                    e.preventDefault();
                                    break;
                                }
                            }
                            if (containsUrl && !hasImageItem) {
                                const currentValue = formData.additionalImages || '';
                                const cursorPos = e.target.selectionStart;
                                const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                const newValue = currentValue.slice(0, cursorPos) +
                                    (cursorPos > 0 ? separator : '') +
                                    pastedData +
                                    currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, additionalImages: newValue }));
                                e.preventDefault();
                            } else {
                                console.log('No URL detected or image item present');
                            }
                        }}
                    />
                    <Button
                        variant="success"
                        disabled={isUploading}
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.multiple = true;
                            input.onchange = (e) => handleImageUpload(e, 'additionalImages');
                            input.click();
                        }}
                    >
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                        {isUploading ? 'Uploading...' : 'Upload Images'}
                    </Button>
                </div>
                <span className="helper-text">
                    This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                </span>
                <label>Morgue Bugs:</label> {/* Use <Form.Label> ? */}
                <Form.Check
                    type="checkbox"
                    id="morgueStatus"
                    label="       Tick if Morgue Screen is unavailable / broken / inaccesssable"
                    checked={formData.morgueStatus === 'true'}
                    onChange={(e) => setFormData(prev => ({ // Use setFormData passed as prop
                        ...prev,
                        morgueStatus: e.target.checked.toString()
                    }))}
                />
            </Form.Group>

            <Form.Label></Form.Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowEmployeeModal(true)}
                    className="close-button" // Consider a more specific class if needed
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

            <Select
                name="phmcEmployee"
                value={phmcGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.phmcEmployee) || null}
                onChange={(selectedOption) => {
                    // This logic needs setFormData, which is passed as a prop
                    const lastName = selectedOption ? selectedOption.lastName : '';
                    setFormData(prev => ({
                        ...prev,
                        phmcEmployee: selectedOption ? selectedOption.value : '',
                        lastName: lastName // Use lastName from the selected option
                    }));
                }}
                options={phmcGroupedOptions}
                isClearable
                placeholder="Search or select doctor..."
                className="form-control"
                styles={{ // Keep the styles for react-select
                    control: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: '#30363d',
                        '&:hover': {
                            borderColor: '#30363d'
                        }
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
                    })
                }}
            />
            <Form.Label></Form.Label>
        </>
    );
};

export default PHMCCommentaryNoteQuestions;