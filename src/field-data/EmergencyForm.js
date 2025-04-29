import React from 'react';
import { Form } from 'react-bootstrap';
import Select from 'react-select';

const EmergencyForm = ({
    formData,
    handleChange,
    setFormData,
    phmcRank,
    phmcGroupedOptions,
    setShowMissingEmployeeModal,
    lab,
    painLevel,
    vitals,
    heartRate,
    breathing,
    bloodPressure,
    findings,
    lungs,
    pupils,
    wounds,
    ecg,
    sono,
    admission,
    bloodOxy
    
}) => {
    return (
        <>
        <p>If you require assistance with this form <a href="https://phmc.gta.world/viewforum.php?f=66" target="_blank" rel="noopener noreferrer">use this link! It should contain the information you require.  </a> If you still need help, use the PHMC Discord. </p>
                      <Form.Control
                          type="text"
                          name="patientID"
                          value={formData.patientID}
                          onChange={handleChange}
                          placeholder="Patient ID"
                          required
                          className={`form-control ${!formData.patientID ? 'is-invalid' : ''}`}
                      />

                      <Form.Label>Date:</Form.Label>
                      <Form.Control
                          type="date"
                          name="date"
                          value={formData.date}
                          onChange={handleChange}
                          required
                          className={`form-control ${!formData.date ? 'is-invalid' : ''}`}
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
                          className={`form-control ${!formData.phmcEmployee ? 'is-invalid' : ''}`}
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
                              <Form.Select
                                      name="painLevel"
                                      value={formData.painLevel}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.painLevel ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Pain Scale </option>
                                      {painLevel.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>

                      <Form.Control
                          type="text"
                          name="patientChiefComplaint"
                          value={formData.patientChiefComplaint}
                          onChange={handleChange}
                          placeholder="Patient Chief Complaint"
                          required
                          className={`form-control ${!formData.patientChiefComplaint ? 'is-invalid' : ''}`}
                          />
</div>
                      <Form.Label>Vitals Section </Form.Label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                              <Form.Select
                                      name="vitals"
                                      value={formData.vitals}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.vitals ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Vitals</option>
                                      {vitals.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="heartRate"
                                      value={formData.heartRate}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.heartRate ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Heart Rate</option>
                                      {heartRate.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="breathing"
                                      value={formData.breathing}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.breathing ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Breathing</option>
                                      {breathing.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="bloodPressure"
                                      value={formData.bloodPressure}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.bloodPressure ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Blood Pressure</option>
                                      {bloodPressure.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="bloodOxy"
                                      value={formData.bloodOxy}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.bloodOxy ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Blood Oxygen</option>
                                      {bloodOxy.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  </div>

                                  <Form.Label>Findings </Form.Label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                              <Form.Select
                                      name="findings"
                                      value={formData.findings}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.findings ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>General Health Conditions</option>
                                      {findings.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="lungs"
                                      value={formData.lungs}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.lungs ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Patient Lungs</option>
                                      {lungs.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="pupils"
                                      value={formData.pupils}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.pupils ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Patient Pupils</option>
                                      {pupils.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                                  
                                  <Form.Select
                                      name="wounds"
                                      value={formData.wounds}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Patient Wounds</option>
                                      {wounds.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="ecg"
                                      value={formData.ecg}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>ECG Results</option>
                                      {ecg.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  <Form.Select
                                      name="sono"
                                      value={formData.sono}
                                      onChange={handleChange}
                                      required
                                      className={`form-control ${!formData.wounds ? 'is-invalid' : ''}`}
                                  >
                                      <option value="" disabled>Sonography Results</option>
                                      {sono.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                  </Form.Select>
                                  </div>
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
                          className={`form-control ${!formData.lab ? 'is-invalid' : ''}`}
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
                      />
                      <Form.Label></Form.Label>
                      <Form.Label>Preliminary Diagnosis </Form.Label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control
                          as="textarea"
                          name="patientProcedure"
                          value={formData.patientProcedure}
                          onChange={handleChange}
                          rows="4"
                          placeholder="Procedures conducted on Patient"
                          required
                          className={`form-control ${!formData.patientProcedure ? 'is-invalid' : ''}`}
                      />

                      <Form.Control
                          as="textarea"
                          name="patientDiagnosis"
                          value={formData.patientDiagnosis}
                          onChange={handleChange}
                          rows="4"
                          placeholder="Patient Diagnosis"
                          required
                          className={`form-control ${!formData.patientDiagnosis ? 'is-invalid' : ''}`}
                      />
                      <Form.Control
                          as="textarea"
                          name="patientSecondaryDiagnosis"
                          value={formData.patientSecondaryDiagnosis}
                          onChange={handleChange}
                          rows="4"
                          placeholder="Patient Secondary Diagnosis"
                          required
                          className={`form-control ${!formData.patientSecondaryDiagnosis ? 'is-invalid' : ''}`}
                      />
                      </div>
                      <Form.Label>Therapy </Form.Label>

                      <Form.Select
                          name="admission"
                          value={formData.admission}
                          onChange={handleChange}
                          required
                          className={`form-control ${!formData.admission ? 'is-invalid' : ''}`}
                      >
                          <option value="" disabled>Patient Admitted?</option>
                          {admission.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                      </Form.Select>

                      <div style={{ display: 'flex', gap: '10px' }}>
                      <Form.Control
                          as="textarea"
                          name="patientMedicine"
                          value={formData.patientMedicine}
                          onChange={handleChange}
                          rows="4"
                          placeholder="Medication provided to Patient"
                          required
                          className={`form-control ${!formData.patientMedicine ? 'is-invalid' : ''}`}
                      />
                      </div>
                  </>
    );
};

export default EmergencyForm;