import React, { useState } from 'react';
import { generateMorgueBBCode } from '../../utils/morgueBbcodeGenerator';

const AutopsyModal = ({ show, onClose, record }) => {
    const [copied, setCopied] = useState(false);

    if (!show || !record) return null;

    const handleCopyBBCode = () => {
        const bbcode = generateMorgueBBCode(record);
        navigator.clipboard.writeText(bbcode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="autopsy-modal-overlay" onClick={onClose}>
            <div className="autopsy-modal-content" onClick={e => e.stopPropagation()}>
                <span className="autopsy-modal-close" onClick={onClose}>&times;</span>
                <div className="d-flex justify-content-between align-items-start">
                    <div>
                        <h2 className="autopsy-modal-title">Morgue Intake Records for {record.name}</h2>
                        <p className="autopsy-modal-subtitle">CASE #{record.caseId}</p>
                    </div>
                    <button 
                        className={`autopsy-copy-btn ${copied ? 'copied' : ''}`}
                        onClick={handleCopyBBCode}
                        title="Copy BBCode for Forums"
                    >
                        <i className={`fas ${copied ? 'fa-check' : 'fa-copy'} me-2`}></i>
                        {copied ? 'Copied!' : 'Copy BBCode'}
                    </button>
                </div>
                
                <div className="autopsy-warning-banner">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    <strong>NOTICE:</strong> Law Enforcement MAY use the PHMC Morgue Intake Records for PKs as proof of deaths for court cases. CKs will require a formal autopsy process which can be requested on the PHMC Forums.
                </div>

                {record.adminNote && (
                    <div className="autopsy-admin-note-section">
                        <h4><i className="fas fa-sticky-note me-2"></i>Admin Notes / Injuries</h4>
                        <p>{record.adminNote}</p>
                    </div>
                )}

                <hr className="autopsy-modal-hr" />
                
                <div className="autopsy-data-grid">
                    <div className="autopsy-data-section">
                        <h4>Vital Statistics</h4>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Estimated Age</span> 
                            <span>{record.estimatedAge}</span>
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Physical Description</span> 
                            <div className="autopsy-text-block">{record.physicalDescription}</div>
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Identifying Marks / Tattoos</span> 
                            <span>{record.tattoos}</span>
                        </div>
                    </div>

                    <div className="autopsy-data-section">
                        <h4>Discovery Details</h4>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Time of Death</span> 
                            <span>{record.timeOfDeath}</span>
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Location of Discovery</span> 
                            <span>{record.location}</span>
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Cause of Death</span> 
                            <span style={{ color: '#c0392b', fontWeight: 'bold' }}>{record.causeOfDeath}</span>
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">DNA Profile</span> 
                            <span className="font-monospace small">{record.dnaProfile}</span>
                        </div>
                    </div>

                    <div className="autopsy-data-section" style={{ gridColumn: 'span 2' }}>
                        <h4>Forensic Collection & Toxicology</h4>
                        <div className="ooc-disclaimer">
                            <i className="fas fa-info-circle me-1"></i>
                            <strong>Out of Character (OOC) Information:</strong> The data below (slugs, exact injuries, narcotics) is strictly OOC. Any use of this information In Character requires a formal autopsy request via the PHMC Forums. Slugs and Alcohol readings are purely for Medical Examiner's to perform autopsies, if you require the slugs IC'ly, contact a Medical Examiner.
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Alcohol / Narcotics Screen</span> 
                            <span style={{ color: record.bac !== '0.00%' || (record.narcotics && record.narcotics !== 'None') ? '#c0392b' : '#27ae60', fontWeight: 'bold' }}>
                                BAC: {record.bac} | Narcotics: {record.narcotics}
                            </span>
                        </div>
                        {record.bullets && record.bullets.length > 0 && (
                            <div className="autopsy-field">
                                <span className="autopsy-label">Evidence Collected (Bullets)</span> 
                                <div>
                                    {record.bullets.map((b, i) => (
                                        <div key={i} className="small">• {b.type} (Serial: #{b.id})</div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {record.findings && record.findings.length > 0 && (
                            <div className="autopsy-field mt-3">
                                <span className="autopsy-label">Autopsy Findings</span>
                                <div className="table-responsive">
                                    <table className="autopsy-findings-table">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Wound Type</th>
                                                <th>Body Part</th>
                                                <th>Dist.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {record.findings.map((f, i) => (
                                                <tr key={i}>
                                                    <td>{f.time}</td>
                                                    <td>{f.type}</td>
                                                    <td>{f.part}</td>
                                                    <td>{f.dist}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .autopsy-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.75);
                    z-index: 2000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    backdrop-filter: blur(4px);
                }

                .autopsy-modal-content {
                    background: #ffffff;
                    width: 850px;
                    max-height: 90vh;
                    border-radius: 12px;
                    padding: 40px;
                    overflow-y: auto;
                    position: relative;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    color: #333;
                }

                .autopsy-modal-close {
                    position: absolute;
                    top: 20px;
                    right: 25px;
                    font-size: 2rem;
                    cursor: pointer;
                    color: #95a5a6;
                    transition: color 0.2s;
                }

                .autopsy-modal-close:hover {
                    color: #2c3e50;
                }

                .autopsy-modal-title {
                    margin-top: 0;
                    color: #2c3e50;
                    font-weight: 700;
                    font-size: 1.8rem;
                }

                .autopsy-modal-subtitle {
                    color: #3498db;
                    font-weight: 800;
                    margin-top: -10px;
                    letter-spacing: 1px;
                }

                .autopsy-modal-hr {
                    border: 0;
                    border-top: 1px solid #eee;
                    margin: 20px 0;
                }

                .autopsy-data-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                }

                .autopsy-data-section {
                    background: #fdfdfd;
                    border: 1px solid #f0f0f0;
                    padding: 20px;
                    border-radius: 8px;
                }

                .autopsy-data-section h4 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #2c3e50;
                    border-bottom: 3px solid #3498db;
                    padding-bottom: 8px;
                    font-size: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .autopsy-field {
                    margin-bottom: 15px;
                    font-size: 0.95rem;
                }

                .autopsy-label {
                    font-weight: 800;
                    color: #7f8c8d;
                    display: block;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }

                .autopsy-text-block {
                    font-size: 0.85rem;
                    line-height: 1.5;
                    color: #444;
                    background: #f9f9f9;
                    padding: 10px;
                    border-radius: 4px;
                    border-left: 3px solid #ddd;
                }

                .autopsy-findings-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    margin-top: 10px;
                }

                .autopsy-findings-table th {
                    background: #f4f7f6;
                    text-align: left;
                    padding: 10px;
                    border-bottom: 2px solid #3498db;
                    color: #2c3e50;
                }

                .autopsy-findings-table td {
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }

                .autopsy-findings-table tr:hover {
                    background: #f9f9f9;
                }

                .autopsy-copy-btn {
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .autopsy-copy-btn:hover {
                    background: #2980b9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
                }

                .autopsy-copy-btn.copied {
                    background: #27ae60;
                }

                .autopsy-warning-banner {
                    background-color: #fff3cd;
                    border: 1px solid #ffeeba;
                    color: #856404;
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                }

                .autopsy-admin-note-section {
                    margin-top: 20px;
                    padding: 15px;
                    background: #f0f7fd;
                    border-left: 4px solid #3498db;
                    border-radius: 4px;
                }

                .autopsy-admin-note-section h4 {
                    margin-top: 0;
                    margin-bottom: 8px;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    color: #2c3e50;
                    font-weight: 800;
                    border: none;
                }

                .autopsy-admin-note-section p {
                    margin-bottom: 0;
                    font-size: 0.9rem;
                    color: #34495e;
                    font-style: italic;
                    line-height: 1.5;
                }

                .ooc-disclaimer {
                    background-color: #e8f4fd;
                    border: 1px solid #bee5eb;
                    border-left: 4px solid #17a2b8;
                    color: #0c5460;
                    padding: 10px 14px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                }
            `}</style>
        </div>
    );
};

export default AutopsyModal;
