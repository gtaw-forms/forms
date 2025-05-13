import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap'; // Added Button and InputGroup
import Select from 'react-select';

const DeathReport = ({ // Renamed component to follow PascalCase convention
    formData,
    handleChange,
    handleSelectChange, // Added this prop
    setShowMissingEmployeeModal,
    setShowCoronerRankModal, // Added this prop
    coronerGroupedOptions,
    handleDoeChange,
    setFormData,
    isJohnDoe, // Added this prop
    isJaneDoe, // Added this prop
    currentUtcTime, // Added this prop
    isUploading,
    handleImageUpload, 
    showRequestingOfficerInput,
    setShowRequestingOfficerInput

}) => {
    return (
        <>
            <p>The Coroner Report Generated needs to be filled out fully, you can upload images locally or link pictures. </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
                <button
                    type="button"
                    onClick={() => setShowMissingEmployeeModal(true)}
                    className="close-button" // Consider using Button variant="link" or a specific style
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
                    className="close-button" // Consider using Button variant="link" or a specific style
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
                // Use the specific handler passed down
                onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                options={coronerGroupedOptions}
                isClearable
                placeholder="Search or select coroner..."
                className={`form-control ${!formData.coronerEmployee ? 'is-invalid' : ''}`}
                styles={{ // Keep react-select styles
                    control: (base) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: '#6c757d',
                        '&:hover': {
                            borderColor: '#eeeeeeb0'
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
            {/* Removed unused FormHelperText */}
            <Form.Label></Form.Label> {/* Consider removing empty labels if not needed for spacing */}
            <Form.Label>
                Dispatch Time | Decedent Time of Death
                <span style={{ fontSize: '0.8em', color: '#6c757d', marginLeft: '10px' }}>
                    (Current Server Time: {currentUtcTime})
                </span>
            </Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="datetime-local"
                    name="dateTime"
                    value={formData.dateTime}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.dateTime ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="datetime-local"
                    name="pronouncedTimeOfDeath"
                    value={formData.pronouncedTimeOfDeath}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.pronouncedTimeOfDeath ? 'is-invalid' : ''}`}
                />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <Form.Check
                type="checkbox"
                label="Report Requested?"
                name="showRequestingOfficerInput" // CRITICAL: This name must match the key in formData
                checked={formData.showRequestingOfficerInput || false} // Use value from formData, default to false
                onChange={handleChange} // Pass the event directly to App.js's handleChange
            />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
                className={`form-control ${!formData.department ? 'is-invalid' : ''}`} // Use form-control for consistency
            >
                <option value="" disabled>Select Requesting Agency</option>
                <option value="LSFD">LSFD</option>
                <option value="LSPD">LSPD</option>
                <option value="LSSD">LSSD</option>
                <option value="PHMC">PHMC</option>
                <option value="SANFIRE">SANFIRE</option>
                <option value="SADCR">SADCR</option>
                <option value="LSGOV">LSGOV</option>
                <option value="911 Call">Emergency 911 Dispatch</option>
                <option value="Protech">Protech Security Solutions</option>
            </Form.Select>
            {formData.showRequestingOfficerInput && (
                    <Form.Control
                        type="text"
                        name="requestingOfficer" // This field is separate
                        value={formData.requestingOfficer || ''}
                        onChange={handleChange}
                        placeholder="e.g: Officer John Doe, LSPD"
                    />
            )}
            </div>


            <div className="radio-inline-container">
                <span className="radio-text">Decedent Name:</span>
                <div className="radio-button-group">
                    <Form.Check
                        type="radio"
                        id="johnDoe"
                        label="   John Doe"
                        checked={isJohnDoe}
                        onChange={handleDoeChange('john')}
                        inline
                    />
                    <Form.Check
                        type="radio"
                        id="janeDoe"
                        label="   Jane Doe"
                        checked={isJaneDoe}
                        onChange={handleDoeChange('jane')}
                        inline
                    />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="decedentName"
                    value={formData.decedentName}
                    onChange={handleChange}
                    placeholder="Decedent's IC name"
                    required
                    className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                />
                <Form.Control
                    type="text"
                    name="decedentOOC"
                    value={formData.decedentOOC}
                    onChange={handleChange}
                    placeholder="Decedent's OOC name"
                    required
                    className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                />
            </div>

            <Form.Select
                name="typeOfDeath"
                value={formData.typeOfDeath}
                onChange={handleChange}
                required
                className={`form-control ${!formData.typeOfDeath ? 'is-invalid' : ''}`} // Use form-control
            >
                <option value="" disabled>Select Type of Death</option> {/* Changed default from ... */}
                <option value="PK">PK</option>
                <option value="CK">CK</option>
            </Form.Select>
            <Form.Control
                type="text"
                name="placeOfDeath"
                value={formData.placeOfDeath}
                onChange={handleChange}
                placeholder="Place of death"
                required
                className={`form-control ${!formData.placeOfDeath ? 'is-invalid' : ''}`}
            />
            <Form.Select
                name="mannerOfDeath"
                value={formData.mannerOfDeath}
                onChange={handleChange}
                required
                className={`form-control ${!formData.mannerOfDeath ? 'is-invalid' : ''}`} // Use form-control
            >
                <option value="" disabled>Select Manner of Death</option>
                <option value="Natural">Natural - the death resulted from natural causes, such as disease or old age.</option>
                <option value="Accident">Accidental - the death resulted from an unintentional or unexpected event, such as a car accident or drug overdose.</option>
                <option value="Suicide">Suicide - the death resulted from a self-inflicted injury with the intention to end ones life.</option>
                <option value="Homicide">Homicide - the death resulted from the intentional actions of another person, such as a murder, manslaughter and/or legally justified means such as self defense. </option>
                <option value="Undetermined">Undetermined - the evidence is insufficient to determine the manner of death</option>
            </Form.Select>

            <Form.Control
                as="textarea"
                name="synopsis"
                value={formData.synopsis}
                onChange={handleChange}
                rows="4"
                placeholder="Brief Summary"
                required
                className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`}
            />
            <label>Evidence Locker Submission:</label> {/* Use <Form.Label> for consistency? */}
            <Form.Check
                type="checkbox"
                id="evidenceLocker"
                label="       I have submitted evidence to the evidence locker"
                checked={formData.evidenceLocker === 'true'}
                onChange={(e) => setFormData(prev => ({ // Use setFormData passed as prop
                    ...prev,
                    evidenceLocker: e.target.checked.toString(),
                    evidenceLockerID: '' // Clear the Evidence Locker ID when unchecked
                }))}
            />
            {formData.evidenceLocker === 'true' && (
                <span className="helper-text">Please use commas (,) to seperate multiple items!</span>
            )}
            {formData.evidenceLocker === 'true' && (
                <Form.Control
                    type="text"
                    name="evidenceLockerID"
                    value={formData.evidenceLockerID}
                    onChange={handleChange}
                    placeholder="Enter Evidence Locker Submission ID"
                    required
                    className={`form-control ${!formData.evidenceLockerID ? 'is-invalid' : ''}`}
                />
            )}
            <label></label> {/* Consider removing empty labels */}

            <Form.Control
                type="text"
                name="probableCauseOfDeath"
                value={formData.probableCauseOfDeath}
                onChange={handleChange}
                placeholder="Probable cause of death"
                required
                className={`form-control ${!formData.probableCauseOfDeath ? 'is-invalid' : ''}`}
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
                    This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
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
                    This supports clipboard uploading, ctrl + V! | Hosted by Imgur! - <a href="https://imgur.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
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
            {/* --- End of JSX block --- */}
        </>
    );
};

export default DeathReport; // Export with PascalCase name
