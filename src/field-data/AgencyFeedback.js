import React from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import Select from 'react-select';

const AgencyFeedback = ({
    formData,
    handleChange,
    handleSelectChange,
    coronerGroupedOptions,
    setShowMissingEmployeeModal,
    isUploading,
    handleImageUpload,
}) => {
    return (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                                    <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
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
                                        <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i> {/* Changed icon */}
                                        Missing Name?
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
                            </>
    );
};

export default AgencyFeedback;