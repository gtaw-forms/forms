import React, { useState, useMemo } from 'react';
import { Button, Form, Row, Col } from 'react-bootstrap';
import AnatomyViewer from '../Common/AnatomyViewer';

// Import placeholder images
import headImg from '../../assets/anatomy/head.svg';
import chestImg from '../../assets/anatomy/chest.svg';
import abdomenImg from '../../assets/anatomy/abdomen.svg';
import armImg from '../../assets/anatomy/arm.svg';
import legImg from '../../assets/anatomy/leg.svg';


// --- Replicated Modal Styles ---
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1050,
};

const contentStyle = {
    position: 'relative',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 5px 15px rgba(0,0,0,0.5)'
};

const headerStyle = {
    padding: '1rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #334155',
};

const titleStyle = {
    color: '#a78bfa',
    margin: 0,
    fontSize: '1.25rem'
};

const closeButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '1.5rem',
    lineHeight: 1,
    opacity: 0.75,
    cursor: 'pointer'
};

const bodyStyle = {
    padding: '1.5rem',
    overflowY: 'auto'
};
// --- End Styles ---

const anatomyImageMap = {
    Head: headImg,
    Chest: chestImg,
    Abdomen: abdomenImg,
    Arms: armImg,
    Legs: legImg,
};


const bodyParts = {
    "Head": ["Brain", "Eyes", "Ears", "Nose", "Mouth", "Scalp", "Skull", "Face", "Frontal Scalp", "Occipital Scalp", "Cranial Vault"],
    "Neck": ["Throat", "Trachea", "Cervical Spine", "Esophagus", "Carotid Artery", "Jugular Vein", "Sternohyoid", "C3-C4 cervical vertebrae"],
    "Chest": ["Heart", "Lungs", "Ribs", "Sternum", "Clavicle", "Thoracic Spine", "Aorta", "Chest Wall", "Myocardium"],
    "Abdomen": ["Liver", "Stomach", "Kidneys", "Spleen", "Intestines", "Bladder", "Pancreas", "Gallbladder", "Appendix"],
    "Back": ["Spine", "Scapula", "Lumbar Region", "Sacrum", "Lower Back", "Upper Back"],
    "Arms": ["Shoulder", "Upper Arm", "Elbow", "Forearm", "Wrist", "Hand", "Fingers", "Bicep", "Tricep"],
    "Legs": ["Hip", "Thigh", "Femur", "Knee", "Shin", "Calf", "Ankle", "Foot", "Toes"],
    "Genitalia": ["Genitalia"]
};

const woundTypes = [
    "Perforating gunshot wound", "Penetrating gunshot wound", "Gunshot Wound (Entry)", "Gunshot Wound (Exit)",
    "Stab Wound", "Laceration", "Incised Wound",
    "Bruise (Contusion)", "Abrasion", "Fracture", "Burn", "Bite Mark", "Taser Prong",
    "Surgical Incision", "Needle Puncture", "Defensive Wound", "Hesitation Mark", "Decomposition",
    "Scarring", "Tattoo", "Birthmark", "Puncture Wound", "Penetrating Injury"
];

const caliberOptions = [
    "9x19mm Parabellum", ".45 ACP", "5.56x45mm NATO", "7.62x39mm", 
    "7.62x51mm NATO", ".308 Winchester", "12 Gauge", ".22LR", ".50 BMG", "Other"
];

const pathTemplates = {
  'Penetrating gunshot wound': {
    'Head': "entry at the {side} {part}, lacerating the parenchyma and embedding at the cranial vault",
    'Neck': "entry at the {side} {part}, perforating the sternohyoid and rupturing the trachea, embedding at the C3-C4 cervical vertebrae",
    'Chest': "entry at the {side} {part}, perforating the myocardium and causing significant hemorrhage",
    'Abdomen': "entry at the {side} {part}, causing significant internal hemorrhage and organ damage"
  },
  'Perforating gunshot wound': {
    'Head': "entry at the {side} {part}, with an exit wound at the [Describe Exit Location]",
    'Chest': "entry at the {side} {part}, traversing the thoracic cavity and exiting at the [Describe Exit Location]",
    'Abdomen': "entry at the {side} {part}, traversing the abdominal cavity and exiting at the [Describe Exit Location]",
  },
  'Stab Wound': {
    'Chest': "a single stab wound of the {side} {part}, penetrating the thoracic wall to a depth of [X] cm",
    'Abdomen': "a single stab wound of the {side} {part}, penetrating the abdominal wall to a depth of [X] cm",
    'Neck': "a single stab wound of the {side} {part}, incising the major blood vessels",
  },
  'Laceration': {
    'Head': "a [X] cm laceration of the {side} {part}, extending to the underlying bone",
    'Arms': "a [X] cm laceration of the {side} {part}, with associated soft tissue damage",
    'Legs': "a [X] cm laceration of the {side} {part}, with associated soft tissue damage",
  }
};


