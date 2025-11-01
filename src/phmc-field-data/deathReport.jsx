import { useState, useEffect} from 'react'; // Import useEffect
import { Form, Button, InputGroup } from 'react-bootstrap';
import ImagePreview from '../components/ImagePreview';
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';

const DeathReport = ({
    formData,
    handleChange,
    handleSelectChange,
    setShowEmployeeModal,
    coronerGroupedOptions,
    handleDoeChange,
    setFormData,
    isJohnDoe,
    isJaneDoe,
    currentUtcTime,
    isUploading,
    handleImageUpload,
    typeOfDeathOptions,
    mannerOfDeathOptions,
    requestingAgencyOptions
}) => {
    // Function to generate the Evidence Locker ID
    const generateEvidenceLockerID = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = today.getFullYear().toString().slice(2, 4); // Get last 2 digits of year
        const baseID = `EV-${year}${month}${day}-`;
        // Append whatever the user types
        return baseID;
    };
    const [evidenceLockerChecked, setEvidenceLockerChecked] = useState(formData.evidenceLocker === 'true');

    const setGeneratedEvidenceLockerID = () => {
        setFormData(prev => ({
            ...prev,
            evidenceLockerID: generateEvidenceLockerID()
        }));
    };
useEffect(() => {
        setFormData(prev => ({
            ...prev,
            evidenceLockerID: '',
            evidenceLocker: 'false'
        }));
    }, [setFormData]);

    return (
        <>
            <p>The Coroner Report Generated needs to be filled out fully, you can upload images locally or link pictures. </p>
            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
                employeeType="coroner"
            />
            <Form.Label></Form.Label>
                <span style={{ fontSize: '0.8em', color: '#6c757d', marginLeft: '10px' }}>
                    Current Server Time: {currentUtcTime}
                </span>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Form.Control
                        type="datetime-local"
                        name="dateTime"
                        value={formData.dateTime}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.dateTime ? 'is-invalid' : ''}`}
                    />
                    <Button
                        variant="outline-info"
                        size="sm"
                        style={{ height: '38px', lineHeight: '1.5', paddingTop: 0, paddingBottom: 0, display: 'flex', alignItems: 'center', position: 'relative', top: '-10px' }}
                        onClick={() => {
                            const now = new Date();
                            const pad = (n) => n.toString().padStart(2, '0');
                            // Use UTC for accuracy (matches Current Server Time)
                            const utc = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
                            handleChange({ target: { name: 'dateTime', value: utc } });
                        }}
                    >
                        Dispatched to scene    
                    </Button>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Form.Control
                        type="time"
                        name="pronouncedTimeOfDeath"
                        value={formData.pronouncedTimeOfDeath}
                        onChange={handleChange}
                        required
                        className={`form-control ${!formData.pronouncedTimeOfDeath ? 'is-invalid' : ''}`}
                    />
                    <Button
                        variant="outline-info"
                        size="sm"
                        style={{ height: '38px', lineHeight: '1.5', paddingTop: 0, paddingBottom: 0, display: 'flex', alignItems: 'center', position: 'relative', top: '-10px' }}
                        onClick={() => {
                            const now = new Date();
                            const pad = (n) => n.toString().padStart(2, '0');
                            // Use UTC for accuracy (matches Current Server Time)
                            const time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
                            handleChange({ target: { name: 'pronouncedTimeOfDeath', value: time } });
                        }}
                    >
                        Decedent Time Of Death
                    </Button>
                </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <Form.Check
                type="checkbox"
                label="Report Requested?"
                name="showRequestingOfficerInput"
                checked={formData.showRequestingOfficerInput || false}
                onChange={handleChange}
            />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                name="department"
                value={formData.department}
                onChange={handleChange}
                required
                className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Select Requesting Agency</option>
                {requestingAgencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
            {formData.showRequestingOfficerInput && (
                    <Form.Control
                        type="text" name="requestingOfficer" value={formData.requestingOfficer || ''} onChange={handleChange} placeholder="e.g: Officer John Doe, LSPD"/>
            )}
            </div>

            <div className="radio-inline-container">
                <div className="radio-button-group">
                    <Form.Check type="radio" id="johnDoe" label="   John Doe" checked={isJohnDoe} onChange={handleDoeChange('john')} inline />
                    <Form.Check type="radio" id="janeDoe" label="   Jane Doe" checked={isJaneDoe} onChange={handleDoeChange('jane')} inline />
                    <Form.Check type="radio" id="massFatality" name="massFatality" label="   Mass Fatality?" checked={formData.massFatality || false} onChange={handleChange} inline />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control type="text" name="decedentName" value={formData.decedentName} onChange={handleChange} placeholder="Decedent's IC name" required className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`} />
                <Form.Control type="text" name="decedentOOC" value={formData.decedentOOC} onChange={handleChange} placeholder="Decedent's OOC name" required className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                name="typeOfDeath"
                value={formData.typeOfDeath}
                onChange={handleChange}
                required
                className={`form-control ${!formData.typeOfDeath ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Select Type of Death</option>
                {/* --- Updated to use typeOfDeathOptions --- */}
                {typeOfDeathOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
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
</div>
            {(formData.typeOfDeath === 'CK' || formData.typeOfDeath === 'Character Kill') && (
                <>
                    <Form.Group className="mb-3 upload-container">
                        <InputGroup>
                            <Form.Control
                                type="text"
                                name="decedentAttributes"
                                value={formData.decedentAttributes}
                                onChange={handleChange}
                                className={`form-control`}
                                placeholder="Decedent /attributes (comma-separated)"
                            />
                            <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'decedentAttributes'); input.click(); }}>
                                <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? '...' : ''}
                            </Button>
                        </InputGroup>
                    </Form.Group>
                </>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>

            <Form.Select
                name="mannerOfDeath"
                value={formData.mannerOfDeath}
                onChange={handleChange}
                required
                className={`form-control ${!formData.mannerOfDeath ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>Select Manner of Death</option>
                {mannerOfDeathOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>
            <Form.Control type="text" name="probableCauseOfDeath" value={formData.probableCauseOfDeath} onChange={handleChange} placeholder="Probable cause of death" required className={`form-control ${!formData.probableCauseOfDeath ? 'is-invalid' : ''}`} />
</div>
            <Form.Control as="textarea" name="synopsis" value={formData.synopsis} onChange={handleChange} rows="4" placeholder="Brief Summary" required className={`form-control ${!formData.synopsis ? 'is-invalid' : ''}`} />
            <label>Evidence Locker Submission:</label>
            <Form.Check
                type="checkbox"
                id="evidenceLocker"
                label="       I have submitted evidence to the evidence locker"
                checked={evidenceLockerChecked}
                onChange={(e) => {
                    setEvidenceLockerChecked(e.target.checked);
                    setFormData(prev => ({
                        ...prev,
                        evidenceLocker: e.target.checked.toString(),
                    }));

                    if (e.target.checked) {
                        setGeneratedEvidenceLockerID();
                    } else {
                        setFormData(prev => ({
                            ...prev,
                            evidenceLockerID: ''
                        }));
                    }
                }}
            />

            {evidenceLockerChecked && (
                <Form.Control
                    type="text"
                    name="evidenceLockerID"
                    value={formData.evidenceLockerID || generateEvidenceLockerID()}
                    onChange={handleChange}
                    placeholder={generateEvidenceLockerID() + " Your Submission Number Here"}
                    required
                    className={`form-control ${!formData.evidenceLockerID ? 'is-invalid' : ''}`}
                />
            )}
            <label></label>

            <Form.Group className="mb-3 upload-container">
                <InputGroup>
                    <Form.Control
                        as="textarea"
                        name="scenePhotos"
                        value={formData.scenePhotos}
                        onChange={handleChange}
                        rows="2"
                        // Removed 'required' to allow empty if not applicable, or add validation if always needed
                        className={`form-control ${!formData.scenePhotos && formData.evidenceLocker !== 'true' ? '' : ''}`} // Adjusted validation logic if needed
                        placeholder="Upload Scene Photos (comma-separated)"
                        onPaste={(e) => {
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
                                const newValue = currentValue.slice(0, cursorPos) + (cursorPos > 0 ? separator : '') + pastedData + currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, scenePhotos: newValue }));
                                e.preventDefault();
                            }
                        }}
                    />
                    <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'scenePhotos'); input.click(); }}>
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? 'Uploading...' : 'Upload Images'}
                    </Button>
                    <Button
                        variant="outline-warning"
                        disabled={isUploading}
                        onClick={() => setFormData(prev => ({ ...prev, scenePhotos: 'Scene Photos are unavailable' }))}
                        title="Mark scene photos as unavailable"
                    >
                        <i className="fas fa-eye-slash" style={{ marginRight: '6px' }}></i>
                        Scene Photos Unavailable
                    </Button>
                </InputGroup>
                <span className="helper-text">This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
