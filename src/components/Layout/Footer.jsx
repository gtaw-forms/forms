import React from 'react';
import PrivacyPolicyModal from '../Modals/PrivacyPolicyModal';
import './Footer.css';

const Footer = () => {
    const [isPrivacyPolicyModalOpen, setPrivacyPolicyModalOpen] = useState(false);

    const togglePrivacyPolicyModal = () => {
        setPrivacyPolicyModalOpen(!isPrivacyPolicyModalOpen);
    };

    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                <span className="contact-info">
                    PROUDLY PROVIDED TO GTA WORLD (EU). ICONS KINDLY PROVIDED BY FLATICON.
                </span>
                <button onClick={togglePrivacyPolicyModal} className="privacy-policy-button">View Privacy Policy</button>
            </div>
            <PrivacyPolicyModal isOpen={isPrivacyPolicyModalOpen} onClose={togglePrivacyPolicyModal} />
        </div>
    );
};

export default Footer;
