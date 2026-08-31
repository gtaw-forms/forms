import React, { useState, useEffect } from 'react';
import { ref, push } from 'firebase/database';
import { database } from '../../firebase';

const MONTHS = { january: 'JAN', february: 'FEB', march: 'MAR', april: 'APR', may: 'MAY', june: 'JUN', july: 'JUL', august: 'AUG', september: 'SEP', october: 'OCT', november: 'NOV', december: 'DEC' };

// Parse a morgue record's timeOfDeath ("Monday, 24 August 2026 09:39:11")
// into the request format's Date of Death + Time of Death.
const parseTimeOfDeath = (raw) => {
    const m = String(raw || '').match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!m) return { dateOfDeath: '', timeOfDeath: '' };
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return { dateOfDeath: '', timeOfDeath: '' };
    const dateOfDeath = `${String(m[1]).padStart(2, '0')}/${mon}/${m[3]}`;
    let h = parseInt(m[4], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeOfDeath = `${String(h).padStart(2, '0')}:${m[5]} ${ampm}`;
    return { dateOfDeath, timeOfDeath };
};

const inputStyle = {
    width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 6, padding: '8px 10px', fontSize: 12.5,
    boxSizing: 'border-box', marginTop: 4,
};
const labelStyle = { fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, display: 'block' };

