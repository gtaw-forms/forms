import React, { useEffect, useState } from 'react';

// EXTREMELY clear, every-time warning for the Autopsy panel.
// Per PHMC Leadership / LFM ruling: autopsies may no longer be conducted
// outside of the game. You MUST be on duty and with the corpse when doing
// autopsies — otherwise it is powergaming.
//
// No "don't show again", no localStorage: the parent re-opens this on every
// navigation to the autopsy form (formKey === 'autopsy' effect).
const AutopsyDutyWarningModal = ({ show, onAcknowledge }) => {
    const [checked, setChecked] = useState(false);

    // Reset the checkbox each time the modal opens (it opens on EVERY
    // navigation to the autopsy panel, so the acknowledgement never carries over).
    useEffect(() => {
        if (show) setChecked(false);
    }, [show ]);

    if (!show) return null;

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="autopsy-duty-warning-title"
            aria-describedby="autopsy-duty-warning-body"
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'fixed', inset: 0, zIndex: 20000,
                background: 'rgba(6,10,18,0.72)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20,
            }}
        >
            <div style={{
                maxWidth: 540, width: '100%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--amber)',
                borderRadius: 12,
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                overflow: 'hidden',
            }}>
                {/* Header — clear but calm */}
                <div style={{
                    padding: '14px 18px', display: 'flex',
                    alignItems: 'center', gap: 12,
                    borderBottom: '1px solid var(--border)',
                }}>
                    <i className="fas fa-exclamation-triangle" style={{ fontSize: 22, color: 'var(--amber)' }} />
                    <div>
                        <div id="autopsy-duty-warning-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3 }}>
                            Autopsies must be done in-game
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                            LFM ruling — please read before continuing
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div id="autopsy-duty-warning-body" style={{ padding: '16px 18px 12px', color: 'var(--text)', fontSize: 13.5, lineHeight: 1.65 }}>
                    <p style={{ margin: '0 0 10px' }}>
                        Per LFM ruling, autopsies may <strong>no longer</strong> be conducted outside of the game.
                    </p>
                    <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>
                        <li style={{ marginBottom: 4 }}>You must be <strong>on duty</strong> when doing autopsies.</li>
                        <li style={{ marginBottom: 4 }}>You must be <strong>with the corpse</strong> when doing autopsies.</li>
                    </ul>
                    <p style={{
                        margin: 0, padding: '9px 12px', borderRadius: 8,
                        background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                        fontSize: 13, color: 'var(--text)',
                    }}>
                        Doing otherwise is considered powergaming.
                    </p>
                </div>

                {/* Acknowledgement */}
                <div style={{ padding: '0 18px 16px' }}>
                    <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        fontSize: 13, color: 'var(--text)', cursor: 'pointer',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)', borderRadius: 8,
                        padding: '10px 12px', marginBottom: 12,
                    }}>
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            style={{ marginTop: 2, width: 17, height: 17, accentColor: 'var(--teal)', flexShrink: 0 }}
                        />
                        <span>I confirm I am <strong>on duty</strong> and <strong>with the corpse</strong>. I understand an autopsy done otherwise is <strong>powergaming</strong>.</span>
                    </label>
                    <button
                        type="button"
                        disabled={!checked}
                        onClick={onAcknowledge}
                        className="btn btn-primary"
                        style={{
                            width: '100%', padding: '10px 16px', fontSize: 13.5,
                            justifyContent: 'center', opacity: checked ? 1 : 0.5,
                            cursor: checked ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <i className="fas fa-check-circle" style={{ marginRight: 8 }} />
                        I understand — continue to autopsy
                    </button>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
                        This notice appears every time the autopsy panel is opened, per PHMC Leadership.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutopsyDutyWarningModal;
