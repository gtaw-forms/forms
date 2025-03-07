// filepath: src/components/MyFormComponent.js
import React, { useState, useEffect } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';

function MyFormComponent({
    formData,
    setFormData,
    handleChange,
    handleSelectChange,
    handleDoeChange,
    addReport,
    removeReport,
    handleReportChange,
    isUploading,
    setIsUploading,
    handleImageUpload,
    isJohnDoe,
    setIsJohnDoe,
    isJaneDoe,
    setIsJaneDoe,
    coronerGroupedOptions,
    phmcGroupedOptions
}) {
    return (
        <form>
                        {bbCodeVersion === 1 ? (
                            <>
                                <p>The Coroner Report Generated needs to be filled out fully, you can upload images locally or link pictures. </p>
                                <Form.Label>Employee Credentials:</Form.Label>
                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className="form-control"
                                    styles={{
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
                                <Form.Label><br></br>Dispatch Date and Time:</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="dateTime"
                                    value={formData.dateTime}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className="form-select"
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
                                <Form.Control
                                    type="text"
                                    name="decedentName"
                                    value={formData.decedentName}
                                    onChange={handleChange}
                                    placeholder="Decedent's IC name"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    type="text"
                                    name="decedentOOC"
                                    value={formData.decedentOOC}
                                    onChange={handleChange}
                                    placeholder="Decedent's OOC name"
                                    required
                                    className="form-control"
                                />
                                <Form.Select
                                    name="typeOfDeath"
                                    value={formData.typeOfDeath}
                                    onChange={handleChange}
                                    required
                                    className="form-select"
                                >
                                    <option value="..." >Select Type of Death</option>
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
                                    className="form-control"
                                />
                                <Form.Select
                                    name="mannerOfDeath"
                                    value={formData.mannerOfDeath}
                                    onChange={handleChange}
                                    required
                                    className="form-select"
                                >
                                    <option value="" disabled>Select Manner of Death</option>
                                    <option value="Natural">Natural - the death resulted from natural causes, such as disease or old age.</option>
                                    <option value="Accident">Accidental - the death resulted from an unintentional or unexpected event, such as a car accident or drug overdose.</option>
                                    <option value="Suicide">Suicide - the death resulted from a self-inflicted injury with the intention to end ones life.</option>
                                    <option value="Homicide">Homicide - the death resulted from the intentional actions of another person, such as a murder, manslaughter and/or legally justified means such as self defense. </option>
                                    <option value="Undetermined">Undetermined - the evidence is insufficient to determine the manner of death</option>
                                </Form.Select>

                                <Form.Label>Pronounced Time of Death:</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="pronouncedTimeOfDeath"
                                    value={formData.pronouncedTimeOfDeath}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="synopsis"
                                    value={formData.synopsis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Brief Summary"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    type="text"
                                    name="probableCauseOfDeath"
                                    value={formData.probableCauseOfDeath}
                                    onChange={handleChange}
                                    placeholder="Probable cause of death"
                                    required
                                    className="form-control"
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
                                            className="form-control"
                                            placeholder="Upload Scene Photos (comma-separated)"
                                            onPaste={(e) => {
                                                console.log('Paste event triggered');
                                                const clipboardData = e.clipboardData || window.clipboardData;
                                                const pastedData = clipboardData.getData('text');
                                                const items = clipboardData.items;

                                                console.log('Pasted content:', pastedData);
                                                console.log('Clipboard items:', items);

                                                let hasImageItem = false;

                                                // Check if pasted content is a URL
                                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                const containsUrl = urlRegex.test(pastedData);

                                                console.log('Contains URL:', containsUrl);

                                                // Handle image files from clipboard
                                                for (let i = 0; i < items.length; i++) {
                                                    console.log('Checking item:', items[i].type);
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
                                                    console.log('Processing URL paste');

                                                    // Get current value and cursor position
                                                    const currentValue = formData.scenePhotos || '';
                                                    const cursorPos = e.target.selectionStart;

                                                    console.log('Current value:', currentValue);
                                                    console.log('Cursor position:', cursorPos);

                                                    // Add comma if there's existing content
                                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                    const newValue = currentValue.slice(0, cursorPos) +
                                                        (cursorPos > 0 ? separator : '') +
                                                        pastedData +
                                                        currentValue.slice(cursorPos);

                                                    console.log('New value:', newValue);

                                                    // Update form data
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        scenePhotos: newValue
                                                    }));

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
                                            className="form-control"
                                            placeholder="Morgue Screen, Cinjuries, CDNA Links (comma-separated)"
                                            onPaste={(e) => {
                                                console.log('Paste event triggered');
                                                const clipboardData = e.clipboardData || window.clipboardData;
                                                const pastedData = clipboardData.getData('text');
                                                const items = clipboardData.items;

                                                console.log('Pasted content:', pastedData);
                                                console.log('Clipboard items:', items);

                                                let hasImageItem = false;

                                                // Check if pasted content is a URL
                                                const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                const containsUrl = urlRegex.test(pastedData);

                                                console.log('Contains URL:', containsUrl);

                                                // Handle image files from clipboard
                                                for (let i = 0; i < items.length; i++) {
                                                    console.log('Checking item:', items[i].type);
                                                    if (items[i].type.indexOf('image') !== -1) {
                                                        hasImageItem = true;
                                                        const file = items[i].getAsFile();
                                                        handleImageUpload({ target: { files: [file] } }, 'additionalImages');
                                                        e.preventDefault();
                                                        break;
                                                    }
                                                }

                                                // If it's a URL and not an image file, allow direct paste
                                                if (containsUrl && !hasImageItem) {
                                                    console.log('Processing URL paste');

                                                    // Get current value and cursor position
                                                    const currentValue = formData.additionalImages || '';
                                                    const cursorPos = e.target.selectionStart;

                                                    console.log('Current value:', currentValue);
                                                    console.log('Cursor position:', cursorPos);

                                                    // Add comma if there's existing content
                                                    const separator = currentValue && currentValue.trim().length > 0 ? ', ' : '';
                                                    const newValue = currentValue.slice(0, cursorPos) +
                                                        (cursorPos > 0 ? separator : '') +
                                                        pastedData +
                                                        currentValue.slice(cursorPos);

                                                    console.log('New value:', newValue);

                                                    // Update form data
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        additionalImages: newValue
                                                    }));

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
                                    <label>Morgue Bugs:</label>
                                    <Form.Check
                                        type="checkbox"
                                        id="morgueStatus"
                                        label="       Tick if Morgue Screen is unavailable / broken / inaccesssable"
                                        checked={formData.morgueStatus === 'true'}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            morgueStatus: e.target.checked.toString()
                                        }))}
                                    />

                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 2 ? (
                            <>
                                <p>This generator prefills most of the forms for you, take a moment to review the BBCode prior to sending! </p>
                                <Form.Label>Employee Credentials:</Form.Label>
                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className="form-control"
                                    styles={{
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
                                <Form.Group className="mb-3">
                                    <Form.Label> <br></br>Officer Name or Badge Number:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="requestingOfficer"
                                        value={formData.requestingOfficer}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Requesting Agency:</Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="" disabled>Select Department</option>
                                        <option value="LSFD">LSFD</option>
                                        <option value="LSPD">LSPD</option>
                                        <option value="LSSD">LSSD</option>
                                        <option value="PHMC">PHMC</option>
                                        <option value="SANFIRE">SANFIRE</option>
                                        <option value="SADCR">SADCR</option>
                                        <option value="LSGOV">LSGOV</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>
                                        Coroner Contact Number:
                                    </Form.Label>
                                    <span className="helper-text">
                                        (By default PHMC Landline is added, if you have a work number please add it)
                                    </span>

                                    <Form.Control
                                        type="text"
                                        name="coronerPHNumber"
                                        value={formData.coronerPHNumber}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent(s) Names:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="decedentName"
                                        value={formData.decedentName}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Decedent OOC Name:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="decedentOOC"
                                        value={formData.decedentOOC}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Paste Death Report BBCode:</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="deathReport"
                                        value={formData.deathReport}
                                        onChange={handleChange}
                                        placeholder="Paste Death Report"
                                        rows="2"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Additional Reports:</Form.Label>
                                    <div className="reports-container">
                                        {formData.additionalReports.map((report, index) => (
                                            <div key={index} className="report-input">
                                                <Form.Control
                                                    as="textarea"
                                                    value={report}
                                                    onChange={(e) => handleReportChange(index, e.target.value)}
                                                    placeholder="Paste additional coroner report here"
                                                    rows="4"
                                                    className="form-control"
                                                />
                                                <Button
                                                    variant="danger"
                                                    onClick={() => removeReport(index)}
                                                    className="remove-report-button"
                                                >
                                                    REMOVE REPORT
                                                </Button>
                                            </div>
                                        ))}
                                        <div className="email-buttons">
                                            <Button
                                                variant="success"
                                                onClick={addReport}
                                                className="email-button"
                                            >
                                                <i className="fas fa-plus"></i> Add Report
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={parseBBCode}
                                                className="email-button"
                                            >
                                                <i className="fas fa-copy"></i> Parse BBCode
                                            </Button>
                                            <Button
                                                variant="danger"
                                                onClick={clearParsedBBCode}
                                                className="remove-report-button"
                                            >
                                                <i className="fas fa-times"></i> Clear BBCode
                                            </Button>
                                        </div>

                                    </div>
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 3 ? (
                            <>
                                <p>The FORM below is intended for the opening of a medical file, it must appear at the top.</p>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Medical Patient Record</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 2: Patient Demographics</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Select
                                        name="patientGender"
                                        value={formData.patientGender}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                    />
                                    <Form.Control
                                        type="tel"
                                        name="patientPH"
                                        value={formData.patientPH}
                                        onChange={handleChange}
                                        placeholder="Telephone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="email"
                                        name="patientEmail"
                                        value={formData.patientEmail}
                                        onChange={handleChange}
                                        placeholder="Email Address / ((Include a Discord handle if available))"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientAddress"
                                        value={formData.patientAddress}
                                        onChange={handleChange}
                                        placeholder="Home Address"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Emergency Contact Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientEmergencyContact"
                                        value={formData.patientEmergencyContact}
                                        onChange={handleChange}
                                        placeholder="Emergency Contact Name"
                                        required
                                    />
                                    <Form.Control
                                        type="tel"
                                        name="patientEmergencyContactNumber"
                                        value={formData.patientEmergencyContactNumber}
                                        onChange={handleChange}
                                        placeholder="Emergency Contact Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientEmergencyContactRelation"
                                        value={formData.patientEmergencyContactRelation}
                                        onChange={handleChange}
                                        placeholder="Relation to Patient"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Health Status Information</Form.Label>
                                    <Form.Select
                                        name="patientBloodType"
                                        value={formData.patientBloodType}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Blood Type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                    </Form.Select>
                                    <Form.Control
                                        as="textarea"
                                        name="patientChronicDiseases"
                                        value={formData.patientChronicDiseases}
                                        onChange={handleChange}
                                        placeholder="Known Chronic Diseases"
                                        rows="2"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        placeholder="Known Allergies"
                                        rows="2"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 4 ? (
                            // Dental Consultation fields
                            <>
                                <p>The generated form must be used and added to the file for each medical appointment, follow the others.</p>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />

                                <Form.Group className="mb-3">
                                    <Form.Label>Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="PatientMedicalRecord"
                                        value={formData.PatientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Medical Record Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="PatientName"
                                        value={formData.PatientName}
                                        onChange={handleChange}
                                        placeholder="Patient Full Name"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Physical Assessment</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Weight"
                                        required
                                    />
                                    <Form.Select
                                        name="patientChewing"
                                        value={formData.patientChewing}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Chewing Problems</option>
                                        <option value="No Issues">No Issues</option>
                                        <option value="Mild Difficulty">Mild Difficulty</option>
                                        <option value="Moderate Difficulty">Moderate Difficulty</option>
                                        <option value="Severe Difficulty">Severe Difficulty</option>
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Priority Classification</Form.Label>
                                    <Form.Label>Priority Classification</Form.Label>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Medications</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Current Medications"
                                        rows="2"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientNewMedicine"
                                        value={formData.patientNewMedicine}
                                        onChange={handleChange}
                                        placeholder="Prescribed Medications"
                                        rows="2"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Diagnosis & Treatment</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Diagnosis"
                                        rows="3"
                                        required
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientTreatment"
                                        value={formData.patientTreatment}
                                        onChange={handleChange}
                                        placeholder="Treatment Plan"
                                        rows="3"
                                        required
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientPrescription"
                                        value={formData.patientPrescription}
                                        onChange={handleChange}
                                        placeholder="Prescriptions"
                                        rows="2"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Consultation Summary</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 5 ? (
                            <>
                                <p>The FORM below must be used and added to the file for each surgery appointment, following the others.</p>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Additional Staff:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="extraStaff"
                                        value={formData.extraStaff}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Enter staff present (( Leave N/A if NPCed )) "
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Patient Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Eden Sawyer"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Medical Record Number:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Enter patient's medical record number"
                                    />
                                </Form.Group>
                                <h5>Section 2: Surgical Inquiry</h5>
                                <Form.Group className="mb-3">
                                    <Form.Label>Did the patient or their family consent, or did they have a life threatening or severe injury that requires immediate surgical intervention?</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientConsent"
                                        value={formData.patientConsent}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder=""
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Did any medical complications occur during the surgery</Form.Label>
                                    <Form.Select
                                        name="surgeryComplications"
                                        value={formData.surgeryComplications}
                                        onChange={handleChange}
                                        required
                                        className="form-select"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Was the procedure completed successfully, and did it result in the desired clinical outcome?</Form.Label>
                                    <Form.Select
                                        name="surgeryProcedures"
                                        value={formData.surgeryProcedures}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Select...</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <h5>Section 3: Post-Anesthesia Report</h5>
                                <Form.Group className="mb-3">
                                    <Form.Label>Known Current Medication:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Enter patient's current medication"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Known Allergies:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Enter patient's known allergies"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Type & Dosage of Anesthesia Administered:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="drugType"
                                        value={formData.drugType}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Enter patient's known allergies"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Post-Operative Anesthesia Details:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="postDrugtype"
                                        value={formData.postDrugtype}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Post Operative Anesthesia Details"
                                    />
                                </Form.Group>
                                <h5>Section 4: Summary of Surgical Procedure Performed</h5>
                                <Form.Group className="mb-3">
                                    <Form.Label>Summerize Surgical Procedure:</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="surgicalSummery"
                                        value={formData.surgicalSummery}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                        placeholder="Summary of surgical procedure performed"
                                        rows="4"
                                    />
                                </Form.Group>
                                <h5>SECTION 5: DATE OF SURGERY</h5>
                                <Form.Group className="mb-3">
                                    <Form.Label>Date of Surgery:</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="surgeryTime"
                                        value={formData.surgeryTime}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                            </>
                        ) : bbCodeVersion === 6 ? ( // generatePhysEvalInternalMed
                            <>
                                <p>The FORM below must be used and added to the file for each medical appointment, following the others.</p>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientGender"
                                        value={formData.patientGender}
                                        onChange={handleChange}
                                        placeholder="Gender"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientRace"
                                        value={formData.patientRace}
                                        onChange={handleChange}
                                        placeholder="Patient Race"
                                        required
                                    />

                                    <Form.Control
                                        type="tel"
                                        name="patientPH"
                                        value={formData.patientPH}
                                        onChange={handleChange}
                                        placeholder="Phone Number"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientDiscord"
                                        value={formData.patientDiscord}
                                        onChange={handleChange}
                                        placeholder="Patient Email ((And Discord))"
                                    />

                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Measurements</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Height"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Weight"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBMI"
                                        value={formData.patientBMI}
                                        onChange={handleChange}
                                        placeholder="BMI"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Temperature"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientpulse"
                                        value={formData.patientpulse}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Oxygen Saturation (%)"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure (MMHG)"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Medical History</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientCareer"
                                        value={formData.patientCareer}
                                        onChange={handleChange}
                                        placeholder="Previous Occupation"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientImpairments"
                                        value={formData.patientImpairments}
                                        onChange={handleChange}
                                        placeholder="Medical Conditions/Impairments"
                                        rows="3"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Patient Medicine (Regular Basis)"
                                        rows="2"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        placeholder="Known Allergies"
                                        rows="2"
                                    />

                                    <Form.Control
                                        as="textarea"
                                        name="patientPastDiseases"
                                        value={formData.patientPastDiseases}
                                        onChange={handleChange}
                                        placeholder="Family Medical History"
                                        rows="3"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Assessment</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientAssessment"
                                        value={formData.patientAssessment}
                                        onChange={handleChange}
                                        placeholder="Assessment Summary"
                                        rows="4"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Examination Date</Form.Label>
                                    <Form.Control
                                        type="datetime-local"
                                        name="appointmentDate"
                                        value={formData.appointmentDate}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>

                            </>
                        ) : bbCodeVersion === 8 ? ( // Emergency Medical File2
                            <>
                                <h5>(The FORM below is intended for the opening of a basic medical file, it must appear at the top.)</h5>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Medical Patient Record</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 2: Patient Demographics</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Select
                                        name="patientGender"
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                patientMale: value === 'male',
                                                patientFemale: value === 'female'
                                            }));
                                        }}
                                    >
                                        <option value="...">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                    />
                                    <Form.Control
                                        type="tel"
                                        name="patientPH"
                                        value={formData.patientPH}
                                        onChange={handleChange}
                                        placeholder="Telephone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="email"
                                        name="patientEmail"
                                        value={formData.patientEmail}
                                        onChange={handleChange}
                                        placeholder="Email Address / ((Include a Discord handle if available))"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientAddress"
                                        value={formData.patientAddress}
                                        onChange={handleChange}
                                        placeholder="Home Address"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Emergency Contact Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientEmergencyContact"
                                        value={formData.patientEmergencyContact}
                                        onChange={handleChange}
                                        placeholder="Emergency Contact Name"
                                        required
                                    />
                                    <Form.Control
                                        type="tel"
                                        name="patientEmergencyContactNumber"
                                        value={formData.patientEmergencyContactNumber}
                                        onChange={handleChange}
                                        placeholder="Emergency Contact Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientEmergencyContactRelation"
                                        value={formData.patientEmergencyContactRelation}
                                        onChange={handleChange}
                                        placeholder="Relation to Patient"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Health Status Information</Form.Label>
                                    <Form.Select
                                        name="patientBloodType"
                                        value={formData.patientBloodType}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select Blood Type</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                    </Form.Select>
                                    <Form.Control
                                        as="textarea"
                                        name="patientChronicDiseases"
                                        value={formData.patientChronicDiseases}
                                        onChange={handleChange}
                                        placeholder="Known Chronic Diseases"
                                        rows="2"
                                    />
                                    <Form.Control
                                        as="textarea"
                                        name="patientAllergies"
                                        value={formData.patientAllergies}
                                        onChange={handleChange}
                                        placeholder="Known Allergies"
                                        rows="2"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 9 ? ( // generateObsMainFile
                            <>
                                <h5>OBSTETRICS ONLY - MAIN FILE</h5>
                                <h5>(The FORM below is intended for the opening of a basic medical file, it must appear at the top.)</h5>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 0: Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>

                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Label>Partner Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerName"
                                        value={formData.patientPartnerName}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Name"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerPH"
                                        value={formData.patientPartnerPH}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Phone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerDiscord"
                                        value={formData.patientPartnerDiscord}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Email (( & Discord ))"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={handleChange}
                                        placeholder="Patient Employeer"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJobTasks"
                                        value={formData.patientJobTasks}
                                        onChange={handleChange}
                                        placeholder="Patient Job Tasks"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Health Story</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPreHealth"
                                        value={formData.patientPreHealth}
                                        onChange={handleChange}
                                        placeholder="Health problems, medications, allergies, surgical procedures, problems related to anesthesia, depression, etc."
                                        required
                                    />

                                    <Form.Select
                                        type="text"
                                        name="patientAdditionalPregnancy"
                                        value={formData.patientAdditionalPregnancy}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Multiple Pregnancies</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientBaggageofParents"
                                        value={formData.patientBaggageofParents}
                                        onChange={handleChange}
                                        placeholder="Baggage of Parents"
                                        required
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientPregProblems"
                                        value={formData.patientPregProblems}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Previous Gynecological Problems</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Text className="text-muted">This covers Patient's Living Habits.</Form.Text>
                                    <Form.Control
                                        type="text"
                                        name="patientLivingHabits"
                                        value={formData.patientLivingHabits}
                                        onChange={handleChange}
                                        placeholder="Diet, physical activity, smoking, alcohol and drugs."
                                        required
                                    />
                                    <Form.Label>Section 2: Patient Measurements</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Height"
                                    />

                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Body Temperature"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Pulse Oximetry"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal or Transvaginal Ultrasound<br></br></Form.Label>
                                    <Form.Text className="text-muted">Date of Pregnancy.</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofPregnancy"
                                        value={formData.patientDateofPregnancy}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                    <Form.Label>Identification of Multiple Pregnancies:</Form.Label>
                                    <Form.Select
                                        name="violenceHistory"
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setFormData(prev => ({
                                                ...prev,
                                                oneFetus: value === 'One',
                                                twoFetuses: value === 'Two',
                                                threeFetuses: value === 'Three',
                                                fourFetuses: value === 'Four',
                                            }));
                                        }}
                                    >
                                        <option value="">Number of Fetus</option>
                                        <option value="One">One Fetus</option>
                                        <option value="Two">Two Fetus</option>
                                        <option value="Three">Three Fetus</option>
                                        <option value="Four">Four or more</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientFetalMeasurements"
                                        value={formData.patientFetalMeasurements}
                                        onChange={handleChange}
                                        placeholder="Fetal Measurements"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Gynecological and Biological Examinations</Form.Label>
                                    <Form.Text className="text-muted"><br></br>Last Well Woman Exam.</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientWellWomanExam"
                                        value={formData.patientWellWomanExam}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientPap"
                                        value={formData.patientPap}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Pap Smear</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientPapResults"
                                        value={formData.patientPapResults}
                                        onChange={handleChange}
                                        placeholder="Pap Smear Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientSTI"
                                        value={formData.patientSTI}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">STI Screaning</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientSTIResults"
                                        value={formData.patientSTIResults}
                                        onChange={handleChange}
                                        placeholder="STI Results"
                                        required
                                        className="form-control"
                                    />

                                    <Form.Select
                                        type="text"
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Blood Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Urine Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Patient Urine Results"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Section 6: Summary of Consultation </Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Appointment Date</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />

                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 10 ? ( // generateObsFollowup
                            <>
                                <h5> The FORM below should be used and added to the file, following the others.<br></br>(( Please note that it isn't mandatory to make a medical record for every patient you meet in the ER. You can either do it if you feel like it, offer it to the patient or simply do it at the patient's request. ))</h5>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Label>Section 0: Patient Information</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Medical Number"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient's name"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Text className="text-muted"> Patient's date of birth</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Section 1: Patient Health Status</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="date"
                                        name="patientDateofPregnancy"
                                        value={formData.patientDateofPregnancy}
                                        onChange={handleChange}
                                        placeholder="Date of Pregnancy"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        name="patientContractions"
                                        value={formData.patientContractions}
                                        onChange={handleChange}
                                        placeholder="Is the Patient suffering from contractions?  - CHANGE TO YES/NO"
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient suffering from contractions?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientBleeding"
                                        value={formData.patientBleeding}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient suffering from discharge or bleeding?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientDiscomfort"
                                        value={formData.patientDiscomfort}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Patient Discomfort during urination?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientFetalMeasurements"
                                        value={formData.patientFetalMeasurements}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Fetal Measurements</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Label>Section 2: Patient Weight</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientFatter"
                                        value={formData.patientFatter}
                                        onChange={handleChange}
                                        placeholder="Patient's Height"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>


                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Temperature"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Oxygen Saturation (%)"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure (MMHG)"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal Ultrasonography</Form.Label>
                                    <Form.Select
                                        name="patientBabyGender"
                                        value={formData.patientBabyGender}
                                        onChange={handleChange}
                                        placeholder="Baby Gender"
                                    >
                                        <option value=""> Baby Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientKnowBabyGender"
                                        value={formData.patientKnowBabyGender}
                                        onChange={handleChange}
                                    >
                                        <option value="">Does the Patient know the gender of the baby?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUltraSummary"
                                        value={formData.patientUltraSummary}
                                        onChange={handleChange}
                                        placeholder="Summary of the Ultrasound"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Biological Examinations</Form.Label>
                                    <Form.Select
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}
                                    >
                                        <option value="">Has a blood analysis been performed?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                    />
                                    <Form.Select
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}
                                    >
                                        <option value="">Has a Urine analysis been performed?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Urine Analysis"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 6: Summary of Consultation</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 12 ? ( // generateGyneMainFile
                            <>
                                <h5>(The FORM below is intended for the opening of a basic medical file, it must appear at the top.)</h5>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 0: Personal Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>

                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                    />
                                    <Form.Label>Partner Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerName"
                                        value={formData.patientPartnerName}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Name"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerPH"
                                        value={formData.patientPartnerPH}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Phone Number"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientPartnerDiscord"
                                        value={formData.patientPartnerDiscord}
                                        onChange={handleChange}
                                        placeholder="Patient Partner Email (( & Discord ))"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={handleChange}
                                        placeholder="Patient Employeer"
                                        required
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientJobTasks"
                                        value={formData.patientJobTasks}
                                        onChange={handleChange}
                                        placeholder="Patient Job Tasks"
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Health Story</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientPreHealth"
                                        value={formData.patientPreHealth}
                                        onChange={handleChange}
                                        placeholder="Gynecological Problems"
                                        required
                                    />

                                    <Form.Control
                                        type="text"
                                        name="patientBaggageofParents"
                                        value={formData.patientBaggageofParents}
                                        onChange={handleChange}
                                        placeholder="Baggage of Parents"
                                        required
                                    />
                                    <Form.Text className="text-muted">This covers Patient's Living Habits.</Form.Text>
                                    <Form.Control
                                        type="text"
                                        name="patientLivingHabits"
                                        value={formData.patientLivingHabits}
                                        onChange={handleChange}
                                        placeholder="Diet, physical activity, smoking, alcohol and drugs."
                                        required
                                    />
                                    <Form.Label>Section 2: Patient Measurements</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientHeight"
                                        value={formData.patientHeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Height"
                                    />

                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Body Temperature"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Pulse Oximetry"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal or Transvaginal Ultrasound</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Findings of Ultrasound"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Gynecological and Biological Examinations</Form.Label>
                                    <Form.Text className="text-muted"><br></br>Last Well Woman Exam.</Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientWellWomanExam"
                                        value={formData.patientWellWomanExam}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientPap"
                                        value={formData.patientPap}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Pap Smear</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientPapResults"
                                        value={formData.patientPapResults}
                                        onChange={handleChange}
                                        placeholder="Pap Smear Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientSTI"
                                        value={formData.patientSTI}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">STI Screaning</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientSTIResults"
                                        value={formData.patientSTIResults}
                                        onChange={handleChange}
                                        placeholder="STI Results"
                                        required
                                        className="form-control"
                                    />

                                    <Form.Select
                                        type="text"
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Blood Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        type="text"
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}

                                        required
                                    >
                                        <option value="">Urine Analysis</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Patient Urine Results"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>SECTION 6: SUMMARY OF CONSULTATION</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        as="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Label>Appointment Date</Form.Label>
                                <Form.Group className="mb-3">
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 13 ? ( // generateGyneFollowUp
                            <>
                                <h5> This is the GYNE FOLLOW UP FORM.<br></br>(( Please note that it isn't mandatory to make a medical record for every patient you meet in the ER. You can either do it if you feel like it, offer it to the patient or simply do it at the patient's request. ))</h5>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
                                        handleChange({
                                            target: {
                                                name: 'phmcEmployee',
                                                value: selectedOption?.value || ''
                                            }
                                        });
                                        if (selectedOption) {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: selectedOption.signature || ''
                                            }));
                                        } else {
                                            setFormData(prev => ({
                                                ...prev,
                                                phmcSignature: ''
                                            }));
                                        }
                                    }}
                                    options={phmcGroupedOptions}
                                    isClearable
                                    placeholder="Search or select doctor..."
                                    className="form-control"  // Match Bootstrap styling
                                    styles={{
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
                                <Form.Label></Form.Label>
                                <Form.Control
                                    type="text"
                                    name="phmcSignature"
                                    value={formData.phmcSignature}
                                    onChange={handleChange}
                                    placeholder="Employee Signature"
                                    required
                                />
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 0: Patient Information</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientMedicalRecord"
                                        value={formData.patientMedicalRecord}
                                        onChange={handleChange}
                                        placeholder="Patient Number"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientName"
                                        value={formData.patientName}
                                        onChange={handleChange}
                                        placeholder="Patient Name"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Text className="text-muted">
                                        Patient's date of birth
                                    </Form.Text>
                                    <Form.Control
                                        type="date"
                                        name="patientDateofBirth"
                                        value={formData.patientDateofBirth}
                                        onChange={handleChange}
                                        placeholder="Date of Birth"
                                        required
                                        className="form-control"
                                    />

                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 1: Patient Health Status</Form.Label>
                                    <Form.Select
                                        name="patientBleeding"
                                        value={formData.patientBleeding}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient suffering from discharge or bleeding?</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Select
                                        name="patientDiscomfort"
                                        value={formData.patientDiscomfort}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Is Patient experiencing during urination? </option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 2: Patient Weight</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientWeight"
                                        value={formData.patientWeight}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientFatter"
                                        value={formData.patientFatter}
                                        onChange={handleChange}
                                        placeholder="Patient's Weight Gained"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 3: Vitals</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientTemperature"
                                        value={formData.patientTemperature}
                                        onChange={handleChange}
                                        placeholder="Body Temperature"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBPM"
                                        value={formData.patientBPM}
                                        onChange={handleChange}
                                        placeholder="Heart Rate (BPM)"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientResperation"
                                        value={formData.patientResperation}
                                        onChange={handleChange}
                                        placeholder="Respiration Rate"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientOxi"
                                        value={formData.patientOxi}
                                        onChange={handleChange}
                                        placeholder="Pulse Oximetry"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Control
                                        type="text"
                                        name="patientBP"
                                        value={formData.patientBP}
                                        onChange={handleChange}
                                        placeholder="Blood Pressure"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 4: Abdominal or Transvaginal Ultrasonography</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="patientUltraSummary"
                                        value={formData.patientUltraSummary}
                                        onChange={handleChange}
                                        placeholder="Finding's of the Ultrasound"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Biological Examinations </Form.Label>
                                    <Form.Select
                                        name="patientBloodAnalysis"
                                        value={formData.patientBloodAnalysis}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Was a Blood Analysis conducted? </option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>

                                    <Form.Control
                                        type="text"
                                        name="patientBloodAnalysisResults"
                                        value={formData.patientBloodAnalysisResults}
                                        onChange={handleChange}
                                        placeholder="Patient Blood Analysis Results"
                                        required
                                        className="form-control"
                                    />
                                    <Form.Select
                                        name="patientUrine"
                                        value={formData.patientUrine}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    >
                                        <option value="">Was a Urine Analysis conducted? </option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </Form.Select>
                                    <Form.Control
                                        type="text"
                                        name="patientUrineResults"
                                        value={formData.patientUrineResults}
                                        onChange={handleChange}
                                        placeholder="Patient Urine Results"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Section 5: Summary of Consultation</Form.Label>
                                    <Form.Control
                                        type="textarea"
                                        name="patientSummaryConsultation"
                                        value={formData.patientSummaryConsultation}
                                        onChange={handleChange}
                                        placeholder="Summary of Consultation"
                                        rows="4"
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>Appointment Date</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={handleChange}
                                        required
                                        className="form-control"
                                    />
                                </Form.Group>
                            </>
                        ) : bbCodeVersion === 14 ? ( // generateMentalHealthPHMC
                            <>
                                                            <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                                                                    <Form.Group className="mb-3">
                                                                    <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient Chief Complaint"
                                        rows="3"
                                        required
                                                                                        />

                                    <Form.Control
                                        type="text"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Patient Notes"
                                        required
                                        className="form-control"
                                    />
                                <Form.Label></Form.Label>

                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
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
                                    <Form.Label><br></br></Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Diagnosis"
                                        rows="3"
                                        required
                                                                                        />
                                                                        <Form.Control
                                        as="textarea"
                                        name="patientProcedure"
                                        value={formData.patientProcedure}
                                        onChange={handleChange}
                                        placeholder="Patient Procedure"
                                        rows="2"
                                    />

                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Patient Medicine"
                                        rows="2"
                                    />
                                </Form.Group>
                                <Select
                                    name="followup"
                                    value={followup.find(option => option.value === formData.followup)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            followup: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={followup}
                                    isClearable
                                    placeholder="Select Followup Process..."
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

                            </>
                        ) : bbCodeVersion === 16 ? ( // generateMentalHealthPBC
                            <>
                                                            <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>

 
                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                                                                    <Form.Group className="mb-3">
                                                                    <Form.Control
                                        as="textarea"
                                        name="patientChiefComplaint"
                                        value={formData.patientChiefComplaint}
                                        onChange={handleChange}
                                        placeholder="Patient's Chief Complaint"
                                        rows="3"
                                        required
                                                                                        />

                                    <Form.Control
                                        type="text"
                                        name="patientNotes"
                                        value={formData.patientNotes}
                                        onChange={handleChange}
                                        placeholder="Patient Notes"
                                        required
                                        className="form-control"
                                    />
                                <Form.Label></Form.Label>

                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
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
                                    <Form.Label><br></br></Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        name="patientDiagnosis"
                                        value={formData.patientDiagnosis}
                                        onChange={handleChange}
                                        placeholder="Diagnosis"
                                        rows="3"
                                        required
                                                                                        />
                                                                        <Form.Control
                                        as="textarea"
                                        name="patientProcedure"
                                        value={formData.patientProcedure}
                                        onChange={handleChange}
                                        placeholder="Patient Procedure"
                                        rows="2"
                                    />

                                    <Form.Control
                                        as="textarea"
                                        name="patientMedicine"
                                        value={formData.patientMedicine}
                                        onChange={handleChange}
                                        placeholder="Patient Medicine"
                                        rows="2"
                                    />
                                </Form.Group>
                                <Select
                                    name="followup"
                                    value={followup.find(option => option.value === formData.followup)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            followup: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={followup}
                                    isClearable
                                    placeholder="Select Followup Process..."
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
                            </>
                        ) : bbCodeVersion === 18 ? ( // generateAgencyFeedback
                            <>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    onChange={(selectedOption) => handleSelectChange(selectedOption, 'coroner')}
                                    options={coronerGroupedOptions}
                                    isClearable
                                    placeholder="Search or select coroner..."
                                    className="form-control"
                                    styles={{
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
                                <Form.Label></Form.Label>

                                <Form.Label>Agency Involved:</Form.Label>
                                <Form.Select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleChange}
                                    required
                                    className="form-select"
                                >
                                    <option value="" disabled>Select Department</option>
                                    <option value="LSFD">LSFD</option>
                                    <option value="LSPD">LSPD</option>
                                    <option value="LSSD">LSSD</option>
                                    <option value="PHMC">PHMC</option>
                                    <option value="SANFIRE">SANFIRE</option>
                                    <option value="SADCR">SADCR</option>
                                    <option value="LSGOV">LSGOV</option>
                                </Form.Select>

                                <Form.Label>Time of Incident:</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="dateTime"
                                    value={formData.dateTime}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Label>Brief Summary:</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    name="synopsis"
                                    value={formData.synopsis}
                                    onChange={handleChange}
                                    rows="4"
                                    required
                                    className="form-control"
                                />
                                <Form.Label>Incident Location:</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="placeOfDeath"
                                    value={formData.placeOfDeath}
                                    onChange={handleChange}
                                    placeholder="Mirror Park"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="decedentName"
                                    value={formData.decedentName}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Agency Employee's Names"
                                    required
                                    className="form-control"
                                />

                                <Form.Group className="mb-3 upload-container">
                                    <Form.Label>
                                        ((Screenshots or Evidence)):
                                    </Form.Label>
                                    <InputGroup>
                                        <Form.Control
                                            as="textarea"
                                            name="scenePhotos"
                                            value={formData.scenePhotos}
                                            onChange={handleChange}
                                            rows="2"
                                            required
                                            className="form-control"
                                            onPaste={(e) => {
                                                e.preventDefault();
                                                const items = e.clipboardData.items;
                                                for (let i = 0; i < items.length; i++) {
                                                    if (items[i].type.indexOf('image') !== -1) {
                                                        const file = items[i].getAsFile();
                                                        handleImageUpload({ target: { files: [file] } }, 'scenePhotos');
                                                    }
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
                            </>
                        ) : bbCodeVersion === 19 ? ( // Emergency Room Forms - generateERForm
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className="form-control"
                                />

                                <Select
                                    name="painLevel"
                                    value={painLevel.find(option => option.value === formData.painLevel)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            painLevel: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={painLevel}
                                    isClearable
                                    placeholder="Select Pain Level..."
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

                                <Form.Label>Vitals Section</Form.Label>

                                <Select
                                    name="vitals"
                                    value={vitals.find(option => option.value === formData.vitals)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            vitals: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={vitals}
                                    isClearable
                                    placeholder="Temperature"
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

                                <Select
                                    name="heartRate"
                                    value={heartRate.find(option => option.value === formData.heartRate)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            heartRate: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={heartRate}
                                    isClearable
                                    placeholder="Patient Heart Rate"
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

                                <Select
                                    name="breathing"
                                    value={breathing.find(option => option.value === formData.breathing)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            breathing: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={breathing}
                                    isClearable
                                    placeholder="Patient Breathing"
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

                                <Select
                                    name="bloodPressure"
                                    value={bloodPressure.find(option => option.value === formData.bloodPressure)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            bloodPressure: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={bloodPressure}
                                    isClearable
                                    placeholder="Patient Blood Pressure"
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

                                <Form.Label>Findings Section</Form.Label>
                                <Select
                                    name="findings"
                                    value={findings.find(option => option.value === formData.findings)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            findings: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={findings}
                                    isClearable
                                    placeholder="General Health Conditions..."
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

                                <Select
                                    name="lungs"
                                    value={lungs.find(option => option.value === formData.lungs)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lungs: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={lungs}
                                    isClearable
                                    placeholder="Patient Lungs (Auscultation)"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="pupils"
                                    value={pupils.find(option => option.value === formData.pupils)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            pupils: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={pupils}
                                    isClearable
                                    placeholder="Patient pupils"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="wounds"
                                    value={wounds.find(option => option.value === formData.wounds)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            wounds: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={wounds}
                                    isClearable
                                    placeholder="Patient wounds"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="ecg"
                                    value={ecg.find(option => option.value === formData.ecg)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            ecg: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={ecg}
                                    isClearable
                                    placeholder="ECG Results"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="sono"
                                    value={sono.find(option => option.value === formData.sono)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            sono: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={sono}
                                    isClearable
                                    placeholder="Sonography Results"
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

                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        formData.lab.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Select lab results..."
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            minHeight: '38px',
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
                                            zIndex: 1000,
                                            border: '1px solid #6c757d',
                                            borderRadius: '0.375rem'
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isFocused ? '#30363d' : '#16202c',
                                            color: '#eeeeeeb0',
                                            padding: '0.5rem 1rem',
                                            '&:hover': {
                                                backgroundColor: '#30363d'
                                            }
                                        }),
                                        multiValue: (base) => ({
                                            ...base,
                                            backgroundColor: '#30363d',
                                            color: '#eeeeeeb0'
                                        }),
                                        multiValueLabel: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        multiValueRemove: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            '&:hover': {
                                                backgroundColor: '#dc3545',
                                                color: '#fff'
                                            }
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#6c757d'
                                        })
                                    }}
                                /><Form.Label></Form.Label>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient's Secondary Diagnosis"
                                    required
                                    className="form-control"
                                />
                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
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

                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Procedure's conducted on Patient"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Medication provided to Patient"
                                    required
                                    className="form-control"
                                />


                            </>
                        ) : bbCodeVersion === 20 ? ( // Emergency Room Forms - generateERForm
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className="form-control"
                                />

                                <Select
                                    name="assignedDepartment"
                                    value={assignedDepartment.find(option => option.value === formData.assignedDepartment)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            assignedDepartment: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={assignedDepartment}
                                    isClearable
                                    placeholder="Select Department..."
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

                                <Form.Label>Vitals Section</Form.Label>

                                <Select
                                    name="vitals"
                                    value={vitals.find(option => option.value === formData.vitals)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            vitals: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={vitals}
                                    isClearable
                                    placeholder="Temperature"
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

                                <Select
                                    name="heartRate"
                                    value={heartRate.find(option => option.value === formData.heartRate)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            heartRate: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={heartRate}
                                    isClearable
                                    placeholder="Patient Heart Rate"
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

                                <Select
                                    name="breathing"
                                    value={breathing.find(option => option.value === formData.breathing)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            breathing: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={breathing}
                                    isClearable
                                    placeholder="Patient Breathing"
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

                                <Select
                                    name="bloodPressure"
                                    value={bloodPressure.find(option => option.value === formData.bloodPressure)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            bloodPressure: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={bloodPressure}
                                    isClearable
                                    placeholder="Patient Heart Rate"
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

                                <Form.Label>Findings Section</Form.Label>
                                <Select
                                    name="findings"
                                    value={findings.find(option => option.value === formData.findings)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            findings: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={findings}
                                    isClearable
                                    placeholder="General Health Conditions..."
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

                                <Select
                                    name="lungs"
                                    value={lungs.find(option => option.value === formData.lungs)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lungs: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={lungs}
                                    isClearable
                                    placeholder="Patient Lungs (Auscultation)"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="pupils"
                                    value={pupils.find(option => option.value === formData.pupils)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            pupils: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={pupils}
                                    isClearable
                                    placeholder="Patient pupils"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="wounds"
                                    value={wounds.find(option => option.value === formData.wounds)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            wounds: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={wounds}
                                    isClearable
                                    placeholder="Patient wounds"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="ecg"
                                    value={ecg.find(option => option.value === formData.ecg)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            ecg: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={ecg}
                                    isClearable
                                    placeholder="ECG Results"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="sono"
                                    value={sono.find(option => option.value === formData.sono)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            sono: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={sono}
                                    isClearable
                                    placeholder="Sonography Results"
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

                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        formData.lab.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Select lab results..."
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            minHeight: '38px',
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
                                            zIndex: 1000,
                                            border: '1px solid #6c757d',
                                            borderRadius: '0.375rem'
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isFocused ? '#30363d' : '#16202c',
                                            color: '#eeeeeeb0',
                                            padding: '0.5rem 1rem',
                                            '&:hover': {
                                                backgroundColor: '#30363d'
                                            }
                                        }),
                                        multiValue: (base) => ({
                                            ...base,
                                            backgroundColor: '#30363d',
                                            color: '#eeeeeeb0'
                                        }),
                                        multiValueLabel: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        multiValueRemove: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            '&:hover': {
                                                backgroundColor: '#dc3545',
                                                color: '#fff'
                                            }
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#6c757d'
                                        })
                                    }}
                                /><Form.Label></Form.Label>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient's Secondary Diagnosis"
                                    required
                                    className="form-control"
                                />
                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
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


                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Procedure's conducted on Patient"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Medication provided to Patient"
                                    required
                                    className="form-control"
                                />
                                <Select
                                    name="followup"
                                    value={followup.find(option => option.value === formData.followup)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            followup: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={followup}
                                    isClearable
                                    placeholder="Select Followup Process..."
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


                            </>
                        ) : bbCodeVersion === 21 ? ( // GENERAL CONSULTATION (PBC)
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />

                                <div className="radio-inline-container">

                                    <span className="radio-text">Role:</span>
                                    <Form.Check
                                        type="radio"
                                        id="doctorRank"
                                        label="   Doctor"
                                        checked={isDoctor}
                                        onChange={handlePHMCRank('doctor')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="nurseRank"
                                        label="   Nurse"
                                        checked={isNurse}
                                        onChange={handlePHMCRank('nurse')}
                                        inline
                                    />
                                    <Form.Check
                                        type="radio"
                                        id="psychRank"
                                        label="   Psychiatrist"
                                        checked={isPsych}
                                        onChange={handlePHMCRank('psych')}
                                        inline
                                    />  </div>
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                <Form.Control
                                    type="text"
                                    name="patientChiefComplaint"
                                    value={formData.patientChiefComplaint}
                                    onChange={handleChange}
                                    placeholder="Patient Chief Complaint"
                                    required
                                    className="form-control"
                                />

                                <Select
                                    name="paletoClinicDepartment"
                                    value={paletoClinicDepartment.find(option => option.value === formData.paletoClinicDepartment)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            paletoClinicDepartment: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={paletoClinicDepartment}
                                    isClearable
                                    placeholder="Select Department..."
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

                                <Form.Label>Vitals Section</Form.Label>

                                <Select
                                    name="vitals"
                                    value={vitals.find(option => option.value === formData.vitals)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            vitals: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={vitals}
                                    isClearable
                                    placeholder="Temperature"
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

                                <Select
                                    name="heartRate"
                                    value={heartRate.find(option => option.value === formData.heartRate)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            heartRate: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={heartRate}
                                    isClearable
                                    placeholder="Patient Heart Rate"
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

                                <Select
                                    name="breathing"
                                    value={breathing.find(option => option.value === formData.breathing)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            breathing: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={breathing}
                                    isClearable
                                    placeholder="Patient Breathing"
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

                                <Select
                                    name="bloodPressure"
                                    value={bloodPressure.find(option => option.value === formData.bloodPressure)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            bloodPressure: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={bloodPressure}
                                    isClearable
                                    placeholder="Patient Blood Pressure"
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

                                <Form.Label>Findings Section</Form.Label>
                                <Select
                                    name="findings"
                                    value={findings.find(option => option.value === formData.findings)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            findings: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={findings}
                                    isClearable
                                    placeholder="General Health Conditions..."
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

                                <Select
                                    name="lungs"
                                    value={lungs.find(option => option.value === formData.lungs)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lungs: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={lungs}
                                    isClearable
                                    placeholder="Patient Lungs (Auscultation)"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="pupils"
                                    value={pupils.find(option => option.value === formData.pupils)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            pupils: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={pupils}
                                    isClearable
                                    placeholder="Patient pupils"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="wounds"
                                    value={wounds.find(option => option.value === formData.wounds)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            wounds: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={wounds}
                                    isClearable
                                    placeholder="Patient wounds"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="ecg"
                                    value={ecg.find(option => option.value === formData.ecg)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            ecg: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={ecg}
                                    isClearable
                                    placeholder="ECG Results"
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
                                /><Form.Label></Form.Label>

                                <Select
                                    name="sono"
                                    value={sono.find(option => option.value === formData.sono)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            sono: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={sono}
                                    isClearable
                                    placeholder="Sonography Results"
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

                                <Select
                                    isMulti
                                    name="lab"
                                    value={lab.filter(option =>
                                        formData.lab.includes(option.value)
                                    )}
                                    onChange={(selectedOptions) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            lab: selectedOptions ? selectedOptions.map(option => option.value) : []
                                        }));
                                    }}
                                    options={lab}
                                    className="form-control"
                                    placeholder="Select lab results..."
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            minHeight: '38px',
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
                                            zIndex: 1000,
                                            border: '1px solid #6c757d',
                                            borderRadius: '0.375rem'
                                        }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isFocused ? '#30363d' : '#16202c',
                                            color: '#eeeeeeb0',
                                            padding: '0.5rem 1rem',
                                            '&:hover': {
                                                backgroundColor: '#30363d'
                                            }
                                        }),
                                        multiValue: (base) => ({
                                            ...base,
                                            backgroundColor: '#30363d',
                                            color: '#eeeeeeb0'
                                        }),
                                        multiValueLabel: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        multiValueRemove: (base) => ({
                                            ...base,
                                            color: '#6c757d',
                                            '&:hover': {
                                                backgroundColor: '#dc3545',
                                                color: '#fff'
                                            }
                                        }),
                                        input: (base) => ({
                                            ...base,
                                            color: '#eeeeeeb0'
                                        }),
                                        placeholder: (base) => ({
                                            ...base,
                                            color: '#6c757d'
                                        })
                                    }}
                                /><Form.Label></Form.Label>

                                <Form.Control
                                    as="textarea"
                                    name="patientDiagnosis"
                                    value={formData.patientDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient Diagnosis"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientSecondaryDiagnosis"
                                    value={formData.patientSecondaryDiagnosis}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Patient's Secondary Diagnosis"
                                    required
                                    className="form-control"
                                />
                                <Select
                                    name="admission"
                                    value={admission.find(option => option.value === formData.admission)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            admission: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={admission}
                                    isClearable
                                    placeholder="Was Patient Admitted?"
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
                                <Form.Group className="mb-3">
                                <Form.Control
                                    as="textarea"
                                    name="patientProcedure"
                                    value={formData.patientProcedure}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Procedure's conducted on Patient"
                                    required
                                    className="form-control"
                                />
                                <Form.Control
                                    as="textarea"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    rows="4"
                                    placeholder="Medication provided to Patient"
                                    required
                                    className="form-control"
                                />
                                <Select
                                    name="followup"
                                    value={followup.find(option => option.value === formData.followup)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            followup: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={followup}
                                    isClearable
                                    placeholder="Select Followup Process..."
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
                                </Form.Group>

                            </>
                        ) : bbCodeVersion === 22 ? ( // COMMENTARY NOTE (phmc)
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                <Select
                                    name="departmentLarge"
                                    value={departmentLarge.find(option => option.value === formData.departmentLarge)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            departmentLarge: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={departmentLarge}
                                    isClearable
                                    placeholder="Select Department..."
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

                            </>
                        ) : bbCodeVersion === 23 ? ( // COMMENTARY NOTE (PBC)
                            <>
                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Label>Date:</Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                />
                                <Form.Label></Form.Label>
                                <Form.Label>Employee Credentials:</Form.Label>

                                <Select
                                    name="phmcEmployee"
                                    value={phmcGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.phmcEmployee) || null}
                                    onChange={(selectedOption) => {
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
                                <Select
                                    name="departmentLarge"
                                    value={departmentLarge.find(option => option.value === formData.departmentLarge)}
                                    onChange={(selectedOption) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            departmentLarge: selectedOption ? selectedOption.value : ''
                                        }));
                                    }}
                                    options={departmentLarge}
                                    isClearable
                                    placeholder="Select Department..."
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

                            </>
                        ) : null}
                        <div className="button-group">
                            <button
                                type="button"
                                onClick={clearForm}
                                className="upload-button"
                            >
                                <i className="fas fa-trash-alt"></i>
                                Clear Form
                            </button>
                        </div>
        </form>
    );
}

export default MyFormComponent;