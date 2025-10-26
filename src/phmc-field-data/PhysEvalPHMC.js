import { Form } from 'react-bootstrap';
import EmployeeCredentialsSection from '../components/EmployeeCredentialsSection';
const PhysEval = ({
            formData,
            handleChange,
            phmcGroupedOptions,
            setFormData,
            phmcRank,
            setShowEmployeeModal,
            BodyMassIndex,
            temperature,
            heartRate,
            breathing,
            bloodPressure,
            patientJob,
            patientJobRisks,
            patientAllergiesRisk,
            patientMedicineRegular,
            patientOther,
            predisposition,
            handleSelectChange,
            
        }) => {
    return (
    <>
                                <p>The FORM below must be used and added to the file for each medical appointment, following the others.</p>
                                <Form.Label>Patient ID | Date:</Form.Label>
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Control
                                    type="text"
                                    name="patientID"
                                    value={formData.patientID}
                                    onChange={handleChange}
                                    placeholder="Patient ID"
                                    required
                                    className="form-control"
                                />

                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control"
                                    
                                /> </div>

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


                                    <Form.Label>Patient Measurements</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>

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

                                    <Form.Select
                                        name="BodyMassIndex"
                                        value={formData.BodyMassIndex}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                BodyMassIndex: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Body Mass Index</option>
                                        {BodyMassIndex.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>


                                    <Form.Label>Vitals</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="temperature"
                                        value={formData.temperature}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                temperature: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Select Temperature</option>
                                        {temperature.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="heartRate"
                                        value={formData.heartRate}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                heartRate: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Select Heart Rate</option>
                                        {heartRate.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="breathing"
                                        value={formData.breathing}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                breathing: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Breathing</option>
                                        {breathing.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="bloodPressure"
                                        value={formData.bloodPressure}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                bloodPressure: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Blood Pressure</option>
                                        {bloodPressure.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Anamnesis</Form.Label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                    <Form.Select
                                        name="patientJob"
                                        value={formData.patientJob}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJob: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Job</option>
                                        {patientJob.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientJobRisks"
                                        value={formData.patientJobRisks}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientJobRisks: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Job Risks (Optional) </option>
                                        {patientJobRisks.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientAllergiesRisk"
                                        value={formData.patientAllergiesRisk}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientAllergiesRisk: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Allergies Risk</option>
                                        {patientAllergiesRisk.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
</div>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    {formData.patientJob === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Patient Job"
                                    required
                                    className="form-control"
                                    />
                                )}
                                    {formData.patientJob === 'No' && (
                                    <Form.Control
                                    type="text"
                                    name="patientCareer"
                                    value={formData.patientCareer}
                                    onChange={handleChange}
                                    placeholder="Patient Job No"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientJobRisks === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="careerRisks"
                                    value={formData.careerRisks}
                                    onChange={handleChange}
                                    placeholder="Patient Job Risks"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                  {formData.patientAllergiesRisk === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientAllergies"
                                    value={formData.patientAllergies}
                                    onChange={handleChange}
                                    placeholder="Patient Allergies Risks"
                                    required
                                    className="form-control"
                                    />
                                )} 

                                </div>
                                
                                <div style={{ display: 'flex', gap: '10px' }}>

                                <Form.Select
                                        name="patientMedicineRegular"
                                        value={formData.patientMedicineRegular}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientMedicineRegular: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Current Medications</option>
                                        {patientMedicineRegular.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="patientOther"
                                        value={formData.patientOther}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                patientOther: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Patient Imparements?</option>
                                        {patientOther.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select>
                                    <Form.Select
                                        name="predisposition"
                                        value={formData.predisposition}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                predisposition: e.target.value
                                            }));
                                        }}
                                        className="form-control"
                                    >
                                        <option value="" disabled>Predisposition</option>
                                        {predisposition.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Form.Select></div>
                                    <div style={{ display: 'flex', gap: '10px' }}>

                                    {formData.patientMedicineRegular === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientMedicine"
                                    value={formData.patientMedicine}
                                    onChange={handleChange}
                                    placeholder="What medication(s) is the patient currently taking?"
                                    required
                                    className="form-control"
                                    />
                                )} 
                                    {formData.patientOther === 'Yes' && (
                                    <Form.Control
                                    type="text"
                                    name="patientImpairments"
                                    value={formData.patientImpairments}
                                    onChange={handleChange}
                                    placeholder="Patient Imparements"
                                    required
                                    className="form-control"
                                    />
                                )} </div>
                                        <Form.Control
                                        as="textarea"
                                        name="patientSummary"
                                        value={formData.patientSummary}
                                        onChange={handleChange}
                                        rows="4"
                                        required
                                        className={`form-control ${!formData.patientSummary ? 'is-invalid' : ''}`}
                                        placeholder="Assessment Statement"
                                    />
                                </Form.Group>
                            </>
    );
};

export default PhysEval;