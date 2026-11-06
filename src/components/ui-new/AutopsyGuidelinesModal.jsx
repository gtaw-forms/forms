import React from 'react';

// Shared "Autopsy Guidelines" dialog — opened from both the single Request
// Autopsy modal and the batch (mass) request modal. Content is the f=265
// guidelines the request template links to (t=9572).
const AutopsyGuidelinesModal = ({ show, onClose }) => {
    if (!show) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(6,10,18,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
            <div style={{ maxWidth: 720, width: '100%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}><i className="fas fa-book-open" style={{ marginRight: 6, color: 'var(--teal)' }} />Autopsy Guidelines</div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">&times;</button>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '0 0 14px' }}>Department of Forensic Medicine &amp; Pathology — PHMC</p>

                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', marginBottom: 4 }}>0.0 Information — Body Retention Policy</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                        <li><strong>Retention Period:</strong> The Department of Forensic Medicine and Pathology holds bodies for a maximum of thirty-one (31) days.</li>
                        <li><strong>Unclaimed Bodies:</strong> After this 31-day period has elapsed, bodies are automatically released to the State of San Andreas for final disposition via burial or cremation.</li>
                    </ul>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', marginBottom: 4 }}>1. Authorised Requesters</div>
                    <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>An autopsy will only be initiated if requested by an entity with recognised legal standing. Valid requests must originate from one of the following:</div>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                        <li><strong>Authorised Law Enforcement Officials:</strong> Detectives, investigators, or ranking officers managing an active criminal investigation, suspicious death, or custody incident.</li>
                        <li><strong>Court Orders:</strong> A legally binding mandate issued by a judge or judicial authority compelling a post-mortem examination.</li>
                        <li><strong>Next of Kin:</strong> The immediate legal family or designated representative of the decedent seeking an examination.</li>
                    </ul>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', marginBottom: 4 }}>2. Filing Rules &amp; Restrictions</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                        <li><strong>Filing Window:</strong> Requests must be submitted within 31 days of the decedent&apos;s death. After 31 days, requests are automatically discarded unless exigent circumstances apply.</li>
                        <li><strong>Thread Title Format:</strong> Title your thread exactly as: <code style={{ fontFamily: 'var(--mono)', color: 'var(--teal)', fontSize: 11 }}>Autopsy Request - Name ((OOC Name)) [AGENCY]</code>.</li>
                        <li><strong>Player Kills (PK):</strong> Use John/Jane Doe with the character name in OOC brackets.</li>
                        <li><strong>ME Consultation:</strong> For PK and CK autopsies, you may contact and consult a member of the Medical Examiners prior to posting. They are only accepted if strictly necessary for an important investigation. <em>(This is entirely optional)</em></li>
                        <li><strong>Confidentiality:</strong> If your investigation is confidential, do not post a public thread. You may send the filled-out template directly to the Medical Examiners via private message.</li>
                        <li><strong>Turnaround Time:</strong> We are currently prioritising CK reports to be completed within 2-3 days, PK requests may incur additional delay of 3 to 5 days. If an autopsy is urgent, you must notify the Department in advance.</li>
                    </ul>
                    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.08)', borderLeft: '3px solid #3b82f6', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <i className="fas fa-user-secret me-1" style={{ color: '#3b82f6' }} />
                        <strong>OOC:</strong> Autopsies can consume a lot of our time and resources — we have a very small team of approximately 5 Medical Examiners with a real-life workload, along with other duties. We aim to complete autopsies as soon as we can, but there may be unexpected delays.
                    </div>
                    <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.08)', borderLeft: '3px solid #3b82f6', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <i className="fas fa-file-medical me-1" style={{ color: '#3b82f6' }} />
                        <strong>OOC:</strong> Law Enforcement can use the PHMC Morgue Intake Records to get a copy of our Morgue Records, in lieu of PK Autopsies.
                    </div>
                </div>

                <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', marginBottom: 4 }}>3. Script Evidence &amp; Mechanics</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                        <li><strong>/cexamine &amp; /cinjuries:</strong> These fields are mandatory for Character Kills (CK). They are optional for Player Kills (PK), though still highly recommended if you have them on hand.</li>
                        <li><strong>RP Screenshots:</strong> Legitimate faction RP screenshots showcasing specific physical trauma (e.g., an approved neck stabbing) can be provided in lieu of literal script damages.</li>
                        <li><strong>Ballistics Limitations:</strong> The Medical Examiner team can only provide striation IDs belonging to casings. Full ballistics mapping linking guns to casings must be handled internally by your respective department&apos;s Forensics team.</li>
                    </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button onClick={onClose} style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 6, padding: '8px 16px', fontSize: 12.5, cursor: 'pointer' }}>Got it</button>
                </div>
            </div>
        </div>
    );
};

export default AutopsyGuidelinesModal;
