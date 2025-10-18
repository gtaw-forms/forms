import React, { useState, useEffect } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';

const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    groupedOptions,
    handleSelectChange, 
    setShowEmployeeModal,
    employeeType
}) => {
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated } = useGtaWorldAuth();
    const [useGtawName, setUseGtawName] = useState(false);
    
    // Declare field names first (before useEffect)
    const employeeNameField = `${employeeType}Employee`;
    const employeeBadgeField = `${employeeType}Badge`;
    const employeeRankField = `${employeeType}Rank`;
    const employeeDiscordField = `${employeeType}Discord`;
    const employeePHNumberField = `${employeeType}PHNumber`;
    
    // Automatically enable GTAW credentials when user is authenticated
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !useGtawName) {
            // Check if we have a valid character name
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName && gtawCharacterName !== 'GTAW User') {
                setUseGtawName(true);
                
                // Clean rank by removing dashes and extra text
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    gtaWorldUser.faction.rank.split('-')[0].trim() : 'GTAW User';
                
                setFormData(prev => ({
                    ...prev,
                    [employeeNameField]: gtawCharacterName,
                    [employeeBadgeField]: gtaWorldUser?.character?.id || gtaWorldUser?.id || '', 
                    [employeeRankField]: cleanRank,
                    [employeeDiscordField]: gtaWorldUser?.username || '',
                    [employeePHNumberField]: '50056'
                }));
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField]);

    // Get GTAW character name if available
    const gtawCharacterName = isGtaAuthenticated && gtaWorldUser ? getCharacterName(gtaWorldUser) : null;

    const handleGtawToggle = () => {
        if (!useGtawName && gtawCharacterName) {
            // Switch to GTAW name
            setUseGtawName(true);
            
            // Clean rank by removing dashes and extra text
            const cleanRank = gtaWorldUser?.faction?.rank ? 
                gtaWorldUser.faction.rank.split('-')[0].trim() : 'GTAW User';
            
            setFormData(prev => ({
                ...prev,
                [employeeNameField]: gtawCharacterName,
                [employeeBadgeField]: gtaWorldUser?.id || '', // Use character ID as badge number
                [employeeRankField]: cleanRank,
                [employeeDiscordField]: gtaWorldUser?.username || '',
                [employeePHNumberField]: '50056'
            }));
        } else {
            // Switch back to Firebase selection
            setUseGtawName(false);
            setFormData(prev => ({
                ...prev,
                [employeeNameField]: '',
                [employeeBadgeField]: '',
                [employeeRankField]: '',
                [employeeDiscordField]: '',
                [employeePHNumberField]: '50056'
            }));
        }
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Form.Label style={{ marginBottom: 0 }}>Employee Credentials</Form.Label>
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
                    <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i> {/* Changed icon */}
                    Missing Name?
                </button>
                {isGtaAuthenticated && gtawCharacterName && (
                    <button
                        type="button"
                        onClick={handleGtawToggle}
                        className="close-button"
                        style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            lineHeight: '1.2',
                            backgroundColor: useGtawName ? '#28a745' : '#007bff',
                            color: 'white',
                            border: 'none'
                        }}
                        title={useGtawName ? `Using GTAW: ${gtawCharacterName}` : `Use GTAW name: ${gtawCharacterName}`}
                    >
                        <i className={`fas ${useGtawName ? 'fa-check' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
                        {useGtawName ? 'Using GTAW' : 'Use GTAW'}
                    </button>
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
                        <strong>Name:</strong> {gtawCharacterName}<br/>
                        <strong>Username:</strong> {gtaWorldUser?.username}<br/>
                        <strong>Badge Number:</strong> {gtaWorldUser?.character.id}<br/>
                        {gtaWorldUser?.faction?.rank && (
                            <><strong>Rank:</strong> {gtaWorldUser.faction.rank.split('-')[0].trim()}<br/></>
                        )}
                        <small style={{ color: '#6c757d' }}>Click "Use GTAW" again to switch back to database selection</small>
                    </div>
                </div>
            ) : (
                <Select
                    name={employeeNameField}
                    value={groupedOptions
                        .flatMap(group => group.options)
                        .find(option => option.value === formData[employeeNameField]) || null}
                    onChange={(selectedOption) => handleSelectChange(selectedOption, { name: employeeNameField })}
                    options={groupedOptions}
                    isClearable
                    placeholder={`Search or select ${employeeType}...`}
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
            )}
        </>
    );
};

const Surgical = ({ // Renamed component to follow PascalCase convention
            formData,
            handleChange,
            phmcGroupedOptions, // Added this prop
            setFormData,
            phmcRank,
            patientConsent,
            complications,
            procedureGood,
            setShowEmployeeModal,
            handleSelectChange
        }) => {
    return (
    <>
    <p>The FORM below must be used and added to the file for each surgery appointment, following the others.</p>
    <Form.Label>Patient ID, leave blank if unsure</Form.Label>
    <Form.Control
                type="text"
                name="patientID"
                value={formData.patientID}
                onChange={handleChange}
                placeholder="Patient ID  (Optional)"
                className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}

            />

        <Form.Label>Appointment Date</Form.Label>
        <Form.Control
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className={`form-control ${!formData.date ? 'is-invalid' : ''}`}

            required
        />

    <Form.Select
                name="phmcRank"
                value={formData.phmcRank}
                onChange={handleChange}
                required
                className={`form-control ${!formData.phmcRank ? 'is-invalid' : ''}`}
            >
                <option value="" disabled>PHMC Rank</option>
                {phmcRank.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </Form.Select>



    <EmployeeCredentialsSection 
        formData={formData}
        setFormData={setFormData}
        groupedOptions={phmcGroupedOptions}
        handleSelectChange={handleSelectChange}
        setShowEmployeeModal={setShowEmployeeModal}
        employeeType="phmc"
    />
    <Form.Label></Form.Label>

    <Select
        isMulti
        name="extraStaff"
        options={phmcGroupedOptions.map(group => ({
            label: group.label,
            options: group.options.map(option => ({ value: option.value, label: option.label }))
        }))}
        value={Array.isArray(formData.extraStaff)
            ? formData.extraStaff.map(staff => ({ value: staff, label: staff }))
            : []}
        onChange={(selectedOptions) => {
            const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
            handleChange({
                target: {
                    name: 'extraStaff',
                    value: selectedValues
                }
            });
        }}
        className="form-control"
        placeholder="Enter staff present (( Leave empty if none)  )) "
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
/>                                
    <Form.Label></Form.Label>
        <Form.Label>Surgical Inquiry   </Form.Label>
        <Form.Control
            type="text"
            name="surgeryProcedures"
            value={formData.surgeryProcedures}
            onChange={handleChange}
            placeholder="Name of the procedure	"
            required
        />

        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Select
        name="patientConsentOption"
        value={formData.patientConsentOption}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientConsentOption: selectedType,
                patientConsentYes: selectedType === 'Yes' ? prev.patientConsentYes : '',
                patientConsentNo: selectedType === 'No' ? prev.patientConsentNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.patientConsentOption ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Patient Consented?</option>
        {patientConsent.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>        
    <Form.Select
        name="patientComplicationOptions"
        value={formData.patientComplicationOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                patientComplicationOptions: selectedType,
                patientComplicationsYes: selectedType === 'Yes' ? prev.patientComplicationsYes : '',
                patientComplicationsNo: selectedType === 'No' ? prev.patientComplicationsNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.patientComplicationOptions ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Surgery Complications?</option>
        {complications.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    <Form.Select
        name="procedureGoodOptions"
        value={formData.procedureGoodOptions}
        onChange={(e) => {
            const selectedType = e.target.value;
            setFormData(prev => ({
                ...prev,
                procedureGoodOptions: selectedType,
                procedureGoodYes: selectedType === 'Yes' ? prev.procedureGoodYes : '',
                procedureGoodNo: selectedType === 'No' ? prev.procedureGoodNo : '',
            }));
        }}
        required
        className={`form-control ${!formData.procedureGoodOptions ? 'is-invalid' : ''}`}
    >
        <option value="" disabled>Procedure Good?</option>
        {procedureGood.map((option) => (
            <option key={option.value} value={option.value}>{option.value}</option>
        ))}
    </Form.Select>
    </div>

        <Form.Label> Post-Anesthesia Report</Form.Label>
        <div style={{ display: 'flex', gap: '10px' }}>
        <Form.Control
            as="textarea"
            name="patientSummaryConsultation"
            value={formData.patientSummaryConsultation}
            onChange={handleChange}
            placeholder="Summary of Consultation"
            rows="4"
            required
            className={`form-control ${!formData.patientSummaryConsultation ? 'is-invalid' : ''}`}
        />
        <Form.Control
            as="textarea"
            name="patientAddress"
            value={formData.patientAddress}
            onChange={handleChange}
            rows="4"
            required
            className={`form-control ${!formData.patientAddress ? 'is-invalid' : ''}`}
            placeholder="Post-Operative Anesthesia Details	"
        /></div>
        <Form.Label> Summary of Surgical Procedure</Form.Label>
        <Form.Control
            as="textarea"
            name="patientSummary"
            value={formData.patientSummary}
            onChange={handleChange}
            rows="4"
            required
            className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
            placeholder="Summary of Surgical Procedure	"
        />
</>
    );
};

export default Surgical; // Export with PascalCase name