import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebase';

export function useDeploymentConfig() {
    const [deploymentType, setDeploymentType] = useState(null);
    const [lockdownConfig, setLockdownConfig] = useState({
        enabled: false,
        notification: '',
        dialog: '',
        affectedDeployments: []
    });

    useEffect(() => {
        // Determine deployment type based on URL
        const url = window.location.hostname;
        let type = 'unknown';
        
        if (url.includes('github.io')) {
            type = 'github-pages';
        } else if (url.includes('phmc-tools')) {
            type = 'phmc-tools';
        } else if (url.includes('localhost')) {
            type = 'local';
        }
        
        setDeploymentType(type);

        // Listen for deployment-specific lockdown configuration
        const lockdownRef = ref(database, 'adminSettings/lockdownConfig');
        const unsubscribe = onValue(lockdownRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Check if this deployment is affected
                const isAffected = data.affectedDeployments?.includes(type) || data.affectedDeployments?.includes('all');
                setLockdownConfig({
                    enabled: isAffected && data.enabled,
                    notification: data.notification || '',
                    dialog: data.dialog || '',
                    affectedDeployments: data.affectedDeployments || []
                });
            } else {
                setLockdownConfig({
                    enabled: false,
                    notification: '',
                    dialog: '',
                    affectedDeployments: []
                });
            }
        });

        return () => unsubscribe();
    }, []);

    return {
        deploymentType,
        lockdownConfig
    };
}