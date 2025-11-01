import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';

const LockdownContext = createContext();

const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";

export const useLockdown = () => {
    const context = useContext(LockdownContext);
    if (!context) {
        throw new Error('useLockdown must be used within a LockdownProvider');
    }
    return context;
};

export const LockdownProvider = ({ children }) => {
    const [lockdownConfig, setLockdownConfig] = useState({
        enabled: false,
        notification: '',
        dialog: '',
        affectedDeployments: []
    });
    const [currentDeployment, setCurrentDeployment] = useState('');
    const [showDialog, setShowDialog] = useState(false);

    // Detect current deployment
    useEffect(() => {
        const currentUrl = window.location.href;
        if (currentUrl.startsWith(FORM_GENERATOR_URL)) {
            setCurrentDeployment('phmc-tools');
        } else if (currentUrl.startsWith(ALTERNATIVE_FORM_GENERATOR_URL)) {
            setCurrentDeployment('github-pages');
        } else {
            setCurrentDeployment('local');
        }
    }, []);

    // Subscribe to lockdown config changes
    useEffect(() => {
        const lockdownRef = ref(database, 'adminSettings/lockdownConfig');
        const unsubscribe = onValue(lockdownRef, (snapshot) => {
            const lockdownData = snapshot.val();
            // Ensure we have valid data with defaults
            const normalizedData = {
                enabled: false,
                notification: '',
                dialog: '',
                affectedDeployments: []
            };

            if (lockdownData) {
                normalizedData.enabled = Boolean(lockdownData.enabled);
                normalizedData.notification = lockdownData.notification || '';
                normalizedData.dialog = lockdownData.dialog || '';
                normalizedData.affectedDeployments = Array.isArray(lockdownData.affectedDeployments) 
                    ? lockdownData.affectedDeployments 
                    : [];
            }

            setLockdownConfig(normalizedData);

            // Show dialog if lockdown is enabled and affects this deployment
            const isAffected = normalizedData.enabled && (
                normalizedData.affectedDeployments.includes('all') ||
                normalizedData.affectedDeployments.includes(currentDeployment)
            );

            // Set dialog visibility based on affected status
            setShowDialog(isAffected);
        });

        return () => unsubscribe();
    }, [currentDeployment]);

    const hideDialog = () => {
        setShowDialog(false);
    };

    const isLockdownActive = Boolean(lockdownConfig.enabled) && Array.isArray(lockdownConfig.affectedDeployments) && (
        lockdownConfig.affectedDeployments.includes('all') ||
        lockdownConfig.affectedDeployments.includes(currentDeployment)
    );

    return (
        <LockdownContext.Provider value={{
            lockdownConfig,
            currentDeployment,
            showDialog,
            hideDialog,
            isLockdownActive
        }}>
            {children}
        </LockdownContext.Provider>
    );
};