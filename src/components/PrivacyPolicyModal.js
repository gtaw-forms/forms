import React from 'react';
import './PrivacyPolicyModal.css';

const PrivacyPolicyModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
        <h2>(( Privacy Policy )) </h2>
        <p>This policy covers the use of PHMC Tools and complies with the <a href="https://gta.world/terms/" target="_blank" rel="noopener noreferrer">GTA World Privacy Policy</a>.</p>
        <p> This website processes <strong>IN CHARACTER</strong> information for the usage of Pillbox Hill Medical Center (A GTA World Faction) </p>
        <p>We are in full compliance of the <a href="https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/" target="_blank" rel="noopener noreferrer">GTA World Regulations</a>  by hosting this website on GTA World Servers and code is vetted by GTAW Developers.</p>
        <p>
          We utilize tools from third party providers: 
          <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer">Sentry</a> (Error Tracking) and  
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"> Google Firebase</a> (Report Saving).
        </p>
        <p>We collect the following data:</p>
            <li>Firebase only stores Saved Reports, Dropdown Fields and Employee Names</li>
            <li>Error Logs Device Information (Mobile / Desktop / Tablet), related error file and button pressed.</li>
            <li>Only myself and Everett can view the Error Logs and the Firebase Database.</li>
        <p>We do not share your data with any third parties except for the third party providers mentioned above.</p>
        <p>Questions: Ask in the PHMC Discord Server. </p>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default PrivacyPolicyModal;