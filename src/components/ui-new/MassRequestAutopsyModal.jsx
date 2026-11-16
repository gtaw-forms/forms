import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, push } from 'firebase/database';
import { database } from '../../firebase';
import {
    MAX_MASS_BODIES,
    buildMassAutopsyTopicTitle,
    buildMassAutopsyRequestPayload,
    deriveAgencyTag,
    isLspdRequester,
    isLspdMassBlocked,
    LSPD_MASS_BLOCK_MESSAGE,
    validateMassRequest,
    toMassRequestBodies,
} from '../../utils/autopsyRequest';
import AutopsyGuidelinesModal from './AutopsyGuidelinesModal';

const inputStyle = {
    width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 6, padding: '8px 10px', fontSize: 12.5,
    boxSizing: 'border-box', marginTop: 4,
};
const labelStyle = { fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, display: 'block' };

const reqStar = <span style={{ color: '#ff6b6b' }} title="Required">*</span>;
const optionalTag = <span style={{ fontWeight: 400, color: 'var(--text-faint)' }}> (optional)</span>;
const infoBubble = (hint) => (
    <span title={hint} style={{ display: 'inline-block', marginLeft: 5, width: 14, height: 14, lineHeight: '13px', textAlign: 'center', borderRadius: '50%', border: '1px solid var(--text-faint)', color: 'var(--text-faint)', fontSize: 9, fontWeight: 700, cursor: 'help', verticalAlign: '1px' }}>i</span>
);

const section = (title, extra) => (
    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--teal)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 10, marginTop: 14 }}>
        {title} {extra || null}
    </div>
);

const cleanRank = (rank) => String(rank || '').replace(/-/g, ' ').trim();

