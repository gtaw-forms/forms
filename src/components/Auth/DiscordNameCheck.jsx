import React, { useState, useEffect } from 'react';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useData } from '../../contexts/DataContext';
import DiscordNamePrompt from '../Modals/DiscordNamePrompt';

/**
 * DiscordNameCheck Component
 * Wraps the application to check if the logged-in user has their Discord name set in the database.
 */
const DiscordNameCheck = ({ children }) => {
    const { user, isAuthenticated, isLoading: authLoading } = useGtaWorldAuth();
    const { factionsData, isLoadingData: dataLoading } = useData();
    const [showPrompt, setShowPrompt] = useState(false);
    const [characterId, setCharacterId] = useState(null);
    const [existingDiscord, setExistingDiscord] = useState('');
    const [promptType, setPromptType] = useState('initial'); // 'initial' or 'manual'

    useEffect(() => {
        const checkDiscord = () => {
            // Only run when authenticated and data is loaded
            const charId = user?.faction?.characterId || 
                           user?.activeCharacter?.characterId || 
                           user?.characterId || 
                           user?.id; 
            
            const hasFactions = !!(factionsData && factionsData['364']);
            const hasMembers = !!(hasFactions && factionsData['364'].members);
            
            if (isAuthenticated && user && !authLoading && !dataLoading && hasMembers) {
                if (charId) {
                    const members = factionsData['364'].members;
                    const memberData = members[charId];
                    
                    if (memberData) {
                        const hasDiscordInfo = !!(memberData.discordName || memberData.discord);
                        const currentDiscord = memberData.discordName || memberData.discord || '';
                        
                        // Check for manual trigger from session storage
                        const forcePrompt = sessionStorage.getItem('force_discord_check') === 'true';

                        if (!hasDiscordInfo || forcePrompt) {
                            const alreadyAsked = sessionStorage.getItem(`discord_check_asked_${charId}`);
                            if (!alreadyAsked || forcePrompt) {
                                setCharacterId(charId);
                                setExistingDiscord(currentDiscord || user?.username || '');
                                setPromptType(forcePrompt ? 'manual' : 'initial');
                                setShowPrompt(true);
                                if (forcePrompt) sessionStorage.removeItem('force_discord_check');
                            }
                        }
                    }
                }
            }
        };

        checkDiscord();

        // Listen for manual triggers from child components
        const handleManualTrigger = () => {
            sessionStorage.setItem('force_discord_check', 'true');
            checkDiscord();
        };

        window.addEventListener('trigger_discord_check', handleManualTrigger);
        return () => window.removeEventListener('trigger_discord_check', handleManualTrigger);
    }, [isAuthenticated, authLoading, dataLoading, user, factionsData]);

    const handleHide = (success) => {
        setShowPrompt(false);
        if (characterId) {
            sessionStorage.setItem(`discord_check_asked_${characterId}`, 'true');
        }
    };

    return (
        <>
            {children}
            <DiscordNamePrompt 
                show={showPrompt} 
                onHide={handleHide} 
                characterId={characterId}
                initialValue={existingDiscord}
                promptType={promptType}
            />
        </>
    );
};

export default DiscordNameCheck;