const RequestAutopsyModal = ({ show, onClose, record, showNotification, characterName }) => {
    const [deathType, setDeathType] = useState('PK');
    const [requesterName, setRequesterName] = useState('');
    const [requesterRank, setRequesterRank] = useState('');
    const [requesterDept, setRequesterDept] = useState('');
    const [requesterBadge, setRequesterBadge] = useState('');
    const [guidelinesRead, setGuidelinesRead] = useState(false);
    const [requesterCell, setRequesterCell] = useState('');
    const [requesterDiscord, setRequesterDiscord] = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [causeDetail, setCauseDetail] = useState('');
    const [cexamineImg, setCexamineImg] = useState('');
    const [cinjuriesImg, setCinjuriesImg] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showGuidelines, setShowGuidelines] = useState(false);
    const [showDecedent, setShowDecedent] = useState(false);
    const [agencyForum, setAgencyForum] = useState('');
    const [forumAccountUrl, setForumAccountUrl] = useState('');

    const oocMatch = String(record?.name || '').match(/\(\(\s*([^)]*?)\s*\)\)/);
    const decedentName = String(record?.name || '').replace(/\(\([^)]*\)\)/g, '').trim() || 'Unknown';
    const oocName = oocMatch ? oocMatch[1].trim() : '';
    const { dateOfDeath, timeOfDeath } = parseTimeOfDeath(record?.timeOfDeath);

    useEffect(() => {
        if (show) {
            setDeathType('PK');
            setRequesterName('');
            setRequesterRank('');
            setRequesterDept('');
            setRequesterBadge('');
            setGuidelinesRead(false);
            setRequesterCell('');
            setRequesterDiscord('');
            setSynopsis('');
            setCauseDetail('');
            setCexamineImg('');
            setCinjuriesImg('');
            setSubmitting(false);
            setShowDecedent(false);
            setAgencyForum('');
            setForumAccountUrl('');
        }
    }, [show]);

    if (!show) return null;

    // AGENCY tag for the topic title — prefer the explicit agency selection, then
    // derive from Department / Assignment (e.g. "LSPD - Homicide" → LSPD).
    const agencyTag = agencyForum || (requesterDept.match(/^([A-Z]{3,5})/) || [])[1] || 'PHMC';

    const topicTitle = `[Autopsy Request] ${decedentName} ((${oocName || 'Unknown OOC'})) [${agencyTag}]`;

    const buildRequestBBCode = () => {
        const ans = (v) => String(v || '').trim() || 'ANSWER';
        return `[divbox=grey][center][img]https://i.imgur.com/s5acD6S.png[/img][/center][/divbox]
[divbox=white]
[br][/br]
[center][b][size=170]AUTOPSY REQUEST[/size][/b][/center]
[center][size=65]LOS SANTOS DEPARTMENT OF MEDICAL EXAMINER-CORONER[/size][/center]
[color=transparent]SPACER[/color]
[hr][/hr]
[center]Provide [b]full[/b] or [b]partial[/b] search input using the following fields:
[/center]
[hr][/hr]
[divbox=lightgrey][color=#800000][b]SECTION 1: REQUESTER'S INFORMATION[/b][/color][/divbox]
[divbox=white][b]1.) Name:[/b] ${ans(requesterName)}
[b]2.) Rank:[/b] ${ans(requesterRank)}
[b]3.) Department / Assignment:[/b] ${ans(requesterDept)}
[b]4.) Badge/Serial Number:[/b] ${ans(requesterBadge)}
[b] 5.) Read and understood [url=https://phmc.gta.world/viewtopic.php?t=9572]Autopsy Guidelines[/url][/b]: ${guidelinesRead ? 'YES' : 'NO'}
[b]6.) Contact Information:[/b]: 
[list][*]Cell Number: ${ans(requesterCell)}
[*](( Discord Name: ${ans(requesterDiscord)} ))[/list]

[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b]SECTION 2: DECEDENT'S INFORMATION[/b][/color][/divbox]
[divbox=white][size=85](If you are requesting for multiple bodies, you can number them instead of separate topics. EX: John Doe (1), John Doe (2)) - You must include the OOC names here in brackets next to the name, EX: John Doe ((Mark Smith)) [/size]
[b]1.) Decedent Name:[/b] ${decedentName} ((${oocName || 'Unknown OOC'}))
[b]2.) Gender:[/b] ${ans(record?.sex || '')}
[b]3.) Ethnicity:[/b] ${ans(record?.ethnicity || '')}
[b]4.) Date of Death:[/b] ${ans(dateOfDeath)}
[b]5.) Time of Death:[/b] ${ans(timeOfDeath)}
[b]6.) Location:[/b] ${ans(record?.location || '')}
[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b]SECTION 3: DETAILS[/b][/color][/divbox]
[divbox=white][size=85](Summarize what you observed at the crime scene, include everything related to death and victim; casings, weapons etc.)[/size]
[b]1.) Synopsis:[/b] ${ans(synopsis)}
[b]2.) Reason for Autopsy:[/b] ${ans(causeDetail)}

[b]4.) 
[b]
[/divbox]
[br][/br][divbox=lightgrey][color=#800000][b][ooc]SECTION 4: OOC INFORMATION[/ooc][/b][/color][/divbox]
[divbox=white][size=85](/cexamine and /cinjuries are no longer mandatory fields for PKs, post them if you happen to have them on hand. CKs have a mandatory cexamine and cinjuries)[/size]
[b]1.) PK/CK[/b]: ${deathType}
[b]2.) /cexamine[/b]: ${cexamineImg ? `[img]${cexamineImg}[/img]` : 'ANSWER'}
[b]3.) /cinjuries[/b]: ${cinjuriesImg ? `[img]${cinjuriesImg}[/img]` : 'ANSWER'}
[/divbox][/divbox]`;
    };

    const requestBBCode = buildRequestBBCode();

    const handleSubmit = async () => {
        if (!requesterName.trim()) {
            showNotification('Enter the requester name.', 'warning');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                caseId: record?.caseId || '',
                decedentName,
                oocName,
                gender: record?.sex || '',
                ethnicity: record?.ethnicity || '',
                dateOfDeath,
                timeOfDeath,
                placeOfDeath: record?.location || '',
                requesterName: requesterName.trim(),
                requesterRank: requesterRank.trim(),
                requesterDept: requesterDept.trim(),
                requesterBadge: requesterBadge.trim(),
                guidelinesRead,
                requesterCell: requesterCell.trim(),
                requesterDiscord: requesterDiscord.trim(),
                agencyForum,
                forumAccountUrl: forumAccountUrl.trim(),
                deathType,
                synopsis: synopsis.trim(),
                causeDetail: causeDetail.trim(),
                cexamineImg: cexamineImg.trim(),
                cinjuriesImg: cinjuriesImg.trim(),
                source: 'web-morgue',
                status: 'pending',
                createdAt: Date.now(),
                createdBy: characterName || null,
                // Ready-to-post forum payload (f=265), matching parseAutopsyRequestBbcode:
                topicTitle,
                requestBBCode,
            };
            await push(ref(database, 'autopsy-requests/pending'), payload);
            showNotification(`Autopsy request submitted for ${decedentName} — pending ME review.`, 'check-circle');
            onClose();
        } catch (err) {
            console.error('[RequestAutopsy] Submit error:', err);
            showNotification('Failed to submit autopsy request: ' + (err?.message || err), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const section = (title, extra) => (
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 10, marginTop: 6 }}>
            {title} {extra || null}
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(6,10,18,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
            <div style={{ maxWidth: 920, width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                    <i className="fas fa-microscope" style={{ marginRight: 6, color: 'var(--teal)' }} />Request Autopsy
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '0 0 14px' }}>
                    Case #{record?.caseId || '—'} — mirrors the f=265 Autopsy Request form. Submitted to the ME team for review.
                </p>

                <div onClick={() => setShowDecedent(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: 'var(--teal)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 10, marginTop: 6, userSelect: 'none' }}>
                    <i className={`fas fa-chevron-${showDecedent ? 'down' : 'right'}`} style={{ fontSize: 9 }} />
                    DECEDENT <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>(prefilled from intake)</span>
                </div>
                {showDecedent ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                        <div><span style={labelStyle}>Decedent Name ((OOC))</span><input style={inputStyle} value={`${decedentName} ((${oocName || 'Unknown OOC'}))`} disabled /></div>
                        <div><span style={labelStyle}>Case ID</span><input style={inputStyle} value={`#${record?.caseId || '—'}`} disabled /></div>
                        <div><span style={labelStyle}>Gender</span><input style={inputStyle} value={record?.sex || '—'} disabled /></div>
                        <div><span style={labelStyle}>Ethnicity</span><input style={inputStyle} value={record?.ethnicity || '—'} disabled /></div>
                        <div><span style={labelStyle}>Date of Death</span><input style={inputStyle} value={dateOfDeath || '—'} disabled /></div>
                        <div><span style={labelStyle}>Time of Death</span><input style={inputStyle} value={timeOfDeath || '—'} disabled /></div>
                        <div style={{ gridColumn: 'span 2' }}><span style={labelStyle}>Location of Discovery</span><input style={inputStyle} value={record?.location || '—'} disabled /></div>
                    </div>
                ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'var(--mono)', cursor: 'pointer', userSelect: 'none' }} onClick={() => setShowDecedent(true)}>
                        <i className="fas fa-user me-1" style={{ color: 'var(--teal)' }} />#{record?.caseId || '—'} · {decedentName} (({oocName || 'Unknown OOC'})) — <span style={{ color: 'var(--text-faint)' }}>click to expand</span>
                    </div>
                )}
                {section('DEATH CLASSIFICATION')}
                <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
                    {['PK', 'CK'].map(t => (
                        <label key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', margin: 0 }}>
                            <input type="radio" name="deathType" checked={deathType === t} onChange={() => setDeathType(t)} style={{ width: 15, height: 15, margin: 0 }} />
                            <span style={{ fontWeight: 700, color: t === 'CK' ? 'var(--danger)' : 'var(--teal)' }}>{t}</span>
                        </label>
                    ))}
                    <span style={{ fontSize: 10.5, color: 'var(--text-faint)', alignSelf: 'center' }}>CKs require /cexamine + /cinjuries below.</span>
                </div>

                {section('SECTION 1 — REQUESTER')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div><span style={labelStyle}>1.) Name *</span><input style={inputStyle} value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="e.g. Officer J. Baker" /></div>
                    <div><span style={labelStyle}>2.) Rank</span><input style={inputStyle} value={requesterRank} onChange={e => setRequesterRank(e.target.value)} placeholder="e.g. Officer I" /></div>
                    <div><span style={labelStyle}>3.) Department / Assignment</span><input style={inputStyle} value={requesterDept} onChange={e => setRequesterDept(e.target.value)} placeholder="e.g. LSPD - Homicide" /></div>
                    <div><span style={labelStyle}>Agency Forum Account (deliver to)</span>
                        <select style={inputStyle} value={agencyForum} onChange={e => setAgencyForum(e.target.value)}>
                            <option value="">Select agency forum…</option>
                            {['LSPD', 'LSSD', 'SADCR', 'DAO', 'PHMC'].map(a => <option key={a} value={a}>{a} Forum</option>)}
                        </select>
                    </div>
                    <div><span style={labelStyle}>Forum Account URL</span>
                        <input style={inputStyle} value={forumAccountUrl} onChange={e => setForumAccountUrl(e.target.value)} placeholder="https://lspd.gta.world/… member profile" />
                    </div>
                    <div><span style={labelStyle}>4.) Badge/Serial Number</span><input style={inputStyle} value={requesterBadge} onChange={e => setRequesterBadge(e.target.value)} placeholder="Serial #" /></div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'var(--text)', margin: 0 }}>
                            <input type="checkbox" checked={guidelinesRead} onChange={e => setGuidelinesRead(e.target.checked)} style={{ width: 15, height: 15, margin: 0 }} />
                            5.) I have read and understood the
                        </label>
                        <button type="button" onClick={() => setShowGuidelines(true)} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, textDecoration: 'underline' }}>
                            Autopsy Guidelines
                        </button>
                    </div>
                    <div><span style={labelStyle}>6a.) Cell Number</span><input style={inputStyle} value={requesterCell} onChange={e => setRequesterCell(e.target.value)} placeholder="555-0123" /></div>
                    <div><span style={labelStyle}>6b.) (( Discord Name ))</span><input style={inputStyle} value={requesterDiscord} onChange={e => setRequesterDiscord(e.target.value)} placeholder="(( Discord username ))" /></div>
                </div>

                {section('SECTION 3 — DETAILS')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div><span style={labelStyle}>1.) Synopsis</span><textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={synopsis} onChange={e => setSynopsis(e.target.value)} placeholder="Observed scene: casings, weapons, victim state…" /></div>
                    <div><span style={labelStyle}>2.) Reason for Autopsy</span><textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} value={causeDetail} onChange={e => setCauseDetail(e.target.value)} placeholder="Why an autopsy is required (suspicious death, court case…)" /></div>
                </div>

                {section('SECTION 4 — OOC (CKs mandatory)')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div><span style={labelStyle}>2.) /cexamine image URL</span><input style={inputStyle} value={cexamineImg} onChange={e => setCexamineImg(e.target.value)} placeholder="https://… /cexamine screenshot" /></div>
                    <div><span style={labelStyle}>3.) /cinjuries image URL</span><input style={inputStyle} value={cinjuriesImg} onChange={e => setCinjuriesImg(e.target.value)} placeholder="https://… /cinjuries screenshot" /></div>
                </div>

                {/* Live forum preview */}
                <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Forum topic preview:</div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--teal)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{topicTitle}</div>
                        <details>
                            <summary style={{ fontSize: 10.5, color: 'var(--text-faint)', cursor: 'pointer', marginTop: 4 }}>Show generated BBCode</summary>
                            <pre style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflowY: 'auto', margin: '6px 0 0', fontFamily: 'var(--mono)' }}>{requestBBCode}</pre>
                        </details>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={submitting} style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 6, padding: '8px 16px', fontSize: 12.5, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                        {submitting ? <><i className="fas fa-spinner fa-spin me-1" />Submitting…</> : <><i className="fas fa-paper-plane me-1" />Submit Request</>}
                    </button>
                </div>
            </div>

            {/* Nested — Autopsy Guidelines modal */}
            {showGuidelines && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(6,10,18,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowGuidelines(false)}>
                    <div style={{ maxWidth: 720, width: '100%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}><i className="fas fa-book-open" style={{ marginRight: 6, color: 'var(--teal)' }} />Autopsy Guidelines</div>
                            <button onClick={() => setShowGuidelines(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">&times;</button>
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
                                <li><strong>Thread Title Format:</strong> Title your thread exactly as: <code style={{ fontFamily: 'var(--mono)', color: 'var(--teal)', fontSize: 11 }}>[Autopsy Request] Name ((OOC Name)) [AGENCY]</code>.</li>
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
                            <button onClick={() => setShowGuidelines(false)} style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 6, padding: '8px 16px', fontSize: 12.5, cursor: 'pointer' }}>Got it</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestAutopsyModal;