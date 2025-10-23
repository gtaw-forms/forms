import React, { useEffect, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import { getCharacterName, getCharacterID } from '../utils/characterUtils';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';
import DiscordNameModal from '../components/DiscordNameModal';
import { database } from '../firebase';
import { cleanRankText } from '../utils/textUtils';
import { ref, update } from 'firebase/database';
import { useNotification } from '../contexts/NotificationContext';
import { recordInputInteraction } from '../index';


const EmployeeCredentialsSection = ({ 
    formData, 
    setFormData, 
    groupedOptions, 
    handleSelectChange, 
    setShowEmployeeModal,
    employeeType = 'coroner'
}) => {
    const { showNotification } = useNotification();

    const {
        user: gtaWorldUser,
        isAuthenticated: isGtaAuthenticated,
        canSwapCharacters,
        swapCharacter,
        swappableCharacters,
        factionData,
        updateFactionData, // Get the update function
    } = useGtaWorldAuth();

    const [useGtawName, setUseGtawName] = useState(false);
    const [showDiscordModal, setShowDiscordModal] = useState(false);
    const [customDiscordName, setCustomDiscordName] = useState('');

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
        if (isGtaAuthenticated && gtaWorldUser && factionData) {
            if (factionData.discordName) {
                setCustomDiscordName(factionData.discordName);
            } else {
                setCustomDiscordName('');
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, factionData]);

    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !useGtawName) {
            // Check if we have a valid character name
            const gtawCharacterName = getCharacterName(gtaWorldUser);
            
            if (gtawCharacterName && gtawCharacterName !== 'GTAW User') {
                setUseGtawName(true);
                
                // Normalize rank/category using shared cleaner
                const cleanRank = gtaWorldUser?.faction?.rank ? 
                    cleanRankText(gtaWorldUser.faction.rank) : 'GTAW User';
                
                // Get character data using helper function
                const characterId = getCharacterID(gtaWorldUser);
                
                setFormData(prev => ({
                    ...prev,
                    [employeeNameField]: gtawCharacterName,
                    [employeeBadgeField]: characterId, 
                    [employeeRankField]: cleanRank,
                    [employeeDiscordField]: customDiscordName || gtaWorldUser?.username || '',
                    [employeePHNumberField]: '50056'
                }));
            }
        }
    }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField, customDiscordName]);
    
    useEffect(() => {
        if (useGtawName && isGtaAuthenticated && gtaWorldUser && factionData) {
            const cleanRank = factionData.rank ? cleanRankText(factionData.rank) : 'GTAW User';
            setFormData(prev => ({
                ...prev,
                coronerEmployee: factionData.characterName,
                coronerBadge: factionData.characterId || '',
                coronerRank: cleanRank,
                coronerDiscord: customDiscordName || gtaWorldUser?.username || '',
                coronerPHNumber: '50056'
            }));
        }
    }, [factionData, useGtawName, isGtaAuthenticated, gtaWorldUser, setFormData, customDiscordName]);

    const gtawCharacterName = factionData?.characterName || null;

    const handleSwap = () => {
        if (!canSwapCharacters || !factionData) return;
        const currentIndex = swappableCharacters.findIndex(c => c.character.characterId === factionData.characterId);
        const nextIndex = (currentIndex + 1) % swappableCharacters.length;
        const nextCharacterId = swappableCharacters[nextIndex].character.characterId;
        swapCharacter(nextCharacterId);
    };

    const handleSaveDiscordName = async (newDiscordName) => {
        if (factionData && factionData.characterId) {
            const characterId = factionData.characterId;
            const userRef = ref(database, `factions/364/members/${characterId}`);

            try {
                await update(userRef, { discordName: newDiscordName });
                setCustomDiscordName(newDiscordName);

                // Update the local faction data context
                const updatedFactionData = { ...factionData, discordName: newDiscordName };
                updateFactionData(updatedFactionData);

                showNotification('Discord name updated successfully!', 'success');
            } catch (error) {
                console.error('Error updating Discord name:', error);
                showNotification('Failed to update Discord name. Please try again.', 'error');
            }
        }
        setShowDiscordModal(false);
    };

    return (
        <>
            <DiscordNameModal
                show={showDiscordModal}
                handleClose={() => setShowDiscordModal(false)}
                handleSave={handleSaveDiscordName}
                currentDiscordName={customDiscordName || gtaWorldUser?.username}
            />
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
                {canSwapCharacters && useGtawName && factionData && (
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
                            <>
                                <strong>Rank:</strong> {cleanRankText(factionData.rank)}<br/>
                                <strong>Discord:</strong> {customDiscordName || gtaWorldUser?.username}
                                <Button variant="link" size="sm" onClick={() => setShowDiscordModal(true)}>(Edit)</Button>
                                <br/>
                            </>
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

const CoronerEmail = ({ // Renamed component to follow PascalCase convention
    formData,
    handleChange,
    setFormData, // <-- Make sure setFormData is passed as a prop
    handleSelectChange, // Added this prop
    setShowEmployeeModal,
    coronerGroupedOptions,
    handleFillCoronerPhone,
    fillPhoneChecked,
    setFillPhoneChecked,
    addReport,
    removeReport,
    handleReportChange,
    toggleSavedReports 
}) => {

    // Get agencyDataStore from context
    const { agencyDataStore, isLoadingData } = useData();

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            decedentName: '',
            decedentOOC: ''
        }));
    }, [setFormData]);

    // Enhanced handleChange to record input interactions for error reporting
    const handleChangeWithContext = (e) => {
        const { name, type } = e.target;
        let inputType = 'text'; // default

        if (type === 'checkbox') inputType = 'checkbox';
        else if (type === 'radio') inputType = 'radio';
        else if (type === 'select-one') inputType = 'select';
        else if (type === 'textarea') inputType = 'textarea';

        recordInputInteraction(inputType, name);
        handleChange(e);
    };

    // Enhanced handleReportChange to record input interactions
    const handleReportChangeWithContext = (index, value) => {
        recordInputInteraction('textarea', `additionalReport_${index}`);
        handleReportChange(index, value);
    };


    return (
        <>
            <p>Please be careful when Attaching Reports, it may take some time to process. Also attaching reports will automatically add the decedent name and decedent OOC!!!</p>

            <EmployeeCredentialsSection 
                formData={formData}
                setFormData={setFormData}
                groupedOptions={coronerGroupedOptions}
                handleSelectChange={handleSelectChange}
                setShowEmployeeModal={setShowEmployeeModal}
            />
            <Form.Label></Form.Label>
            <div style={{ display: 'flex', gap: '10px' }}>
                <Form.Control
                    type="text"
                    name="requestingOfficer"
                    value={formData.requestingOfficer}
                    onChange={handleChangeWithContext}
                    placeholder="Requesting Officer Name"
                    required
                    className={`form-control ${!formData.requestingOfficer ? 'is-invalid' : ''}`}
                    />
            <Form.Select
                name="department"
                value={formData.department}
                onChange={handleChangeWithContext}
                required
                className={`form-control ${!formData.department ? 'is-invalid' : ''}`}
                disabled={isLoadingData || !agencyDataStore || Object.keys(agencyDataStore).length === 0}
            >
                <option value="" disabled>
                    {isLoadingData ? 'Loading departments...' : 'Select Department'}
                </option>
                {agencyDataStore && Object.entries(agencyDataStore).map(([key, agency]) => (
                    <option key={key} value={key}>
                        {agency.fullName || key}
                    </option>
                ))}
            </Form.Select>
</div>
<Form.Group className="mb-3">
<Form.Label>
    Coroner Contact Number:
</Form.Label>
{/* Keep the input field */}
<Form.Control
    type="text"
    name="coronerPHNumber"
    value={formData.coronerPHNumber}
    onChange={handleChangeWithContext}
    required
    placeholder="Coroner Phone Number"
    className={`form-control ${!formData.coronerPHNumber ? 'is-invalid' : ''}`}
/>
</Form.Group>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Control
                                        type="text"
                                        name="decedentName"
                                        value={formData.decedentName}
                                        onChange={handleChangeWithContext}
                                        placeholder="Decedent's IC name"
                                        required
                                        className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`}
                                    />
                                    <Form.Control
                                    type="text"
                                    name="decedentOOC"
                                    value={formData.decedentOOC}
                                    onChange={handleChangeWithContext}
                                    placeholder="Decedent's OOC name"
                                    required
                                    className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`}
                                    />
                                </div>

                            <Form.Group className="mb-3">
                                <Form.Label>Paste Form BBCode:</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    name="deathReport"
                                    value={formData.deathReport}
                                    onChange={handleChangeWithContext}
                                    placeholder="Paste Paperwork (Death Report, Mass Fatality) BBCode here"
                                    rows="2"
                                    className={`form-control ${!formData.deathReport ? 'is-invalid' : ''}`}

                                />
                            </Form.Group>
        <Form.Group className="mb-3">
            <Form.Label>Additional Reports:</Form.Label>
            <div className="reports-container">
                {(formData.additionalReports || []).map((report, index) => (
                    <div key={index} className="report-input">
                        <Form.Control
                            as="textarea"
                            value={report}
                            onChange={(e) => handleReportChangeWithContext(index, e.target.value)}
                            placeholder="Paste additional coroner report here"
                            rows="4"
                            className={`form-control ${!report ? 'is-invalid' : ''}`}
                        />
                        <Button
                            variant="danger"
                            onClick={() => removeReport(index)}
                            className="remove-report-button"
                        >
                            Remove Report
                        </Button>
                    </div>
                ))}
                <div className="email-buttons">
                    <Button
                        variant="primary"
                        onClick={addReport}
                        className="add-report-button"
                    >
                        Add Another Report
                    </Button>

                    <Button
                        variant="info"
                        onClick={() => toggleSavedReports([1, 11], 'Coroner', (reportData) => {
                            console.log('Selected report data:', reportData);
                            // Update the deathReport field with the selected report's BBCode
                            if (reportData && reportData.bbCode) {
                                handleChange({
                                    target: {
                                        name: 'deathReport',
                                        value: reportData.bbCode
                                    }
                                });
                            }
                        })}
                        className="email-button"
                    >
                        <i className="fas fa-save"></i> Attach Paperwork (Death Reports, Mass Fatality)
                    </Button>

                </div>

            </div>
        </Form.Group>
    </>
    );
};
export default CoronerEmail;