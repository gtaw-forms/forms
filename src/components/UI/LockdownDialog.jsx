import React from 'react';
import BaseModal from '../Modals/BaseModal';
import './LockdownDialog.css';

function LockdownDialog({ show, onHide, message }) {
    return (
        <BaseModal
            isOpen={show}
            onClose={onHide}
            title="System Notice"
            showCloseButton={false}
            closeOnOverlayClick={false}
            className="lockdown-dialog"
            modalSize="small"
        >
            <div className="lockdown-content">
                <div className="lockdown-message">
                    {message}
                </div>
                <div className="lockdown-footer">
                    <button className="lockdown-button" onClick={onHide}>
                        Acknowledge
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}

export default LockdownDialog;
