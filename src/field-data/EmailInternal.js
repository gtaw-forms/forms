import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap'; 
import Select from 'react-select';

const EmailInternal = ({
    formData,
    handleChange,
    setFormData,
    isUploading,
    handleImageUpload,
    phmcGroupedOptions

}) => {
    return (
        <>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="patientNotes"
                value={formData.patientNotes}
                onChange={handleChange}
                placeholder="Email Subject"
                required
                className={`form-control ${!formData.patientNotes ? 'is-invalid' : ''}`}

            />
            <Form.Control
                type="text"
                name="decedentName"
                value={formData.decedentName}
                onChange={handleChange}
                placeholder="Email Recipient"
                required
                className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}

            />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
            as="textarea"
            name="synopsis"
            value={formData.synopsis}
            onChange={handleChange}
            rows="4"
            placeholder="Email Body"
            required
            className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`}
        />
        </div>
        <Form.Group className="mb-3 upload-container">
        <InputGroup>
            <Form.Control
                as="textarea"
                rows="4"
                name="scenePhotos"
                value={formData.scenePhotos}
                onChange={handleChange}
                required
                className={`form-control ${!formData.scenePhotos ? 'is-invalid' : ''}`}
                placeholder="Employee Signature Image"
                onPaste={(e) => {
                    const clipboardData = e.clipboardData || window.clipboardData;
                    const pastedData = clipboardData.getData('text');
                    const items = clipboardData.items;


                    let hasImageItem = false;

                    // Check if pasted content is a URL
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const containsUrl = urlRegex.test(pastedData);


                    // Handle image files from clipboard
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            hasImageItem = true;
                            const file = items[i].getAsFile();
                            handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                            e.preventDefault();
                            break;
                        }
                    }

                    // If it's a URL and not an image file, allow direct paste
                    if (containsUrl && !hasImageItem) {

                        // Get current value and cursor position
                        const currentValue = formData.scenePhotos || '';
                        const cursorPos = e.target.selectionStart;


                        // Add comma if there's existing content
                        const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                        const newValue = currentValue.slice(0, cursorPos) +
                            (cursorPos > 0 ? separator : '') +
                            pastedData +
                            currentValue.slice(cursorPos);


                        // Update form data
                        setFormData(prev => ({
                            ...prev,
                            scenePhotos: newValue
                        }));

                        e.preventDefault();
                    } else {
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
        This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </span>
    </Form.Group>

        <Select
        name="phmcEmployee"
        value={phmcGroupedOptions
            .flatMap(group => group.options)
            .find(option => option.value === formData.phmcEmployee) || null}
        onChange={(selectedOption) => {
            // eslint-disable-next-line no-unused-vars
            const lastName = selectedOption ? selectedOption.lastName : '';
            setFormData(prev => ({
                ...prev,
                phmcEmployee: selectedOption ? selectedOption.value : '',
                lastName: selectedOption ? selectedOption.lastName : '' // Use lastName from the selected option
            }));
        }}
        options={phmcGroupedOptions}
        isClearable
        placeholder="Search or select doctor..."
        className="form-control"
        styles={{
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
    <div style={{ display: 'flex', gap: '10px' }}>
            <Form.Control
                type="text"
                name="decedentOOC"
                value={formData.decedentOOC}
                onChange={handleChange}
                placeholder="PHMC Rank / Position"
                required
                className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}

            />
            <Form.Control
                type="text"
                name="patientCareer"
                value={formData.patientCareer}
                onChange={handleChange}
                placeholder="Assigned Department"
                required
                className={`form-control ${!formData.patientCareer ? 'is-invalid' : ''}`}

            />
        </div>
        </>
);
};

export default EmailInternal; 