const AutopsyAssist = ({ show, onHide, onInsert, formValues = {} }) => {
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedPart, setSelectedPart] = useState(null);
    const [selectedWound, setSelectedWound] = useState(null);
    const [side, setSide] = useState('N/A');
    const [woundId, setWoundId] = useState('');
    const [selectedCaliber, setSelectedCaliber] = useState('');
    const [range, setRange] = useState('');
    const [pathDescription, setPathDescription] = useState('');
    const [generatedEntries, setGeneratedEntries] = useState([]);
    const [viewerState, setViewerState] = useState({ show: false, image: null, title: '' });


    // Find the autopsy diagram URL from formValues
    const autopsyDiagramUrl = useMemo(() => {
        if (!formValues) return null;
        const diagramKey = Object.keys(formValues).find(key => key.toLowerCase().includes('autopsydiagram'));
        return diagramKey ? formValues[diagramKey] : null;
    }, [formValues]);

    const handleGenerateSuggestion = () => {
        if (!selectedWound || !selectedRegion || !selectedPart) return;
        const woundTemplate = pathTemplates[selectedWound];
        if (woundTemplate && woundTemplate[selectedRegion]) {
            let template = woundTemplate[selectedRegion];
            template = template.replace('{side}', side !== 'N/A' ? side : '').trim();
            template = template.replace('{part}', selectedPart).trim();
            setPathDescription(template);
        }
    };

    const handleAddEntry = () => {
        if (!selectedPart || !selectedWound) return;

        let entry = `${selectedWound}`;
        if (side !== 'N/A') {
            entry += ` of the ${side.toLowerCase()} ${selectedPart.toLowerCase()}`;
        } else {
            entry += ` of the ${selectedPart.toLowerCase()}`;
        }

        if (woundId) {
            const woundTypeName = selectedWound.includes("gunshot") ? "Gunshot Wound" : selectedWound;
            entry += ` (${woundTypeName} '${woundId.toUpperCase()}')`;
        }
        
        let details = [];
        if (selectedCaliber) details.push(selectedCaliber);
        if (range) details.push(range);
        if (details.length > 0) {
            entry += `, ${details.join(' - ')}`;
        }

        if (pathDescription) {
            entry += `\nentries ${pathDescription}`;
        }

        setGeneratedEntries([...generatedEntries, entry]);
        
        setWoundId('');
        setRange('');
        setPathDescription('');
        if (woundId.match(/^[A-Z]$/i)) {
            setWoundId(String.fromCharCode(woundId.toUpperCase().charCodeAt(0) + 1));
        }
    };

    const handleRemoveEntry = (index) => {
        const newEntries = [...generatedEntries];
        newEntries.splice(index, 1);
        setGeneratedEntries(newEntries);
    };

    const handleInsert = () => {
        const text = generatedEntries.join('\n\n');
        if (onInsert) onInsert(text);
        onHide();
    };

    const handleClear = () => {
        setGeneratedEntries([]);
        setSelectedRegion(null);
        setSelectedPart(null);
        setSelectedWound(null);
        setSide('N/A');
        setWoundId('');
        setSelectedCaliber('');
        setRange('');
        setPathDescription('');
    };
    
    const openAnatomyViewer = (region) => {
        if (anatomyImageMap[region]) {
            setViewerState({ show: true, image: anatomyImageMap[region], title: region });
        }
    };

    if (!show) {
        return null;
    }
    
    const canGenerateSuggestion = selectedWound && selectedRegion && pathTemplates[selectedWound] && pathTemplates[selectedWound][selectedRegion];
    const labelStyle = { color: '#94a3b8', fontSize: '0.9rem' };

    return (
        <>
            <AnatomyViewer 
                imageUrl={viewerState.image} 
                title={viewerState.title} 
                onHide={() => setViewerState({ show: false, image: null, title: '' })} 
            />
            <div style={{...overlayStyle, display: show ? 'flex' : 'none'}} onClick={onHide}>
                <div style={contentStyle} onClick={e => e.stopPropagation()}> 
                    <div style={headerStyle}>
                        <h5 style={titleStyle}>Autopsy Report Assistant (DEV TESTING ONLY) </h5>
                        <button onClick={onHide} style={closeButtonStyle} aria-label="Close">&times;</button>
                    </div>
                    <div style={bodyStyle}>
                        <Row>
                            {/* Left Column: Selection Controls */}
                            <Col md={8} className="border-end border-secondary pe-4">
                                <Row>
                                    <Col md={6}>
                                        <h6 className="text-info mb-3">1. Select Body Region</h6>
                                        <div className="d-flex flex-wrap gap-2 mb-4">
                                            {Object.keys(bodyParts).map(region => (
                                                <div key={region} className="d-flex align-items-center">
                                                    <Button variant={selectedRegion === region ? "primary" : "outline-secondary"} size="sm" onClick={() => { setSelectedRegion(region); setSelectedPart(null); }}>
                                                        {region}
                                                    </Button>
                                                    {anatomyImageMap[region] && (
                                                        <Button variant="link" size="sm" className="p-0 ms-1" onClick={() => openAnatomyViewer(region)} title={`View diagram for ${region}`}>
                                                            <i className="fas fa-search-plus text-info"></i>
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        {selectedRegion && (
                                            <>
                                                <h6 className="text-info mb-3">2. Select Specific Part</h6>
                                                <div className="d-flex flex-wrap gap-2 mb-4" style={{maxHeight: '120px', overflowY: 'auto'}}>
                                                    {bodyParts[selectedRegion].map(part => (
                                                        <Button key={part} variant={selectedPart === part ? "info" : "outline-secondary"} size="sm" onClick={() => setSelectedPart(part)}>
                                                            {part}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </Col>
                                </Row>
                                
                                <h6 className="text-info mb-3">3. Select Wound / Finding</h6>
                                <div className="d-flex flex-wrap gap-2 mb-4" style={{maxHeight: '120px', overflowY: 'auto'}}>
                                    {woundTypes.map(wound => (
                                        <Button key={wound} variant={selectedWound === wound ? "danger" : "outline-secondary"} size="sm" onClick={() => setSelectedWound(wound)}>
                                            {wound}
                                        </Button>
                                    ))}
                                </div>

                                <h6 className="text-info mb-3">4. Add Details</h6>
                                <Row>
                                    <Col md={2}>
                                        <Form.Group>
                                            <Form.Label style={labelStyle}>Side</Form.Label>
                                            <Form.Select value={side} onChange={e => setSide(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' }}>
                                                <option value="N/A">N/A</option>
                                                <option value="Right">Right</option>
                                                <option value="Left">Left</option>
                                                <option value="Midline">Midline</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={2}>
                                        <Form.Group>
                                            <Form.Label style={labelStyle}>Wound ID</Form.Label>
                                            <Form.Control type="text" placeholder="e.g., 'A'" value={woundId} onChange={(e) => setWoundId(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' }} />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label style={labelStyle}>Caliber</Form.Label>
                                            <Form.Select value={selectedCaliber} onChange={e => setSelectedCaliber(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' }}>
                                                <option value="">- Select -</option>
                                                {caliberOptions.map(cal => <option key={cal} value={cal}>{cal}</option>)}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label style={labelStyle}>Range</Form.Label>
                                            <Form.Control type="text" placeholder="e.g., <1-2m or Contact" value={range} onChange={(e) => setRange(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' }} />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Form.Group className="mt-3">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <Form.Label style={labelStyle} className="mb-0">Path / Full Description</Form.Label>
                                        <Button variant="outline-info" size="sm" disabled={!canGenerateSuggestion} onClick={handleGenerateSuggestion} title="Generate a suggestion based on selections">
                                            <i className="fas fa-wand-magic-sparkles me-2"></i>
                                            Suggest
                                        </Button>
                                    </div>
                                    <Form.Control as="textarea" rows={2} placeholder="e.g., at the frontal scalp, lacerating the parenchyma and embedding at the cranial vault" value={pathDescription} onChange={(e) => setPathDescription(e.target.value)} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: 'white' }} />
                                </Form.Group>
                                
                                <div className="d-grid mt-4">
                                    <Button variant="success" disabled={!selectedPart || !selectedWound} onClick={handleAddEntry}>
                                        <i className="fas fa-plus me-2"></i> Add to List
                                    </Button>
                                </div>
                            </Col>

                            {/* Right Column: Review List */}
                            <Col md={4} className="ps-4 d-flex flex-column">
                                {autopsyDiagramUrl && (
                                    <div className='mb-3'>
                                        <h6 className="text-white mb-2">Autopsy Diagram</h6>
                                        <img src={autopsyDiagramUrl} alt="Autopsy Diagram" style={{ width: '100%', borderRadius: '8px', border: '1px solid #334155' }} />
                                    </div>
                                )}
                                <h6 className="text-white mb-3">Generated Findings</h6>
                                <div className="flex-grow-1 mb-3 rounded p-2" style={{ backgroundColor: '#1e293b', border: '1px solid #334155', minHeight: '200px', overflowY: 'auto' }}>
                                    {generatedEntries.length === 0 ? (
                                        <div className="text-muted text-center mt-5">
                                            <i className="fas fa-clipboard-list fa-2x mb-2"></i>
                                            <p>No findings added yet.</p>
                                        </div>
                                    ) : (
                                        <ul className="list-unstyled">
                                            {generatedEntries.map((entry, idx) => (
                                                <li key={idx} className="mb-2 p-2 rounded bg-dark border border-secondary d-flex justify-content-between align-items-start">
                                                    <span style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{entry}</span>
                                                    <Button variant="link" className="text-danger p-0 ms-2" size="sm" onClick={() => handleRemoveEntry(idx)}>
                                                        <i className="fas fa-times"></i>
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="mt-auto d-flex gap-2">
                                    <Button variant="outline-danger" className="w-50" onClick={handleClear} disabled={generatedEntries.length === 0}>
                                        Clear
                                    </Button>
                                    <Button variant="primary" className="w-50" onClick={handleInsert} disabled={generatedEntries.length === 0}>
                                        Insert & Close
                                    </Button>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AutopsyAssist;