// ── One body row ──────────────────────────────────────────────────────────
// Collapsed by default: the morgue intake already carries most fields, so the
// common path is review + set PK/CK. Expanding exposes the raw fields for a
// body whose record was thin or wrong.
const BodyCard = ({ body, index, canRemove, onChange, onRemove }) => {
    const [open, setOpen] = useState(false);
    const summaryName = `${body.decedentName || 'Unnamed'}${body.oocName ? ` ((${body.oocName}))` : ''}`;
    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: 'var(--teal)', background: 'var(--teal-dim)', border: '1px solid var(--border-accent)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.5px' }}>
                    BODY {index + 1}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{body.caseId || '—'}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1, minWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {summaryName}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                    {['PK', 'CK'].map((t) => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => onChange({ deathType: t })}
                            title={`Mark this body as ${t}`}
                            style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 800, fontFamily: 'var(--mono)',
                                borderRadius: 5, cursor: 'pointer',
                                border: `1px solid ${body.deathType === t ? (t === 'CK' ? 'var(--danger)' : 'var(--teal)') : 'var(--border)'}`,
                                background: body.deathType === t ? (t === 'CK' ? 'rgba(220,38,38,0.12)' : 'var(--teal-dim)') : 'transparent',
                                color: body.deathType === t ? (t === 'CK' ? 'var(--danger)' : 'var(--teal)') : 'var(--text-faint)',
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--teal)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}
                >
                    <i className={`fas fa-chevron-${open ? 'up' : 'down'} me-1`} />{open ? 'Hide' : 'Edit'}
                </button>
                {canRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        title="Remove this body from the batch"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer', padding: '2px 4px' }}
                        aria-label={`Remove body ${index + 1}`}
                    >
                        <i className="fas fa-xmark" />
                    </button>
                )}
            </div>
            {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><span style={labelStyle}>Decedent Name {reqStar}</span><input style={inputStyle} value={body.decedentName} onChange={e => onChange({ decedentName: e.target.value })} /></div>
                    <div><span style={labelStyle}>(( OOC Name ))</span><input style={inputStyle} value={body.oocName} onChange={e => onChange({ oocName: e.target.value })} placeholder="Required for John/Jane Doe" /></div>
                    <div><span style={labelStyle}>Gender</span><input style={inputStyle} value={body.gender} onChange={e => onChange({ gender: e.target.value })} /></div>
                    <div><span style={labelStyle}>Ethnicity</span><input style={inputStyle} value={body.ethnicity} onChange={e => onChange({ ethnicity: e.target.value })} /></div>
                    <div><span style={labelStyle}>Date of Death</span><input style={inputStyle} value={body.dateOfDeath} onChange={e => onChange({ dateOfDeath: e.target.value })} placeholder="DD/MMM/YYYY" /></div>
                    <div><span style={labelStyle}>Time of Death</span><input style={inputStyle} value={body.timeOfDeath} onChange={e => onChange({ timeOfDeath: e.target.value })} placeholder="HH:MM AM/PM" /></div>
                    <div style={{ gridColumn: 'span 2' }}><span style={labelStyle}>Location of Discovery</span><input style={inputStyle} value={body.location} onChange={e => onChange({ location: e.target.value })} /></div>
                    <div style={{ gridColumn: 'span 2', fontSize: 10.5, color: 'var(--text-faint)' }}>
                        Blank fields are filed blank so the ME team sees them flagged as incomplete instead of a D.N.A placeholder.
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Batch (mass) request modal ────────────────────────────────────────────
// One f=265 post in the bot's "[Mass Autopsy Request]" format: ONE case number,
// ONE f=266 thread, one ME assignment per body (discord-bot/services/
// autopsyRequestMonitor.js -> processMassRequest).
const MassRequestAutopsyModal = ({ show, onClose, records = [], showNotification, characterName, user, onSubmitted }) => {
    const [bodies, setBodies] = useState([]);
    const [incidentLabel, setIncidentLabel] = useState('');
    const [requesterName, setRequesterName] = useState('');
    const [requesterRank, setRequesterRank] = useState('');
    const [requesterDept, setRequesterDept] = useState('');
    const [requesterBadge, setRequesterBadge] = useState('');
    const [agencyForum, setAgencyForum] = useState('');
    const [forumAccountUrl, setForumAccountUrl] = useState('');
    const [guidelinesRead, setGuidelinesRead] = useState(false);
    const [requesterCell, setRequesterCell] = useState('');
    const [requesterDiscord, setRequesterDiscord] = useState('');
    const [synopsis, setSynopsis] = useState('');
    const [causeDetail, setCauseDetail] = useState('');
    const [cexamineImg, setCexamineImg] = useState('');
    const [cinjuriesImg, setCinjuriesImg] = useState('');
    const [showGuidelines, setShowGuidelines] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const seededRef = useRef(false);

    // Seed once per open. Records/props can change while editing (selection
    // updates in the list behind the modal) — never clobber user input.
    useEffect(() => {
        if (!show) { seededRef.current = false; return; }
        if (seededRef.current) return;
        seededRef.current = true;
        setBodies(toMassRequestBodies(records));
        setIncidentLabel('');
        setRequesterName(characterName || '');
        setRequesterRank(cleanRank(user?.faction?.rank));
        setRequesterDept('');
        setRequesterBadge('');
        setAgencyForum('');
        setForumAccountUrl('');
        setGuidelinesRead(false);
        setRequesterCell('');
        setRequesterDiscord('');
        setSynopsis('');
        setCauseDetail('');
        setCexamineImg('');
        setCinjuriesImg('');
        setSubmitting(false);
        setShowGuidelines(false);
    }, [show, records, characterName, user]);

    const requester = useMemo(() => ({
        name: requesterName,
        rank: requesterRank,
        dept: requesterDept,
        badge: requesterBadge,
        agencyForum,
        forumAccountUrl,
        guidelinesRead,
        cell: requesterCell,
        discord: requesterDiscord,
    }), [requesterName, requesterRank, requesterDept, requesterBadge, agencyForum, forumAccountUrl, guidelinesRead, requesterCell, requesterDiscord]);

    const details = useMemo(() => ({ synopsis, causeDetail, cexamineImg, cinjuriesImg }), [synopsis, causeDetail, cexamineImg, cinjuriesImg]);

    const agencyTag = deriveAgencyTag({ agencyForum, requesterDept });
    // LSPD runs its own portal and has no forum profiles: the Forum Account
    // URL is neither required (see validateMassRequest) nor shown here.
    const isLspd = isLspdRequester({ agencyForum, requesterDept });
    // Batch requests cannot be filed through LSPD's DRDB portal (one ME form per
    // decedent/report), so an LSPD batch is refused with a clear message rather
    // than leaving the completed reports with nowhere to go.
    const lspdBlocked = isLspdMassBlocked({ agencyForum, requesterDept });
    const topicTitle = buildMassAutopsyTopicTitle({ incidentLabel, agency: agencyTag });
    const missing = useMemo(() => validateMassRequest({ incidentLabel, requester, bodies }), [incidentLabel, requester, bodies]);
    const preview = useMemo(
        () => buildMassAutopsyRequestPayload({ requester, details, bodies, incidentLabel, characterName }),
        [requester, details, bodies, incidentLabel, characterName],
    );

    if (!show) return null;

    const updateBody = (index, patch) => {
        setBodies(list => list.map((b, i) => (i === index ? { ...b, ...patch } : b)));
    };
    const removeBody = (index) => {
        setBodies(list => list.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (lspdBlocked) {
            showNotification?.(LSPD_MASS_BLOCK_MESSAGE, 'error');
            return;
        }
        if (missing.length) {
            showNotification?.(`Complete required fields: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`, 'warning');
            return;
        }
        setSubmitting(true);
        try {
            const payload = buildMassAutopsyRequestPayload({
                requester, details, bodies, incidentLabel, characterName,
            });
            await push(ref(database, 'autopsy-requests/pending'), payload);
            showNotification?.(`Batch autopsy request submitted — ${bodies.length} bodies (${incidentLabel.trim()}) pending ME review.`, 'check-circle');
            onSubmitted?.(bodies);
            onClose();
        } catch (err) {
            console.error('[MassRequestAutopsy] Submit error:', err);
            showNotification?.('Failed to submit batch autopsy request: ' + (err?.message || err), 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const seedWarning = records.length > MAX_MASS_BODIES
        ? `Only the first ${MAX_MASS_BODIES} selected records were added (batch limit). Deselect some and submit again for the rest.`
        : '';

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(6,10,18,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
            <div style={{ maxWidth: 1040, width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 12, padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                        <i className="fas fa-layer-group" style={{ marginRight: 6, color: 'var(--teal)' }} />Request Multiple Autopsies
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--teal)', background: 'var(--teal-dim)', border: '1px solid var(--border-accent)', borderRadius: 20, padding: '2px 9px' }}>
                        {bodies.length} {bodies.length === 1 ? 'BODY' : 'BODIES'}
                    </div>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: '4px 0 2px' }}>
                    Files <strong>one</strong> f=265 request and <strong>one</strong> case thread. Each body gets its own ME assignment, wait window and completion — the bot groups them under a single case number.
                </p>
                {seedWarning && (
                    <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 6, background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 11.5 }}>
                        <i className="fas fa-triangle-exclamation me-1" />{seedWarning}
                    </div>
                )}
                {lspdBlocked && (
                    <div style={{ marginTop: 8, padding: '9px 11px', borderRadius: 6, background: 'rgba(220,38,38,0.10)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                        <i className="fas fa-circle-exclamation me-1" />
                        {LSPD_MASS_BLOCK_MESSAGE}
                        <div style={{ fontWeight: 400, fontSize: 11, marginTop: 4, color: 'var(--text-faint)' }}>
                            DRDB accepts one medical-examiner filing per decedent. Request these bodies individually — each one is filed to LSPD separately.
                        </div>
                    </div>
                )}

                {section('INCIDENT')}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, marginBottom: 4 }}>
                    <div>
                        <span style={labelStyle}>Incident / operation name {reqStar}{infoBubble('Shown in the request title and the f=266 case title — e.g. "Davis Shooting" or "HUA3 Brawl".')}</span>
                        <input style={inputStyle} value={incidentLabel} onChange={e => setIncidentLabel(e.target.value)} placeholder="e.g. Davis Shooting" />
                    </div>
                    <div>
                        <span style={labelStyle}>Agency forum {infoBubble('Routes the completed reports and crossposts. Also used as the title tag.')}</span>
                        <select style={inputStyle} value={agencyForum} onChange={e => setAgencyForum(e.target.value)}>
                            <option value="">Auto from department…</option>
                            {['LSPD', 'LSSD', 'SADCR', 'DAO', 'PHMC'].map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)', marginTop: 6, wordBreak: 'break-all' }}>{topicTitle}</div>

                {section('REQUESTER', <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontSize: 10.5 }}>(shared by every body)</span>)}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 6 }}>
                    <div><span style={labelStyle}>Name {reqStar}</span><input style={inputStyle} value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="e.g. Officer J. Baker" /></div>
                    <div><span style={labelStyle}>Rank {reqStar}</span><input style={inputStyle} value={requesterRank} onChange={e => setRequesterRank(e.target.value)} placeholder="e.g. Officer I" /></div>
                    <div><span style={labelStyle}>Department / Assignment {reqStar}{infoBubble('Detects the agency and routes the request.')}</span><input style={inputStyle} value={requesterDept} onChange={e => setRequesterDept(e.target.value)} placeholder="e.g. LSPD - Homicide" /></div>
                    <div><span style={labelStyle}>Badge/Serial Number</span><input style={inputStyle} value={requesterBadge} onChange={e => setRequesterBadge(e.target.value)} placeholder="Serial #" /></div>
                    <div><span style={labelStyle}>Forum Account URL {isLspd ? optionalTag : <>{reqStar}{infoBubble('The completed reports are delivered here.')}</>}</span>
                        {isLspd ? (
                            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 6, padding: '8px 10px', marginTop: 4 }}>
                                LSPD officers have no forum profiles — skipped. Completed reports route via the LSPD portal.
                            </div>
                        ) : (
                            <input style={inputStyle} value={forumAccountUrl} onChange={e => setForumAccountUrl(e.target.value)} placeholder="https://lssd.gta.world/… member profile" />
                        )}
                    </div>
                    <div><span style={labelStyle}>Cell Number{optionalTag}</span><input style={inputStyle} value={requesterCell} onChange={e => setRequesterCell(e.target.value)} placeholder="555-0123" /></div>
                    <div><span style={labelStyle}>(( Discord Name )){optionalTag}</span><input style={inputStyle} value={requesterDiscord} onChange={e => setRequesterDiscord(e.target.value)} placeholder="(( Discord username ))" /></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', alignSelf: 'end', paddingBottom: 4 }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'var(--text)', margin: 0 }}>
                            <input type="checkbox" checked={guidelinesRead} onChange={e => setGuidelinesRead(e.target.checked)} style={{ width: 15, height: 15, margin: 0 }} />
                            I have read and understood the
                        </label>
                        <button type="button" onClick={() => setShowGuidelines(true)} style={{ background: 'transparent', border: 'none', color: 'var(--teal)', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0, textDecoration: 'underline' }}>Autopsy Guidelines</button>
                    </div>
                </div>

                {section('DETAILS', <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontSize: 10.5 }}>(shared by every body)</span>)}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
                    <div><span style={labelStyle}>Synopsis</span><textarea style={{ ...inputStyle, minHeight: 68, resize: 'vertical' }} value={synopsis} onChange={e => setSynopsis(e.target.value)} placeholder="Scene observed: casings, weapons, victim states…" /></div>
                    <div><span style={labelStyle}>Reason for Autopsy</span><textarea style={{ ...inputStyle, minHeight: 68, resize: 'vertical' }} value={causeDetail} onChange={e => setCauseDetail(e.target.value)} placeholder="Why every body in this batch needs an autopsy…" /></div>
                    <div><span style={labelStyle}>/cexamine image URL{optionalTag}</span><input style={inputStyle} value={cexamineImg} onChange={e => setCexamineImg(e.target.value)} placeholder="https://…" /></div>
                    <div><span style={labelStyle}>/cinjuries image URL{optionalTag}</span><input style={inputStyle} value={cinjuriesImg} onChange={e => setCinjuriesImg(e.target.value)} placeholder="https://…" /></div>
                </div>

                {section('BODIES', <span style={{ fontWeight: 400, color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 10.5 }}>(prefilled from morgue intake · PK/CK per body)</span>)}
                {bodies.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '10px 0' }}>
                        No bodies selected. Close this window and tick the bodies you want in the morgue list.
                    </div>
                ) : bodies.map((b, i) => (
                    <BodyCard
                        key={b.recordKey || i}
                        body={b}
                        index={i}
                        canRemove={bodies.length > 2}
                        onChange={(patch) => updateBody(i, patch)}
                        onRemove={() => removeBody(i)}
                    />
                ))}

                <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>Forum topic preview:</div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--teal)', fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{topicTitle}</div>
                        <details>
                            <summary style={{ fontSize: 10.5, color: 'var(--text-faint)', cursor: 'pointer', marginTop: 4 }}>Show generated BBCode</summary>
                            <pre style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto', margin: '6px 0 0', fontFamily: 'var(--mono)' }}>{preview.requestBBCode}</pre>
                        </details>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                    {missing.length > 0 && (
                        <div style={{ fontSize: 11.5, color: '#ff6b6b', marginRight: 'auto' }}>
                            Complete required fields: <strong>{missing.join(', ')}</strong>
                        </div>
                    )}
                    <button onClick={onClose} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || missing.length > 0 || lspdBlocked}
                        title={lspdBlocked ? LSPD_MASS_BLOCK_MESSAGE : (missing.length > 0 ? `Required: ${missing.join(', ')}` : `Submit one request for ${bodies.length} bodies`)}
                        style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--teal)', borderRadius: 6, padding: '8px 16px', fontSize: 12.5, cursor: (submitting || missing.length > 0 || lspdBlocked) ? 'not-allowed' : 'pointer', opacity: (submitting || missing.length > 0 || lspdBlocked) ? 0.45 : 1 }}
                    >
                        {submitting
                            ? <><i className="fas fa-spinner fa-spin me-1" />Submitting…</>
                            : <><i className="fas fa-paper-plane me-1" />Submit Batch Request ({bodies.length})</>}
                    </button>
                </div>
            </div>

            <AutopsyGuidelinesModal show={showGuidelines} onClose={() => setShowGuidelines(false)} />
        </div>
    );
};

export default MassRequestAutopsyModal;
