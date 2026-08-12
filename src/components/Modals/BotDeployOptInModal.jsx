/**
 * Bot Deploy Opt-In Modal — per-form-type consent for auto-deploy.
 *
 * Multi-step wizard with sections: Coroners / Clinical Department / Mental Health.
 * Forms not yet in DEPLOY_TRACKED_FORMS show as disabled "Coming soon" items.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DEPLOY_TRACKED_FORMS, FORM_LABELS, FORM_SECTIONS, SECTION_ICONS } from '../../hooks/useConsent';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';
import BaseModal from './BaseModal';

const SECTION_NAMES = Object.keys(FORM_SECTIONS);

const BotDeployOptInModal = ({
    show, onClose, consent, saveAllConsent, setConsent, isLoading, displayName = 'Unknown',
}) => {
    const [local, setLocal] = useState({});
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
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

    const stepIndicator = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 0 16px' }}>
            {SECTION_NAMES.map((name, i) => {
                const isActive = i === step;
                const isPast = i < step;
                return (
                    <React.Fragment key={name}>
                        {i > 0 && <div style={{ width: 24, height: 1, background: isPast || isActive ? 'var(--accent-primary)' : 'var(--border-muted)' }} />}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
                            background: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
                            border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                        }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700,
                                background: isPast || isActive ? 'var(--accent-primary)' : 'var(--border-muted)', color: '#fff',
                            }}>
                                {isPast ? <i className="fas fa-check" style={{ fontSize: '0.6rem' }} /> : i + 1}
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                {name}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );

    const infoBanner = (
        <div style={{
            background: 'var(--accent-primary-subtle)', border: '1px solid rgba(99, 102, 241, 0.35)',
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
    );

    const formList = (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 6px', marginBottom: 2, borderBottom: '1px solid var(--border-muted)' }}>
                <i className={`fas ${SECTION_ICONS[sectionName] || 'fa-folder'}`} style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', width: 18 }}></i>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sectionName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sectionOptedIn}/{trackedInSection.length}</span>
            </div>

            {sectionFormIds.map((formId) => {
                const label = FORM_LABELS[formId] || formId;
                const isTracked = DEPLOY_TRACKED_FORMS.includes(formId);
                const checked = isTracked ? (local[formId] === true) : false;
                return (
                    <div key={formId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 0', borderBottom: '1px solid var(--border-muted)', opacity: isTracked ? 1 : 0.5,
                    }}>
                        <label htmlFor={`bdc-${formId}`} style={{
                            cursor: isTracked ? (formId === 'autopsy' ? 'default' : 'pointer') : 'default',
                            fontSize: '0.9rem', color: 'var(--text-primary)', userSelect: 'none',
                        }}>
                            {label}
                            {formId === 'autopsy' && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>
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
                                    backgroundColor: checked ? 'var(--color-success)' : 'var(--border-accent)',
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
                            flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-success)',
                            background: 'transparent', color: allInSectionOn ? 'var(--border-accent)' : 'var(--color-success)',
                            fontSize: '0.8rem', cursor: allInSectionOn ? 'default' : 'pointer',
                            opacity: allInSectionOn ? 0.4 : 1,
                        }}>
                        Enable All
                    </button>
                    <button type="button" onClick={disableSection} disabled={noneInSectionOn}
                        style={{
                            flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--color-danger)',
                            background: 'transparent', color: noneInSectionOn ? 'var(--border-accent)' : 'var(--color-danger)',
                            fontSize: '0.8rem', cursor: noneInSectionOn ? 'default' : 'pointer',
                            opacity: noneInSectionOn ? 0.4 : 1,
                        }}>
                        Disable All
                    </button>
                </div>
            )}
        </>
    );

    const footerContent = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Step {step + 1} of {SECTION_NAMES.length}</span>
            <div style={{ display: 'flex', gap: 10 }}>
                {!isFirstStep && (
                    <button type="button" onClick={goBack} disabled={saving}
                        style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border-accent)',
                            background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <i className="fas fa-chevron-left" style={{ marginRight: 6 }}></i>Back
                    </button>
                )}
                {isLastStep ? (
                    <button type="button" onClick={handleSave} disabled={saving}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Saving...</> : 'Save Preferences'}
                    </button>
                ) : (
                    <button type="button" onClick={goNext} disabled={saving}
                        style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)',
                            color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        Next<i className="fas fa-chevron-right" style={{ marginLeft: 6 }}></i>
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <BaseModal
            isOpen={show}
            onClose={(saving) ? undefined : handleSave}
            title="Bot Auto-Deploy Consent"
            closeOnOverlayClick={false}
            showCloseButton={false}
            footer={footerContent}
        >
            {stepIndicator}
            {infoBanner}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading your preferences...
                </div>
            ) : formList}
            {saveError && (
                <div style={{ marginTop: 12 }}>
                    <div style={{
                        background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)',
                        borderRadius: 8, padding: '8px 12px', fontSize: '0.8rem', color: 'var(--color-danger)',
                    }}>
                        <i className="fas fa-exclamation-circle me-1"></i>
                        Failed to save: {saveError}
                    </div>
                </div>
            )}
        </BaseModal>
    );
};

export default BotDeployOptInModal;

const STORAGE_KEY = 'PHMC-Bot-OptIn';
export function getBotDeployPref() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
export function setBotDeployPref(value) { try { localStorage.setItem(STORAGE_KEY, value); } catch {} }
export function isBotDeployOptedIn() { try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; } }
