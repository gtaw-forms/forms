import React, { useState, useEffect } from 'react';
import AdminAuthAndActions from './AdminAuthAndActions.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const Admin = ({ formData, setFormData, showNotification }) => {
    const [commitInfo, setCommitInfo] = useState({ sha: '', date: null, error: null });
    const [hasLoggedUnauthorizedAccess, setHasLoggedUnauthorizedAccess] = useState(false);
    
    // Firebase Authentication context
    const { currentUser } = useAuth();
    
    // GTA World Authentication hook for welcome notification
    const { 
        user: gtaWorldUser, 
        isAuthenticated: isGtaAuthenticated,
        isLoading: gtaAuthLoading,
        username: gtaAuthUsername
    } = useGtaWorldAuth();

    // Track if we've already shown the welcome notification to avoid showing it multiple times
    const [hasShownGtaWelcome, setHasShownGtaWelcome] = useState(false);

    // Show welcome notification for GTA World OAuth users when they reach admin page
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && gtaWorldUser.username && !hasShownGtaWelcome) {
            let welcomeMessage = `Welcome back, ${gtaWorldUser.username}! 🎮`;
            
            // Check if user is a PHMC faction member and display their character name and rank
            if (gtaWorldUser.isFactionMember && gtaWorldUser.faction) {
                // Character name from faction data (firstname + lastname)
                const characterName = (gtaWorldUser.faction.firstname && gtaWorldUser.faction.lastname) ? 
                    `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}` : 
                    (gtaWorldUser.faction.name || gtaWorldUser.faction.characterName || gtaWorldUser.username);
                
                const scriptRank = gtaWorldUser.faction.scriptRank;
                const rankName = gtaWorldUser.faction.rankName;
                
                // Create detailed welcome message with character info
                if (characterName && scriptRank !== undefined && rankName) {
                    welcomeMessage = `Welcome back, ${characterName}! (${rankName} - Script Rank: ${scriptRank}) 🏥`;
                } else if (characterName && scriptRank !== undefined) {
                    welcomeMessage = `Welcome back, ${characterName}! (Script Rank: ${scriptRank}) 🏥`;
                } else if (characterName) {
                    welcomeMessage = `Welcome back, ${characterName}! 🏥`;
                }
                
                console.log(`[Admin Welcome] PHMC member detected:`, {
                    username: gtaWorldUser.username,
                    characterName,
                    scriptRank,
                    rankName,
                    factionData: gtaWorldUser.faction
                });
            } else {
                console.log(`[Admin Welcome] Non-PHMC user:`, {
                    username: gtaWorldUser.username,
                    isFactionMember: gtaWorldUser.isFactionMember,
                    hasFactionData: !!gtaWorldUser.faction,
                    fullUserObject: gtaWorldUser,
                    // Check for character array (API uses 'character', not 'characters')
                    hasCharacters: !!(gtaWorldUser.character || gtaWorldUser.characters),
                    charactersCount: (gtaWorldUser.character || gtaWorldUser.characters)?.length || 0,
                    characterNames: (gtaWorldUser.character || gtaWorldUser.characters)?.map(char => ({
                        id: char.id,
                        name: char.name,
                        firstname: char.firstname,
                        lastname: char.lastname,
                        fullName: `${char.firstname || ''} ${char.lastname || ''}`.trim(),
                        memberid: char.memberid
                    })) || 'no characters data',
                    // Check for other possible character fields
                    hasName: !!gtaWorldUser.name,
                    hasFirstname: !!gtaWorldUser.firstname,
                    hasLastname: !!gtaWorldUser.lastname,
                    // Raw API response structure
                    apiDataKeys: Object.keys(gtaWorldUser),
                    // Check if character data is nested elsewhere
                    nestedCharacterData: {
                        user: gtaWorldUser.user,
                        character: gtaWorldUser.character,
                        profile: gtaWorldUser.profile
                    }
                });
            }
            
            showNotification(welcomeMessage, 'check-circle', 5000);
            setHasShownGtaWelcome(true);
        }
        
        // Reset the welcome flag when user logs out
        if (!isGtaAuthenticated && hasShownGtaWelcome) {
            setHasShownGtaWelcome(false);
        }
    }, [isGtaAuthenticated, gtaWorldUser, hasShownGtaWelcome, showNotification]);

    useEffect(() => {
        const GITHUB_COMMIT_CACHE_KEY = 'githubCommitInfo';
        const GITHUB_COMMIT_CACHE_EXPIRATION_MS = 15 * 60 * 1000; // Cache for 15 minutes

        const fetchCommit = () => {
            // 1. Try to load from cache first
            try {
                const cachedCommitDataString = localStorage.getItem(GITHUB_COMMIT_CACHE_KEY);
                if (cachedCommitDataString) {
                    const cachedData = JSON.parse(cachedCommitDataString);
                    const isCacheFresh = (Date.now() - cachedData.timestamp) < GITHUB_COMMIT_CACHE_EXPIRATION_MS;
                    if (isCacheFresh) {
                        setCommitInfo(cachedData.info);
                        return; // Exit if fresh data is found in cache
                    }
                }
            } catch (e) {
                console.error("Error reading commit info from cache:", e);
            }

            // 2. If cache is stale or doesn't exist, fetch from API
            fetch('https://api.github.com/repos/GTAW-PHMC/forms/commits/gh-pages')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`GitHub API responded with status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const commitDate = new Date(data.commit.author.date);
                    const newCommitInfo = {
                        sha: data.sha.substring(0, 7),
                        date: commitDate.toLocaleString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
                        }),
                        error: null // Clear any previous error on success
                    };
                    setCommitInfo(newCommitInfo);

                    // 3. Cache the new data
                    try {
                        localStorage.setItem(GITHUB_COMMIT_CACHE_KEY, JSON.stringify({
                            timestamp: Date.now(),
                            info: newCommitInfo
                        }));
                    } catch (e) {
                        console.error("Error writing commit info to cache:", e);
                    }
                })
                .catch(error => {
                    console.error('Error fetching commit:', error);
                    // 4. On failure, set an error message but keep old data if it exists
                    setCommitInfo(prev => ({
                        ...prev,
                        error: 'Could not fetch latest update information.'
                    }));
                });
        };

        fetchCommit();
    }, []); // This effect runs once on mount

    // Check if user has PHMC access (unless they have Gmail override)
    const isGmailUser = currentUser?.email?.endsWith('@gmail.com');
    
    // Check PHMC membership using the faction data structure
    const isPhmcMember = gtaWorldUser?.isFactionMember && gtaWorldUser?.faction;
    const hasPhmcAccess = isPhmcMember || isGmailUser;
    
    if (!hasPhmcAccess && isGtaAuthenticated && !gtaAuthLoading) {
        // Log unauthorized access attempt (only once per session)
        const logUnauthorizedAccess = async () => {
            // Prevent multiple webhook calls for the same session
            if (hasLoggedUnauthorizedAccess) return;
            
            try {
                const webhookURL = import.meta.env.VITE_DISCORD_WEBHOOK_ADMIN || import.meta.env.VITE_DEV_WEBHOOK;
                if (webhookURL) {
                    const embed = {
                        title: "⚠️ Unauthorized Admin Access Attempt",
                        color: 0xFF0000,
                        description: `**User:** ${gtaAuthUsername || 'Unknown'} (${currentUser?.email || 'Unknown'})\n**Reason:** Not a PHMC member`,
                        timestamp: new Date().toISOString(),
                        footer: { text: "PHMC Security Alert" }
                    };
                    await fetch(webhookURL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ embeds: [embed] })
                    });
                    
                    // Mark as logged to prevent duplicate calls
                    setHasLoggedUnauthorizedAccess(true);
                }
            } catch (error) {
                console.error('Failed to log unauthorized access:', error);
            }
        };
        
        // Only log if we haven't already for this session
        if (!hasLoggedUnauthorizedAccess) {
            logUnauthorizedAccess();
        }
        
        return (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
                <h2>Access Denied</h2>
                <p>This admin panel is restricted to PHMC members only.</p>
                <p>Please contact a PHMC administrator if you believe this is an error.</p>
                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button 
                        className="btn btn-primary"
                        onClick={() => window.location.href = '/forms'}
                        style={{ minWidth: '120px' }}
                    >
                        Go to Home
                    </button>
                    <button 
                        className="btn btn-outline-secondary"
                        onClick={() => {
                            // Clear all authentication
                            sessionStorage.clear();
                            localStorage.clear();
                            window.location.href = '/';
                        }}
                        style={{ minWidth: '120px' }}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <AdminAuthAndActions 
                formData={formData} 
                setFormData={setFormData} 
                showNotification={showNotification} 
                commitInfo={commitInfo} 
            />
        </div>
    );
};

export default Admin;
