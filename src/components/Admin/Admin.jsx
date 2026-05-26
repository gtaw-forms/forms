import React, { useState, useEffect } from 'react';
import AdminAuthAndActions from './AdminAuthAndActions.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';

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
        username: gtaAuthUsername,
        isPhmcMember,
        accessLevel
    } = useGtaWorldAuth();

    // Track if we've already shown the welcome notification to avoid showing it multiple times
    const [hasShownGtaWelcome, setHasShownGtaWelcome] = useState(false);

    // Show welcome notification for GTA World OAuth users when they reach admin page
    useEffect(() => {
        if (isGtaAuthenticated && gtaWorldUser && !hasShownGtaWelcome) {
            const displayName = gtaWorldUser.username || gtaAuthUsername || 'Admin';
            let welcomeMessage = `Welcome back, ${displayName}! 🎮`;
            
            // Check if user is a PHMC faction member or has elevated access
            if (isPhmcMember) {
                // If they are staff/admin but not in faction, gtaWorldUser.faction might be missing
                const characterName = (gtaWorldUser.faction?.firstname && gtaWorldUser.faction?.lastname) ? 
                    `${gtaWorldUser.faction.firstname} ${gtaWorldUser.faction.lastname}` : 
                    (gtaWorldUser.faction?.name || gtaWorldUser.faction?.characterName || displayName);
                
                const scriptRank = gtaWorldUser.faction?.scriptRank;
                const rankName = gtaWorldUser.faction?.rankName || (accessLevel === 'staff' ? 'GTA World Staff' : accessLevel === 'president' ? 'System Administrator' : 'Authorized User');
                
                // Create detailed welcome message with character info
                if (characterName && scriptRank !== undefined && rankName) {
                    welcomeMessage = `Welcome back, ${characterName}! (${rankName} - Script Rank: ${scriptRank}) 🏥`;
                } else if (characterName && rankName) {
                    welcomeMessage = `Welcome back, ${characterName}! (${rankName}) 🏥`;
                } else {
                    welcomeMessage = `Welcome back, ${characterName}! 🏥`;
                }
            }
            
            showNotification(welcomeMessage, 'check-circle', 5000);
            setHasShownGtaWelcome(true);
        }
        
        // Reset the welcome flag when user logs out
        if (!isGtaAuthenticated && hasShownGtaWelcome) {
            setHasShownGtaWelcome(false);
        }
    }, [isGtaAuthenticated, gtaWorldUser, hasShownGtaWelcome, showNotification, isPhmcMember, accessLevel, gtaAuthUsername]);

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

    // Check if user has PHMC access (unless they have Gmail override or staff role)
    const isGmailUser = currentUser?.email?.endsWith('@gmail.com');
    const hasElevatedAccess = ['president', 'staff', 'superadmin'].includes(accessLevel);
    
    // hasAdminAccess is true if they are in the faction, a staff member, or a whitelisted Gmail user
    const hasAdminAccess = isPhmcMember || isGmailUser || hasElevatedAccess;
    
    if (!hasAdminAccess && isGtaAuthenticated && !gtaAuthLoading) {
        // Log unauthorized access attempt (only once per session)
        const logUnauthorizedAccess = async () => {
            // Prevent multiple webhook calls for the same session
            if (hasLoggedUnauthorizedAccess) return;
            
            try {
                const embed = {
                    title: "⚠️ Unauthorized Admin Access Attempt",
                    color: 0xFF0000,
                    description: `**User:** ${gtaAuthUsername || 'Unknown'} (${currentUser?.email || 'Unknown'})\n**Reason:** Not a PHMC member`,
                    timestamp: new Date().toISOString(),
                    footer: { text: "PHMC Security Alert" }
                };
                await triggerWebhookProxy('admin', { embeds: [embed] });

                setHasLoggedUnauthorizedAccess(true);
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
                <p>This admin panel is restricted to PHMC members and GTA World Staff.</p>
                <p>Please contact Fr0styDev if you believe this is an error.</p>
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
