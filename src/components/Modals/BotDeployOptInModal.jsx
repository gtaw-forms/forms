/**
 * Bot Deploy Opt-In Modal — per-form-type consent for auto-deploy.
 *
 * Standalone modal (not BaseModal) with its own overlay and styling.
 * Shows when a user opens a deploy-tracked form for the first time,
 * allowing them to choose which form types the bot may auto-deploy.
 *
 * Persists to Firebase `user-consent/<uid>/` and sends a Discord webhook
 * on changes for usability monitoring.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DEPLOY_TRACKED_FORMS, FORM_LABELS, FORM_SECTIONS, SECTION_ICONS } from '../../hooks/useConsent';

/**
 * @param {object} props
 * @param {boolean} props.show
 * @param {Function} props.onClose
 * @param {object|null} props.consent
 * @param {Function} props.saveAllConsent
 * @param {Function} props.setConsent
 * @param {boolean} props.isLoading
 */
const BotDeployOptInModal = ({
    show,
    onClose,
    consent,
    saveAllConsent,
    setConsent,
    isLoading,
}) => {
    const [local, setLocal] = useState({});
    const [saving, setSaving] = useState(false);
    const modalRef = useRef(null);

    // Reset local state when consent data loads or modal opens
    useEffect(() => {
        if (!show) return;
        const defaults = {};
        DEPLOY_TRACKED_FORMS.forEach((f) => { defaults[f] = f === 'autopsy' ? true : false; });
        if (consent && Object.keys(consent).length > 0) {
            setLocal({ ...defaults, ...consent, autopsy: true });
        } else {
            setLocal(defaults);
        }
    }, [consent, show]);

    // Focus trap + escape key
    useEffect(() => {
        if (!show) return;
        document.body.style.overflow = 'hidden';
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handler);
        };
    }, [show, onClose]);

    const handleToggle = (formId) => {
        setLocal((prev) => ({ ...prev, [formId]: !prev[formId] }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveAllConsent({ ...local, autopsy: true });
            onClose();
        } catch {
            // handled in hook
        } finally {
            setSaving(false);
        }
    };

    const enableAll = () => {
        const all = {};
        DEPLOY_TRACKED_FORMS.forEach((f) => { all[f] = true; });
        setLocal(all);
    };

    const disableAll = () => {
        const all = {};
        DEPLOY_TRACKED_FORMS.forEach((f) => { all[f] = f === 'autopsy' ? true : false; });
        setLocal(all);
    };

    if (!show) return null;

    const allOptedIn = Object.values(local).every((v) => v === true);
    const noneOptedIn = Object.values(local).every((v) => v === false);
    const optedInCount = Object.values(local).filter(Boolean).length;

    const modal = (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(4px)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="bot-consent-title"
                style={{
                    background: '#1a1d2e',
                    border: '1px solid #2d3154',
                    borderRadius: 16,
                    width: 480,
                    maxWidth: '95vw',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 24px 0',
                }}>
                    <h2 id="bot-consent-title" style={{
                        margin: 0,
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: '#e2e8f0',
                    }}>
                        Bot Auto-Deploy Consent
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '1.3rem',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: 6,
                            lineHeight: 1,
                        }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Body */}
                <div style={{
                    padding: '16px 24px',
                    overflowY: 'auto',
                    flex: 1,
                }}>
                    <p style={{
                        margin: '0 0 16px',
                        fontSize: '0.85rem',
                        color: '#94a3b8',
                        lineHeight: 1.5,
                    }}>
                        Choose which report types the PHMC Bot may automatically post to the forums on your behalf.
                        You can change these at any time.
                    </p>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                            <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>
                            Loading your preferences...
                        </div>
                    ) : (
                        <>
                            {Object.entries(FORM_SECTIONS).map(([sectionName, formIds]) => {
                                const visible = formIds.filter((f) => DEPLOY_TRACKED_FORMS.includes(f));
                                if (visible.length === 0) return null;

                                return (
                                    <div key={sectionName} style={{ marginBottom: 16 }}>
                                        {/* Section header */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '8px 0',
                                            marginBottom: 4,
                                            borderBottom: '1px solid #2d3154',
                                        }}>
                                            <i className={`fas ${SECTION_ICONS[sectionName] || 'fa-folder'}`}
                                                style={{ color: '#6366f1', fontSize: '0.85rem', width: 18 }}></i>
                                            <span style={{
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                color: '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                            }}>
                                                {sectionName}
                                            </span>
                                        </div>

                                        {visible.map((formId) => {
                                            const label = FORM_LABELS[formId] || formId;
                                            const checked = local[formId] === true;
                                            return (
                                                <div
                                                    key={formId}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '9px 0',
                                                        borderBottom: '1px solid #2d3154',
                                                    }}
                                                >
                                                    <label
                                                        htmlFor={`bdc-${formId}`}
                                                        style={{
                                                            cursor: formId === 'autopsy' ? 'default' : 'pointer',
                                                            fontSize: '0.9rem',
                                                            color: '#e2e8f0',
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        {label}
                                                        {formId === 'autopsy' && (
                                                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: 2, fontStyle: 'italic' }}>
                                                                Required — cannot be disabled
                                                            </span>
                                                        )}
                                                    </label>
                                                    <label
                                                        style={{
                                                            position: 'relative',
                                                            display: 'inline-block',
                                                            width: 44,
                                                            height: 24,
                                                            cursor: formId === 'autopsy' ? 'not-allowed' : 'pointer',
                                                            opacity: formId === 'autopsy' ? 0.6 : 1,
                                                        }}
                                                    >
                                                        <input
                                                            id={`bdc-${formId}`}
                                                            type="checkbox"
                                                            checked={formId === 'autopsy' ? true : checked}
                                                            disabled={formId === 'autopsy'}
                                                            onChange={(formId === 'autopsy') ? undefined : () => handleToggle(formId)}
                                                            style={{
                                                                opacity: 0,
                                                                width: 0,
                                                                height: 0,
                                                                position: 'absolute',
                                                            }}
                                                        />
                                                        <span style={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            backgroundColor: checked ? '#28a745' : '#3d4166',
                                                            borderRadius: 24,
                                                            transition: 'background-color 0.2s',
                                                            pointerEvents: 'none',
                                                        }}></span>
                                                        <span style={{
                                                            position: 'absolute',
                                                            top: 2,
                                                            left: checked ? 22 : 2,
                                                            width: 20,
                                                            height: 20,
                                                            borderRadius: '50%',
                                                            backgroundColor: '#fff',
                                                            transition: 'left 0.2s',
                                                            pointerEvents: 'none',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                                        }}></span>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}

                            <div style={{
                                display: 'flex',
                                gap: 8,
                                marginTop: 14,
                            }}>
                                <button
                                    type="button"
                                    onClick={enableAll}
                                    style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #28a745',
                                        background: 'transparent',
                                        color: '#28a745',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Enable All
                                </button>
                                <button
                                    type="button"
                                    onClick={disableAll}
                                    style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        border: '1px solid #dc3545',
                                        background: 'transparent',
                                        color: '#dc3545',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Disable All
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 24px 20px',
                    gap: 12,
                }}>
                    <span style={{
                        fontSize: '0.8rem',
                        color: '#64748b',
                    }}>
                        {allOptedIn
                            ? 'All form types enabled'
                            : noneOptedIn
                            ? 'No form types selected'
                            : `${optedInCount} of ${DEPLOY_TRACKED_FORMS.length} selected`}
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            style={{
                                padding: '8px 18px',
                                borderRadius: 8,
                                border: '1px solid #3d4166',
                                background: 'transparent',
                                color: '#94a3b8',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                opacity: saving ? 0.5 : 1,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                padding: '8px 18px',
                                borderRadius: 8,
                                border: 'none',
                                background: '#6366f1',
                                color: '#fff',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: saving ? 0.5 : 1,
                            }}
                        >
                            {saving ? (
                                <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Saving...</>
                            ) : 'Save Preferences'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.getElementById('modal-root') || document.body);
};

export default BotDeployOptInModal;

// ── Backward-compatible exports for SidebarNav ──
const STORAGE_KEY = 'PHMC-Bot-OptIn';

export function getBotDeployPref() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setBotDeployPref(value) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* noop */ }
}

export function isBotDeployOptedIn() {
  try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
}
