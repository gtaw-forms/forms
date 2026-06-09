import React, { useState } from 'react';
import { generateMorgueBBCode } from '../../utils/morgue';

const AutopsyModal = ({ show, onClose, record, darkMode }) => {
    const [copied, setCopied] = useState(false);

    if (!show || !record) return null;

    const bulletsList = record.bullets
        ? (Array.isArray(record.bullets) ? record.bullets : [record.bullets])
        : [];

    const handleCopyBBCode = () => {
        const bbcode = generateMorgueBBCode(record);
        navigator.clipboard.writeText(bbcode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="autopsy-modal-overlay" data-theme={darkMode ? 'dark' : 'light'} onClick={onClose}>
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
                            <span style={{ color: 'var(--modal-danger)', fontWeight: 'bold' }}>{record.causeOfDeath}</span>
                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">DNA Profile</span> 
                            <span className="font-monospace small">{record.dnaProfile}</span>
                        </div>
                    </div>

                    <div className="autopsy-data-section" style={{ gridColumn: 'span 2' }}>
                        <h4>Forensic Collection & Toxicology</h4>

                        <div className="ooc-disclaimer-warning">
                            <i className="fas fa-exclamation-triangle me-1"></i>
                            <strong>OOC Information:</strong> The data below (slugs, exact injuries, narcotics) is strictly Out of Character. Any use of this information In Character requires a formal autopsy request.
                        </div>

                        <div className="ooc-disclaimer-note">
                            <i className="fas fa-flask me-1"></i>
                            <strong>Law Enforcement Note:</strong> Slugs and Alcohol readings are visual reference for Medical Examiners performing autopsies. If you require the slugs IC'ly on the PHMC Forums here -                             <a
                                href="https://phmc.gta.world/viewforum.php?f=265"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="autopsy-request-link"
                            >
                                Link To Autopsy
                            </a>

                        </div>
                        <div className="autopsy-field">
                            <span className="autopsy-label">Alcohol / Narcotics Screen</span> 
                            <span style={{ color: record.bac !== '0.00%' || (record.narcotics && record.narcotics !== 'None') ? 'var(--modal-danger)' : 'var(--modal-success)', fontWeight: 'bold' }}>
                                BAC: {record.bac} | Narcotics: {record.narcotics}
                            </span>
                        </div>
                        {bulletsList.length > 0 && (
                            <div className="autopsy-field">
                                <span className="autopsy-label">Evidence Collected (Bullets)</span> 
                                <div>
                                    {bulletsList.map((b, i) => (
                                        <div key={i} className="small">• {b.type}</div>
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
                .autopsy-modal-overlay[data-theme="dark"] {
                    --modal-content-bg: #2c2f33;
                    --modal-text: #dcddde;
                    --modal-text-secondary: #b9bbbe;
                    --modal-text-muted: #8e9297;
                    --modal-border: #40444b;
                    --modal-section-bg: #36393f;
                    --modal-section-border: #40444b;
                    --modal-label: #72767d;
                    --modal-text-block-bg: #40444b;
                    --modal-text-block-border: #555;
                    --modal-text-block-text: #b9bbbe;
                    --modal-hr: #40444b;
                    --modal-close: #72767d;
                    --modal-close-hover: #dcddde;
                    --modal-title: #dcddde;
                    --modal-subtitle: #5dade2;
                    --modal-section-title: #b9bbbe;
                    --modal-accent: #3498db;
                    --modal-table-header-bg: #23262a;
                    --modal-table-header-text: #b9bbbe;
                    --modal-table-header-border: #5dade2;
                    --modal-table-row-border: #40444b;
                    --modal-table-row-hover: #36393f;
                    --modal-shadow: 0 20px 50px rgba(0,0,0,0.7);
                    --modal-copy-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    --modal-copy-shadow-hover: 0 4px 8px rgba(0,0,0,0.4);
                    --modal-warning-bg: #332b00;
                    --modal-warning-border: #665500;
                    --modal-warning-text: #ffd966;
                    --modal-admin-note-bg: #1a2332;
                    --modal-admin-note-border: #3498db;
                    --modal-admin-note-title: #b9bbbe;
                    --modal-admin-note-text: #b9bbbe;
                    --modal-ooc-bg: #0d2137;
                    --modal-ooc-border: #1a4971;
                    --modal-ooc-text: #8ab4f8;
                    --modal-danger: #f14a4a;
                    --modal-success: #2ea043;
                    --modal-warning: #f0a832;
                }

                .autopsy-modal-overlay[data-theme="light"] {
                    --modal-content-bg: #ffffff;
                    --modal-text: #333;
                    --modal-text-secondary: #666;
                    --modal-text-muted: #95a5a6;
                    --modal-border: #f0f0f0;
                    --modal-section-bg: #fdfdfd;
                    --modal-section-border: #f0f0f0;
                    --modal-label: #7f8c8d;
                    --modal-text-block-bg: #f9f9f9;
                    --modal-text-block-border: #ddd;
                    --modal-text-block-text: #444;
                    --modal-hr: #eee;
                    --modal-close: #95a5a6;
                    --modal-close-hover: #2c3e50;
                    --modal-title: #2c3e50;
                    --modal-subtitle: #3498db;
                    --modal-section-title: #2c3e50;
                    --modal-accent: #3498db;
                    --modal-table-header-bg: #f4f7f6;
                    --modal-table-header-text: #2c3e50;
                    --modal-table-header-border: #3498db;
                    --modal-table-row-border: #eee;
                    --modal-table-row-hover: #f9f9f9;
                    --modal-shadow: 0 20px 50px rgba(0,0,0,0.5);
                    --modal-copy-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    --modal-copy-shadow-hover: 0 4px 8px rgba(0,0,0,0.15);
                    --modal-warning-bg: #fff3cd;
                    --modal-warning-border: #ffeeba;
                    --modal-warning-text: #856404;
                    --modal-admin-note-bg: #f0f7fd;
                    --modal-admin-note-border: #3498db;
                    --modal-admin-note-title: #2c3e50;
                    --modal-admin-note-text: #34495e;
                    --modal-ooc-bg: #e8f4fd;
                    --modal-ooc-border: #bee5eb;
                    --modal-ooc-text: #0c5460;
                    --modal-danger: #c0392b;
                    --modal-success: #27ae60;
                    --modal-warning: #e67e22;
                }

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
                    background: var(--modal-content-bg);
                    width: 850px;
                    max-height: 90vh;
                    border-radius: 12px;
                    padding: 40px;
                    overflow-y: auto;
                    position: relative;
                    box-shadow: var(--modal-shadow);
                    color: var(--modal-text);
                }

                .autopsy-modal-close {
                    position: absolute;
                    top: 20px;
                    right: 25px;
                    font-size: 2rem;
                    cursor: pointer;
                    color: var(--modal-close);
                    transition: color 0.2s;
                }

                .autopsy-modal-close:hover {
                    color: var(--modal-close-hover);
                }

                .autopsy-modal-title {
                    margin-top: 0;
                    color: var(--modal-title);
                    font-weight: 700;
                    font-size: 1.8rem;
                }

                .autopsy-modal-subtitle {
                    color: var(--modal-subtitle);
                    font-weight: 800;
                    margin-top: -10px;
                    letter-spacing: 1px;
                }

                .autopsy-modal-hr {
                    border: 0;
                    border-top: 1px solid var(--modal-hr);
                    margin: 20px 0;
                }

                .autopsy-data-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                }

                .autopsy-data-section {
                    background: var(--modal-section-bg);
                    border: 1px solid var(--modal-section-border);
                    padding: 20px;
                    border-radius: 8px;
                }

                .autopsy-data-section h4 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: var(--modal-section-title);
                    border-bottom: 3px solid var(--modal-accent);
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
                    color: var(--modal-label);
                    display: block;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    margin-bottom: 4px;
                }

                .autopsy-text-block {
                    font-size: 0.85rem;
                    line-height: 1.5;
                    color: var(--modal-text-block-text);
                    background: var(--modal-text-block-bg);
                    padding: 10px;
                    border-radius: 4px;
                    border-left: 3px solid var(--modal-text-block-border);
                }

                .autopsy-findings-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    margin-top: 10px;
                }

                .autopsy-findings-table th {
                    background: var(--modal-table-header-bg);
                    text-align: left;
                    padding: 10px;
                    border-bottom: 2px solid var(--modal-table-header-border);
                    color: var(--modal-table-header-text);
                }

                .autopsy-findings-table td {
                    padding: 10px;
                    border-bottom: 1px solid var(--modal-table-row-border);
                }

                .autopsy-findings-table tr:hover {
                    background: var(--modal-table-row-hover);
                }

                .autopsy-copy-btn {
                    background: var(--modal-accent);
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
                    box-shadow: var(--modal-copy-shadow);
                }

                .autopsy-copy-btn:hover {
                    background: #2980b9;
                    transform: translateY(-1px);
                    box-shadow: var(--modal-copy-shadow-hover);
                }

                .autopsy-copy-btn.copied {
                    background: var(--modal-success);
                }

                .autopsy-warning-banner {
                    background-color: var(--modal-warning-bg);
                    border: 1px solid var(--modal-warning-border);
                    color: var(--modal-warning-text);
                    padding: 12px 16px;
                    border-radius: 8px;
                    margin-top: 20px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                }

                .autopsy-admin-note-section {
                    margin-top: 20px;
                    padding: 15px;
                    background: var(--modal-admin-note-bg);
                    border-left: 4px solid var(--modal-admin-note-border);
                    border-radius: 4px;
                }

                .autopsy-admin-note-section h4 {
                    margin-top: 0;
                    margin-bottom: 8px;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    color: var(--modal-admin-note-title);
                    font-weight: 800;
                    border: none;
                }

                .autopsy-admin-note-section p {
                    margin-bottom: 0;
                    font-size: 0.9rem;
                    color: var(--modal-admin-note-text);
                    font-style: italic;
                    line-height: 1.5;
                }

                .ooc-disclaimer-warning,
                .ooc-disclaimer-note {
                    padding: 10px 14px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                }

                .ooc-disclaimer-warning {
                    background-color: var(--modal-warning-bg);
                    border: 1px solid var(--modal-warning-border);
                    border-left: 4px solid var(--modal-warning);
                    color: var(--modal-warning-text);
                }

                .ooc-disclaimer-note {
                    background-color: var(--modal-ooc-bg);
                    border: 1px solid var(--modal-ooc-border);
                    border-left: 4px solid #17a2b8;
                    color: var(--modal-ooc-text);
                }

                .autopsy-request-link {
                    color: var(--modal-accent);
                    font-weight: 700;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .autopsy-request-link:hover {
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
};

export default AutopsyModal;
