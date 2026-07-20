/**
 * Bot Deploy Opt-In Modal — per-form-type consent for auto-deploy.
 *
 * Multi-step wizard with sections: Coroners / Clinical Department / Mental Health.
 * Forms not yet in DEPLOY_TRACKED_FORMS show as disabled "Coming soon" items.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DEPLOY_TRACKED_FORMS, FORM_LABELS, FORM_SECTIONS, SECTION_ICONS } from '../../hooks/useConsent';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';

const SECTION_NAMES = Object.keys(FORM_SECTIONS);

const BotDeployOptInModal = ({
    show, onClose, consent, saveAllConsent, setConsent, isLoading, displayName = 'Unknown',
}) => {
    const [local, setLocal] = useState({});
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const modalRef = useRef(null);
    const consentAtOpenRef = useRef(null); // snapshot of consent when modal opened

    const sectionName = SECTION_NAMES[step] || SECTION_NAMES[0];
    const sectionFormIds = useMemo(
        () => (FORM_SECTIONS[sectionName] || []),
        [sectionName]
    );

    const isLastStep = step === SECTION_NAMES.length - 1;
    const isFirstStep = step === 0;

    useEffect(() => {
        if (!show) return;
        setStep(0);
        consentAtOpenRef.current = consent ? { ...consent } : {};
        const defaults = {};
        DEPLOY_TRACKED_FORMS.forEach((f) => { defaults[f] = f === 'autopsy' ? true : false; });
        if (consent && Object.keys(consent).length > 0) {
            setLocal({ ...defaults, ...consent, autopsy: true });
        } else {
            setLocal(defaults);
        }
    }, [consent, show]);

    useEffect(() => {
        if (!show) return;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [show]);

    const handleToggle = useCallback((formId) => {
        setLocal((prev) => ({ ...prev, [formId]: !prev[formId] }));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaveError(null);
        try {
            console.log('[ConsentSave] Saving preferences...', Object.keys(local).length + ' form(s)');
            await saveAllConsent({ ...local, autopsy: true });
            console.log('[ConsentSave] Save succeeded, closing modal');

            // Fire-and-forget Discord notification via Firebase Function proxy
            // (uses GCP Secret Manager, not client-side env vars)
            const oldConsent = consentAtOpenRef.current;
            if (oldConsent && Object.keys(oldConsent).length > 0) {
                    const changed = Object.entries(local).filter(([k, v]) => oldConsent[k] !== v);
                    // Show the user's FULL current preference state
                    const optedIn = Object.entries(local)
                        .filter(([k, v]) => DEPLOY_TRACKED_FORMS.includes(k) && v)
                        .map(([k]) => `+ ${FORM_LABELS[k] || k}`);
                    const optedOut = Object.entries(local)
                        .filter(([k, v]) => DEPLOY_TRACKED_FORMS.includes(k) && !v)
                        .map(([k]) => `- ${FORM_LABELS[k] || k}`);
                    const userName = displayName || 'Dev Staging';
                    const title = changed.length > 0 ? 'Consent Preferences Changed' : 'Consent Preferences Confirmed';
                    triggerWebhookProxy('forms', {
                        embeds: [{
                            title,
                            description: `**User:** ${userName}\n\n${optedIn.length ? `**Opted In**\n${optedIn.join('\n')}` : ''}${optedIn.length && optedOut.length ? '\n\n' : ''}${optedOut.length ? `**Opted Out**\n${optedOut.join('\n')}` : ''}`,
                            color: changed.length > 0 ? 0x6366f1 : 0x22c55e,
                            timestamp: new Date().toISOString(),
                        }],
                    }).catch(err => console.warn('[ConsentSave] Webhook failed:', err.message));
            }

            onClose();
        } catch (err) {
            console.error('[ConsentSave] Save FAILED:', err.message, err.stack);
            setSaveError(err.message || 'Failed to save. Check console for details.');
        } finally { setSaving(false); }
    };

    const enableSection = useCallback(() => {
        setLocal((prev) => {
            const next = { ...prev };
            sectionFormIds.filter(f => DEPLOY_TRACKED_FORMS.includes(f)).forEach((f) => { next[f] = true; });
            return next;
        });
    }, [sectionFormIds]);

    const disableSection = useCallback(() => {
        setLocal((prev) => {
            const next = { ...prev };
            sectionFormIds.filter(f => DEPLOY_TRACKED_FORMS.includes(f)).forEach((f) => { next[f] = f === 'autopsy' ? true : false; });
            return next;
        });
    }, [sectionFormIds]);

    const goNext = useCallback(() => {
        if (isLastStep) return;
        setStep((s) => Math.min(s + 1, SECTION_NAMES.length - 1));
    }, [isLastStep]);

    const goBack = useCallback(() => {
        if (isFirstStep) return;
        setStep((s) => Math.max(s - 1, 0));
    }, [isFirstStep]);

    if (!show) return null;

    const trackedInSection = sectionFormIds.filter(f => DEPLOY_TRACKED_FORMS.includes(f));
    const sectionOptedIn = trackedInSection.filter((f) => local[f] === true || f === 'autopsy').length;
    const allInSectionOn = trackedInSection.every((f) => local[f] === true || f === 'autopsy');
    const noneInSectionOn = trackedInSection.every((f) => local[f] !== true);

    const modal = (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        }}>
            <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="bot-consent-title" style={{
                background: '#1a1d2e', border: '1px solid #2d3154', borderRadius: 16,
                width: 520, maxWidth: '95vw', maxHeight: '85vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
                <div style={{ padding: '20px 24px 0' }}>
                    <h2 id="bot-consent-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#e2e8f0' }}>
                        Bot Auto-Deploy Consent
                    </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '16px 24px 0' }}>
                    {SECTION_NAMES.map((name, i) => {
                        const isActive = i === step;
                        const isPast = i < step;
                        return (
                            <React.Fragment key={name}>
                                {i > 0 && <div style={{ width: 24, height: 1, background: isPast || isActive ? '#6366f1' : '#2d3154' }} />}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
                                    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    border: isActive ? '1px solid #6366f1' : '1px solid transparent',
                                }}>
                                    <div style={{
                                        width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700,
                                        background: isPast || isActive ? '#6366f1' : '#2d3154', color: '#fff',
                                    }}>
                                        {isPast ? <i className="fas fa-check" style={{ fontSize: '0.6rem' }} /> : i + 1}
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isActive ? '#e2e8f0' : '#64748b' }}>
                                        {name}
                                    </span>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{
                        background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)',
                        borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                        <i className="fas fa-info-circle" style={{ color: '#818cf8', fontSize: '1rem', marginTop: 1, flexShrink: 0 }}></i>
                        <div style={{ fontSize: '0.82rem', color: '#c7d2fe', lineHeight: 1.5 }}>
                            <strong style={{ color: '#e0e7ff' }}>Set your preferences to continue.</strong>
                            {' '}Select which report types the PHMC Bot may auto-post to the forums on your behalf.
                            This only takes a moment — you can change these at any time from the sidebar.
                        </div>
                    </div>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading your preferences...
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 6px', marginBottom: 2, borderBottom: '1px solid #2d3154' }}>
                                <i className={`fas ${SECTION_ICONS[sectionName] || 'fa-folder'}`} style={{ color: '#6366f1', fontSize: '0.85rem', width: 18 }}></i>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sectionName}</span>
                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 'auto' }}>{sectionOptedIn}/{trackedInSection.length}</span>
                            </div>

                            {sectionFormIds.map((formId) => {
                                const label = FORM_LABELS[formId] || formId;
                                const isTracked = DEPLOY_TRACKED_FORMS.includes(formId);
                                const checked = isTracked ? (local[formId] === true) : false;
                                return (
                                    <div key={formId} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '9px 0', borderBottom: '1px solid #2d3154', opacity: isTracked ? 1 : 0.5,
                                    }}>
                                        <label htmlFor={`bdc-${formId}`} style={{
                                            cursor: isTracked ? (formId === 'autopsy' ? 'default' : 'pointer') : 'default',
                                            fontSize: '0.9rem', color: '#e2e8f0', userSelect: 'none',
                                        }}>
                                            {label}
                                            {formId === 'autopsy' && (
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>
                                                    Required — cannot be disabled
                                                </span>
                                            )}
                                            {!isTracked && (
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#f0ad4e', marginTop: 2, fontStyle: 'italic' }}>
                                                    <i className="fas fa-tools me-1"></i>Coming soon — auto-deploy not yet available
                                                </span>
                                            )}
                                        </label>
                                        {isTracked ? (
                                            <label style={{
                                                position: 'relative', display: 'inline-block', width: 44, height: 24,
                                                cursor: formId === 'autopsy' ? 'not-allowed' : 'pointer',
                                                opacity: formId === 'autopsy' ? 0.6 : 1,
                                            }}>
                                                <input id={`bdc-${formId}`} type="checkbox"
                                                    checked={formId === 'autopsy' ? true : checked}
                                                    disabled={formId === 'autopsy'}
                                                    onChange={(formId === 'autopsy') ? undefined : () => handleToggle(formId)}
                                                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                />
                                                <span style={{
                                                    position: 'absolute', inset: 0,
                                                    backgroundColor: checked ? '#28a745' : '#3d4166',
                                                    borderRadius: 24, pointerEvents: 'none',
                                                }}></span>
                                                <span style={{
                                                    position: 'absolute', top: 2, left: checked ? 22 : 2,
                                                    width: 20, height: 20, borderRadius: '50%',
                                                    backgroundColor: '#fff', pointerEvents: 'none',
                                                }}></span>
                                            </label>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', color: '#f0ad4e', fontWeight: 600 }}>
                                                <i className="fas fa-clock me-1"></i>Pending
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {trackedInSection.length > 0 && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button type="button" onClick={enableSection} disabled={allInSectionOn}
                                        style={{
                                            flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid #28a745',
                                            background: 'transparent', color: allInSectionOn ? '#3d4166' : '#28a745',
                                            fontSize: '0.8rem', cursor: allInSectionOn ? 'default' : 'pointer',
                                            opacity: allInSectionOn ? 0.4 : 1,
                                        }}>
                                        Enable All
                                    </button>
                                    <button type="button" onClick={disableSection} disabled={noneInSectionOn}
                                        style={{
                                            flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid #dc3545',
                                            background: 'transparent', color: noneInSectionOn ? '#3d4166' : '#dc3545',
                                            fontSize: '0.8rem', cursor: noneInSectionOn ? 'default' : 'pointer',
                                            opacity: noneInSectionOn ? 0.4 : 1,
                                        }}>
                                        Disable All
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {saveError && (
                    <div style={{ padding: '0 24px', marginBottom: 4 }}>
                        <div style={{
                            background: 'rgba(220, 38, 38, 0.12)', border: '1px solid rgba(220, 38, 38, 0.35)',
                            borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: '#fca5a5',
                        }}>
                            <i className="fas fa-exclamation-circle me-1"></i>
                            Failed to save: {saveError}
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px 20px', gap: 12 }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Step {step + 1} of {SECTION_NAMES.length}</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {!isFirstStep && (
                            <button type="button" onClick={goBack} disabled={saving}
                                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #3d4166',
                                    background: 'transparent', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <i className="fas fa-chevron-left" style={{ marginRight: 6 }}></i>Back
                            </button>
                        )}
                        {isLastStep ? (
                            <button type="button" onClick={handleSave} disabled={saving}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1',
                                    color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Saving...</> : 'Save Preferences'}
                            </button>
                        ) : (
                            <button type="button" onClick={goNext} disabled={saving}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#6366f1',
                                    color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                Next<i className="fas fa-chevron-right" style={{ marginLeft: 6 }}></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.getElementById('modal-root') || document.body);
};

export default BotDeployOptInModal;

const STORAGE_KEY = 'PHMC-Bot-OptIn';
export function getBotDeployPref() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
export function setBotDeployPref(value) { try { localStorage.setItem(STORAGE_KEY, value); } catch {} }
export function isBotDeployOptedIn() { try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; } }
