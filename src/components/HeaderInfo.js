// src/components/HeaderInfo.js
import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';

const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";
const LOCALHOST_URL = "http://localhost";
const ServiceStatusIndicator = ({ status }) => {
    if (!status) {
        return null;
    }

    const getStatusStyle = (statusText) => {
        const lowerCaseStatus = statusText.toLowerCase();
        if (lowerCaseStatus.includes('operational') || lowerCaseStatus.includes('latest version')) {
            return { color: '#28a745', icon: 'fa-check-circle' }; // Green
        } else if (lowerCaseStatus.includes('delayed') || lowerCaseStatus.includes('delayed')) {
            return { color: '#ffc107', icon: 'fa-exclamation-triangle' }; // Yellow
        } else if (lowerCaseStatus.includes('disruption') || lowerCaseStatus.includes('offline')) {
            return { color: '#dc3545', icon: 'fa-times-circle' }; // Red
        }
        return { color: '#6c757d', icon: 'fa-question-circle' }; // Grey for unknown
    };

    const { color, icon } = getStatusStyle(status);

    const statusStyle = {
        color: color,
        verticalAlign: 'middle',
        fontSize: '0.9em',
        fontWeight: 'bold',
    };

    return (
        <div style={{ marginRight: '20px' }}>
            <i className={`fas ${icon}`} style={{ marginRight: '8px', color: color }}></i>
            <span style={statusStyle}>{status}</span>
        </div>
    );
};

function HeaderInfo({ commitInfo }) {
    const [serviceStatus, setServiceStatus] = useState('');
    const [isProduction, setIsProduction] = useState(false);
    const [statusKey, setStatusKey] = useState('');

    useEffect(() => {
        const currentUrl = window.location.href;
        if (currentUrl.startsWith(FORM_GENERATOR_URL)) {
            setIsProduction(true);
            setStatusKey('formGeneratorStatus');
        } else if (currentUrl.startsWith(ALTERNATIVE_FORM_GENERATOR_URL)) {
            setIsProduction(true);
            setStatusKey('alternativeFormGeneratorStatus');
        } else if (currentUrl.startsWith(LOCALHOST_URL)) {
            setIsProduction(true);
            setStatusKey('localHostStatus');
        }
    }, []);

    useEffect(() => {
        if (isProduction && statusKey) {
            const statusRef = ref(database, `serviceStatus/${statusKey}`);
            const unsubscribe = onValue(statusRef, (snapshot) => {
                const statusData = snapshot.val();
                setServiceStatus(statusData || '');
            }, (error) => {
                console.error("Error fetching service status:", error);
                setServiceStatus('Status unavailable');
            });

            return () => unsubscribe();
        }
    }, [isProduction, statusKey]);

    return (
        <div className="header-info-wrapper">
            <div className="header-info">
                <span className="contact-info">
                    Need help? Contact Alyson Frost on <a
                        href="http://discord.gg/rrzJ4EeHfK"
                        className="discord-link"
                    >
                        Discord  <i className="fab fa-discord"></i>
                    </a>❄️❄️
                </span>
                {isProduction && <ServiceStatusIndicator status={serviceStatus} />}
            </div>
        </div>
    );
}

export default HeaderInfo;