<ImagePreview 
    imageUrls={formData.scenePhotos} 
    showPreviews={true}
    onImageRemove={(updatedUrls) => {
        setFormData(prev => ({ ...prev, scenePhotos: updatedUrls }));
    }}
/>             </Form.Group>
            <Form.Group className="mb-3 upload-container">
                <div className="input-group">
                    <Form.Control
                        as="textarea"
                        name="additionalImages"
                        value={formData.additionalImages}
                        onChange={handleChange}
                        rows="2"
                        // Removed 'required' for flexibility
                        className={`form-control`}
                        placeholder="Morgue Screen, Cinjuries, CDNA Links (comma-separated)"
                        onPaste={(e) => {
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
                                const newValue = currentValue.slice(0, cursorPos) + (cursorPos > 0 ? separator : '') + pastedData + currentValue.slice(cursorPos);
                                setFormData(prev => ({ ...prev, additionalImages: newValue }));
                                e.preventDefault();
                            }
                        }}
                    />
                    <Button variant="success" disabled={isUploading} onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.onchange = (e) => handleImageUpload(e, 'additionalImages'); input.click(); }}>
                        <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i> {isUploading ? 'Uploading...' : 'Upload Images'}
                    </Button>
                                        <Button
                        variant="outline-danger"
                        disabled={isUploading}
                        onClick={() => setFormData(prev => ({ ...prev, additionalImages: '(( Morgue Photo is unavailable due to script bug ))' }))}
                        title="Mark scene photos as unavailable"
                    >
                        <i className="fas fa-eye-slash" style={{ marginRight: '6px' }}></i>
                        Morgue Photos Unavailable
                    </Button>

                </div>
                <span className="helper-text">This supports clipboard uploading, ctrl + V! | Hosted by ImgBB! - <a href="https://imgbb.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></span>
<ImagePreview 
    imageUrls={formData.additionalImages} 
    showPreviews={true}
    onImageRemove={(updatedUrls) => {
        setFormData(prev => ({ ...prev, additionalImages: updatedUrls }));
    }}
/>   
                    </Form.Group>
        </>
    );
};

export default DeathReport;