import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { database } from '../firebase';
import Select from 'react-select';
import { ref, get } from 'firebase/database';

const DeathRecord = ({ 
    formData, 
    handleChange, 
    handleSelectChange,
    coronerGroupedOptions
}) => {
    const [selectOptions, setSelectOptions] = useState({
        deathRecordType: [],
        caseStatusOptions: [],
        bodyStatusOptions: [],
        gender: [],
        mannerOfDeathOptions: [],
    });

    const handleUrlChange = (e) => {
        const url = e.target.value;
        const name = e.target.name;

        // Create a synthetic event for the URL itself to update deathReportPostId
        const urlEvent = { target: { name, value: url } };
        handleChange(urlEvent);

        // Extract the number from the URL and update the caseNumber
        const match = url.match(/\?t=(\d+)/);
        const caseNumber = match ? match[1] : '';

        const caseNumberEvent = { target: { name: 'caseNumber', value: caseNumber } };
        handleChange(caseNumberEvent);
    };

    useEffect(() => {
        const optionsRef = ref(database, 'selectOptions');
        get(optionsRef).then((snapshot) => {
            if (snapshot.exists()) {
                const options = snapshot.val();
                setSelectOptions({
                    deathRecordType: options.deathRecordType || [],
                    caseStatusOptions: options.caseStatusOptions || [],
                    bodyStatusOptions: options.bodyStatusOptions || [],
                    gender: options.gender || [],
                    mannerOfDeathOptions: options.mannerOfDeathOptions || [],
                });
            }
        });
    }, []);

    return (
        <>
            <Form.Group className="mb-3">
                <Form.Label>Death Record Type</Form.Label>
                <Form.Select
                    name="deathRecordType"
                    value={formData.deathRecordType}
                    onChange={handleChange}
                    required
                    className={`form-control ${!formData.deathRecordType ? 'is-invalid' : ''}`}
                >
                    <option value="" disabled>Select Public Death Case Record Type </option>
                    {selectOptions.deathRecordType.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </Form.Select>
            </Form.Group>

            {formData.deathRecordType && (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="text" name="deathReportPostId" value={formData.deathReportPostId} onChange={handleUrlChange} placeholder="Decedent Death Report URL" className={`form-control ${!formData.deathReportPostId ? 'is-invalid' : ''}`} />
                                            <Form.Control type="text" name="decedentName" value={formData.decedentName} onChange={handleChange} placeholder="Enter Full Decedent Name" className={`form-control ${!formData.decedentName ? 'is-invalid' : ''}`} />
                                            <Form.Control type="text" name="decedentOOC" value={formData.decedentOOC} onChange={handleChange} placeholder="Decedent OOC name" className={`form-control ${!formData.decedentOOC ? 'is-invalid' : ''}`} />

</div>
                        <Form.Label>Date of Death</Form.Label>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Control type="date" name="dateOfDeath" value={formData.dateOfDeath} onChange={handleChange} className={`form-control ${!formData.dateOfDeath ? 'is-invalid' : ''}`} />

                        <Form.Select name="caseStatus" value={formData.caseStatus} onChange={handleChange} className={`form-control ${!formData.caseStatus ? 'is-invalid' : ''}`}>
                            <option value="">Case Status</option>
                            {selectOptions.caseStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
</div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <Form.Select name="bodyStatus" value={formData.bodyStatus} onChange={handleChange} className={`form-control ${!formData.bodyStatus ? 'is-invalid' : ''}`}>
                            <option value="">Body Release Status</option>
                            {selectOptions.bodyStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>

                        <Form.Select name="sex" value={formData.sex} onChange={handleChange} className={`form-control ${!formData.sex ? 'is-invalid' : ''}`}>
                            <option value="">Gender</option>
                            {selectOptions.gender.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        </div>
                    <div style={{ display: 'flex', gap: '10px' }}>

                        <Form.Control type="text" name="ethnicity" value={formData.ethnicity} onChange={handleChange} placeholder="Enter Ethnicity"className={`form-control ${!formData.ethnicity ? 'is-invalid' : ''}`}/>
                        <Form.Control type="text" name="placeOfDeath" value={formData.placeOfDeath} onChange={handleChange} placeholder="Enter Place of Death" className={`form-control ${!formData.placeOfDeath ? 'is-invalid' : ''}`}/>
                        </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>

                        <Form.Control type="text" name="age" value={formData.age} onChange={handleChange} placeholder="Decedent's age" className={`form-control ${!formData.age ? 'is-invalid' : ''}`} />

                        <Form.Select name="manner" value={formData.manner} onChange={handleChange} className={`form-control ${!formData.manner ? 'is-invalid' : ''}`}>
                            <option value="">Manner of Death</option>
                            {selectOptions.mannerOfDeathOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                        </div>


                    {formData.deathRecordType === 'Unidentified' && (
                        <>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="hairColor" value={formData.hairColor} onChange={handleChange} placeholder="Enter Hair Color" className={`form-control ${!formData.hairColor ? 'is-invalid' : ''}`}/>
                                <Form.Control type="text" name="eyeColor" value={formData.eyeColor} onChange={handleChange} placeholder="Enter Eye Color" className={`form-control ${!formData.eyeColor ? 'is-invalid' : ''}`}/>
                                <Form.Control type="text" name="weight" value={formData.weight} onChange={handleChange} placeholder="Enter Weight" className={`form-control ${!formData.weight ? 'is-invalid' : ''}`}/>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="height" value={formData.height} onChange={handleChange} placeholder="Enter Height" className={`form-control ${!formData.height ? 'is-invalid' : ''}`}/>

                                <Form.Control as="textarea" rows={1} name="tattoos" value={formData.tattoos} onChange={handleChange} placeholder="Enter Tattoos or None" className={`form-control ${!formData.tattoos ? 'is-invalid' : ''}`} />

                                <Form.Control as="textarea" rows={1} name="jewelry" value={formData.jewelry} onChange={handleChange} placeholder="Enter Jewelry or None" className={`form-control ${!formData.jewelry ? 'is-invalid' : ''}`}/>
                            </div>

                            <Form.Group className="mb-3">
                                <Form.Control as="textarea" rows={3} name="comments" value={formData.comments} onChange={handleChange} placeholder="Enter Comments" className={`form-control ${!formData.comments ? 'is-invalid' : ''}`}/>
                            </Form.Group>
                        </>
                    )}

                    {formData.deathRecordType !== 'Unidentified' && (
                        <>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="causeA" value={formData.causeA} onChange={handleChange} placeholder="Enter Cause A" className={`form-control ${!formData.causeA ? 'is-invalid' : ''}`}/>
                                <Form.Control type="text" name="causeB" value={formData.causeB} onChange={handleChange} placeholder="Enter Cause B" className={`form-control ${!formData.causeB ? 'is-invalid' : ''}`}/>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <Form.Control type="text" name="causeC" value={formData.causeC} onChange={handleChange} placeholder="Enter Cause C" className={`form-control ${!formData.causeC ? 'is-invalid' : ''}`}/>
                                <Form.Control type="text" name="causeD" value={formData.causeD} onChange={handleChange} placeholder="Enter Cause D" className={`form-control ${!formData.causeD ? 'is-invalid' : ''}`}/>
                            </div>
                            <Form.Control as="textarea" rows={3} name="otherSignificantConditions" value={formData.otherSignificantConditions} onChange={handleChange} placeholder="Enter Other Significant Conditions" className={`form-control ${!formData.otherSignificantConditions ? 'is-invalid' : ''}`}/>
                        </>
                    )}
                    <Form.Label>Investigator</Form.Label>
                                <Select
                                    name="coronerEmployee"
                                    value={coronerGroupedOptions
                                        .flatMap(group => group.options)
                                        .find(option => option.value === formData.coronerEmployee) || null}
                                    // Corrected onChange handler:
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
                        <Form.Label>Chief Medical Examiner or Deputy Chief Medical Examiner</Form.Label>
                                <Select
                name="chiefMedicalExaminer"
                value={coronerGroupedOptions
                    .flatMap(group => group.options)
                    .find(option => option.value === formData.chiefMedicalExaminer) || null}
                onChange={(selectedOption) => handleSelectChange(selectedOption, { name: 'chiefMedicalExaminer' })}
                options={coronerGroupedOptions.filter(group => group.label === 'Chief Boss' || group.label === 'Deputy Chief Medical Examiner-Coroner')}
                isClearable
                placeholder="Select a Chief Medical Examiner..."
                className={`form-control ${!formData.chiefMedicalExaminer ? 'is-invalid' : ''}`}
                styles={{ 
                    control: (base, state) => ({
                        ...base,
                        backgroundColor: '#16202c',
                        color: '#eeeeeeb0',
                        borderColor: !formData.chiefMedicalExaminer && state.isFocused ? '#dc3545' :
                                     !formData.chiefMedicalExaminer ? '#dc3545' :
                                     state.isFocused ? '#86b7fe' : '#6c757d',
                        '&:hover': {
                            borderColor: !formData.chiefMedicalExaminer ? '#dc3545' : '#86b7fe'
                        },
                        boxShadow: !formData.chiefMedicalExaminer && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' :
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

                </>
            )}
        </>
    );
};

export default DeathRecord;