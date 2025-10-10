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
            if (lockdownData) {
                setLockdownConfig({
                    enabled: lockdownData.enabled || false,
                    notification: lockdownData.notification || '',
                    dialog: lockdownData.dialog || '',
                    affectedDeployments: lockdownData.affectedDeployments || [],
                });

                // Show dialog if lockdown is enabled and affects this deployment
                const isAffected = lockdownData.enabled && (
                    lockdownData.affectedDeployments.includes('all') ||
                    lockdownData.affectedDeployments.includes(currentDeployment)
                );

                // Always show dialog when lockdown is active
                if (isAffected) {
                    setShowDialog(true);
                } else {
                    setShowDialog(false);
                }
            }
        });

        return () => unsubscribe();
    }, [currentDeployment]);

    const hideDialog = () => {
        setShowDialog(false);
    };

    const isLockdownActive = lockdownConfig.enabled && (
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