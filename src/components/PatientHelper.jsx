// components/PatientHelper.jsx — PHMC Blaster 1.3 (FINAL CLINICAL EDITION)
import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';

const mechanisms = [
  'Medical (Unwell)', 'Cardiac Arrest', 'RTC', 'Fall from height', 'Assault', 
  'Overdose', 'Collapse ?cause', 'Trauma', 'Burns', 'Drowning', 'Fitting', 
  'Stroke', 'Anaphylaxis', 'Hypoglycaemia', 'Chest Pain', 'Difficulty Breathing',
  'Syncope', 'Abdominal Pain', 'Psychiatric', 'Obstetric'
];

const treatments = [
  'Nil given', 'Oxygen', 'IV access', 'Fluid bolus', 'Pain relief', 
  'Aspirin', 'GTN', 'Salbutamol', 'Glucagon', 'Adrenaline', 'CPAP', 
  'Defibrillation', 'CPR in progress', 'Airway adjunct', 'Traction splint',
  'Entonox', 'Paracetamol', 'Ibuprofen', 'Ondansetron', 'Other'
];

const PatientHelper = () => {
  const [unitCallsign, setUnitCallsign] = useState('MEDIC');
  const [ageGroup, setAgeGroup] = useState('Adult');
  const [gender, setGender] = useState('Male');
  const [mechanism, setMechanism] = useState('');
  const [customMech, setCustomMech] = useState('');
  const [treatment, setTreatment] = useState('Nil given');
  const [treatmentText, setTreatmentText] = useState('');
  const [eta, setEta] = useState('10');
  const [vitalStatus, setVitalStatus] = useState('Stable'); // NEW DROPDOWN

  // Generate vitals based on status
  const generateVitals = () => {
    if (vitalStatus === 'Stable') {
      const rr = Math.floor(Math.random() * 6) + 14;     // 14–19
      const spo2 = Math.floor(Math.random() * 5) + 95;   // 95–99%
      const hr = Math.floor(Math.random() * 31) + 60;    // 60–90
      const bpSys = Math.floor(Math.random() * 31) + 110; // 110–140
      const bpDia = Math.floor(Math.random() * 21) + 70;  // 70–90
      const rhythm = Math.random() > 0.1 ? 'sinus' : 'sinus tachycardia';

      return `GCS 15, RR ${rr}, SpO2 ${spo2}% RA, HR ${hr} ${rhythm}, BP ${bpSys}/${bpDia}`;
    }

    // UNSTABLE — clinically sick, but not dead
    const gcs = [3, 8, 9, 10, 13][Math.floor(Math.random() * 5)]; // Realistically low
    const rr = Math.floor(Math.random() * 16) + 20;    // 20–35 (tachypnoea)
    const spo2 = Math.floor(Math.random() * 16) + 78;  // 78–93%
    const hr = Math.random() > 0.7 
      ? Math.floor(Math.random() * 61) + 120   // 120–180 (tachy)
      : Math.floor(Math.random() * 41) + 30;   // 30–70 (brady or shock)
    const bpSys = Math.floor(Math.random() * 41) + 70; // 70–110 (hypotensive)
    const bpDia = Math.floor(Math.random() * 31) + 40; // 40–70
    const rhythmOptions = ['sinus tachycardia', 'AF', 'SVT', 'bradycardia', 'irregular'];
    const rhythm = rhythmOptions[Math.floor(Math.random() * rhythmOptions.length)];

    const spo2Text = spo2 < 90 ? `${spo2}% on high-flow O2` : `${spo2}% RA`;
    
    return `GCS ${gcs}, RR ${rr}, SpO2 ${spo2Text}, HR ${hr} ${rhythm}, BP ${bpSys}/${bpDia}`;
  };

  const [vitals, setVitals] = useState(generateVitals());

  // Regenerate vitals when status changes
  React.useEffect(() => {
    setVitals(generateVitals());
  }, [vitalStatus]);

  const generateHandover = () => {
    const finalTreatment = treatment === 'Other' 
      ? (treatmentText.trim() || 'treatment as per protocol') 
      : treatment;

    const mech = mechanism === 'Other' 
      ? (customMech.trim() || 'unknown presentation') 
      : (mechanism || 'unknown presentation');

    const statusText = vitalStatus === 'Stable' ? 'stable' : 'unstable';

    const handover = `${unitCallsign} to PHMC, enroute with a ${ageGroup} ${gender}, ${mech}. Patient is ${statusText}, ${vitals}. Treatment given ${finalTreatment}. ETA ${eta} minutes. Any questions?`;

    return handover;
  };

  const [output, setOutput] = useState('');

  const handleGenerate = () => {
    setOutput(generateHandover());
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    alert('Copied — go sound like a pro on air');
  };

  return (
    <div className="patient-helper card mt-4" style={{ 
      background: 'linear-gradient(135deg, #0a1f3d, #112233)', 
      border: '1px solid #0066cc',
      boxShadow: '0 0 20px rgba(0, 102, 204, 0.3)'
    }}>
      <div className="card-body text-light">

        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <Form.Label className="text-info">Your Callsign</Form.Label>
            <Form.Control 
              type="text" 
              value={unitCallsign} 
              onChange={e => setUnitCallsign(e.target.value)}
              placeholder="e.g. M2001, A501, H131"
              style={{ background: '#223', border: '1px solid #0066cc', color: '#0f0' }}
            />
          </div>

          <div className="col-md-3">
            <Form.Label className="text-info">Patient Type</Form.Label>
            <Form.Select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}>
              <option>Adult</option>
              <option>Child</option>
            </Form.Select>
          </div>

          <div className="col-md-3">
            <Form.Label className="text-info">Gender</Form.Label>
            <Form.Select value={gender} onChange={e => setGender(e.target.value)}>
              <option>Male</option>
              <option>Female</option>
            </Form.Select>
          </div>

          <div className="col-md-2">
            <Form.Label className="text-info">ETA (mins)</Form.Label>
            <Form.Control type="number" value={eta} onChange={e => setEta(e.target.value)} min="1" max="120" />
          </div>
        </div>

        <div className="row g-3 mt-3">
          <div className="col-md-6">
            <Form.Label className="text-warning fw-bold">Patient Stability</Form.Label>
            <Form.Select 
              value={vitalStatus} 
              onChange={e => setVitalStatus(e.target.value)}
              style={{ fontWeight: 'bold' }}
            >
              <option value="Stable">Stable (Green)</option>
              <option value="Unstable">Unstable (Red)</option>
            </Form.Select>
          </div>

          <div className="col-md-6">
            <Form.Label className="text-info">Current Vitals</Form.Label>
            <Form.Control
              type="text"
              value={vitals}
              readOnly
              style={{ 
                background: vitalStatus === 'Unstable' ? '#440000' : '#002200',
                color: vitalStatus === 'Unstable' ? '#ff6666' : '#66ff66',
                fontFamily: 'Consolas, monospace',
                fontWeight: 'bold'
              }}
            />
          </div>
        </div>

        <div className="row g-3 mt-2">
          <div className="col-md-6">
            <Form.Label className="text-info">Mechanism / Complaint</Form.Label>
            <Form.Select value={mechanism} onChange={e => setMechanism(e.target.value)}>
              <option value="">— Select —</option>
              {mechanisms.map(m => <option key={m}>{m}</option>)}
              <option value="Other">Other / Custom</option>
            </Form.Select>
            {mechanism === 'Other' && (
              <Form.Control className="mt-2" placeholder="e.g. Found on floor, ?LOC" value={customMech} onChange={e => setCustomMech(e.target.value)} />
            )}
          </div>

          <div className="col-md-6">
            <Form.Label className="text-info">Treatment Given</Form.Label>
            <Form.Select value={treatment} onChange={e => setTreatment(e.target.value)}>
              {treatments.map(t => <option key={t}>{t}</option>)}
            </Form.Select>
            {treatment === 'Other' && (
              <Form.Control className="mt-2" placeholder="Describe treatment..." value={treatmentText} onChange={e => setTreatmentText(e.target.value)} />
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <Button variant="danger" size="lg" onClick={handleGenerate} style={{ minWidth: 240, fontWeight: 'bold' }}>
            GENERATE HANDOVER
          </Button>
        </div>

        {output && (
          <>
            <div className="mt-4 p-4 bg-dark rounded border border-success text-start" style={{ fontFamily: 'Consolas, monospace', fontSize: '1.15em', lineHeight: '1.6' }}>
              <strong style={{ color: '#00ff9d' }}>TRANSMIT:</strong><br/>
              <span style={{ color: '#00ff9d' }}>{output}</span>
            </div>
            <div className="text-center mt-3">
              <Button variant="outline-light" size="lg" onClick={copyToClipboard}>
                Copy to Clipboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PatientHelper;