import { useState, useEffect, useCallback, useRef } from 'react';
import { Form as BootstrapForm, Button, Spinner } from 'react-bootstrap';
import { auth, database } from '../../firebase';
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, get, update, remove, set, serverTimestamp, push } from "firebase/database";


import * as Sentry from "@sentry/react";
import { triggerWebhookProxy } from '../../services/firebaseFunctions';
import AdminDashboard from './AdminDashboard';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useAuth } from '../../contexts/AuthContext';
import { isGoogleAuthenticated, logout as gtaLogout } from '../../services/gtaWorldAuth';
import { getUserContext, logAdminAction } from '../../utils/adminLogger';

const AdminAuthAndActions = ({ formData, setFormData, showNotification: showInAppNotification, commitInfo }) => {
    // --- Custom Webhook Panel State (must be first, before any logic or return) ---
    const [customWebhookChannel, setCustomWebhookChannel] = useState('');
    const [customWebhookTitle, setCustomWebhookTitle] = useState('');
    const [customWebhookMessage, setCustomWebhookMessage] = useState('');
    const [customWebhookUrl, setCustomWebhookUrl] = useState('');
    const [customWebhookSending, setCustomWebhookSending] = useState(false);
    const [customWebhookResult, setCustomWebhookResult] = useState(null);

    // GTA World OAuth login handler
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { 
        user: authUser, 
        displayName: authDisplayName, 
        email: authEmail,
        isLoading: authLoading
    } = useAuth();

    // GTA World authentication hook
    const { 
        user: gtaAuthUser, 
        isAuthenticated: isGtaAuthenticated, 
        isLoading: gtaAuthLoading,
        username: gtaAuthUsername
    } = useGtaWorldAuth();

    // GTA World login is now handled by the unified authentication service


    // Webhook Management States
    const [webhooks, setWebhooks] = useState([]);
    const [newWebhook, setNewWebhook] = useState({ name: '', url: '', type: 'all' });
    const [isUpdatingWebhooks, setIsUpdatingWebhooks] = useState(false);
    const [logRefreshTrigger, setLogRefreshTrigger] = useState(0);
    

    const [formGeneratorStatus, setFormGeneratorStatus] = useState('');
    const [alternativeFormGeneratorStatus, setAlternativeFormGeneratorStatus] = useState('');
    const [localHostStatus, setLocalHostStatus] = useState('');
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);


    const logWebhookToFirebase = async (type, payload) => {
        const logsRef = ref(database, 'webhook_logs');
        const newLogRef = push(logsRef);
        await set(newLogRef, {
            type,
            payload,
            timestamp: Date.now(),
        });
    };


    // Load webhooks on component mount
    useEffect(() => {
        if (authUser) {
            loadWebhooks();
        }
    }, [authUser]);


    useEffect(() => {
        setIsLoadingAuth(authLoading);

        if (authUser) {
            const isGtawFirebaseUser = authUser.uid.startsWith('gtaw:');
            
            setFormData(prev => ({ 
                ...prev, 
                isAdminAuthenticated: true, 
                adminUserEmail: authEmail, 
                adminDisplayData: null, 
                adminSelectedCategoryName: null 
            }));
            
            if (!isGtawFirebaseUser) {
                const googleAuthData = {
                    email: authEmail,
                    uid: authUser.uid,
                    isAdmin: true,
                    loginTime: new Date().toISOString()
                };
                sessionStorage.setItem('google-admin-user', JSON.stringify(googleAuthData));
                sessionStorage.setItem('admin-auth-context', JSON.stringify({
                    isAdminAuthenticated: true,
                    adminUserEmail: authEmail
                }));
            } else {
                // Ensure we don't have stale admin data for GTAW users
                sessionStorage.removeItem('google-admin-user');
                sessionStorage.removeItem('admin-auth-context');
            }
        } else {
            setFormData(prev => ({ 
                ...prev, 
                isAdminAuthenticated: false, 
                adminUserEmail: null, 
                adminDisplayData: null, 
                adminSelectedCategoryName: null 
            }));
            sessionStorage.removeItem('google-admin-user');
            sessionStorage.removeItem('admin-auth-context');
        }
    }, [authUser, authEmail, authLoading, setFormData]);

    // Monitor GTA World OAuth authentication changes
    const prevGtaAuthStateRef = useRef(null);
    useEffect(() => {
        const wasGtaAuthenticated = prevGtaAuthStateRef.current;
        const isNowGtaAuthenticated = isGtaAuthenticated && gtaAuthUser;
        const { userAgent, timeZone } = getUserContext();

        // Handle GTA World OAuth login
        if (isNowGtaAuthenticated && !wasGtaAuthenticated && !gtaAuthLoading) {
            console.log('[GTA OAuth Login] User successfully authenticated via GTA World OAuth');
            
            const oauthUserEmail = gtaAuthUser.username;
            const characterName = gtaAuthUser.faction?.characterName || gtaAuthUser.username;
            const scriptRank = gtaAuthUser.faction?.scriptRank;
            
            // Send OAuth login webhook
            logAdminAction(
                oauthUserEmail,
                "Admin OAuth Login",
                `GTA World OAuth user successfully logged in to Admin Panel.\nCharacter: ${characterName}\n${scriptRank ? `Script Rank: ${scriptRank}` : 'No rank data'}`,
                null,
                userAgent,
                timeZone,
                gtaAuthUsername
            );

            if (showInAppNotification) {
                showInAppNotification(`Welcome, ${gtaAuthUser.username}! OAuth login successful.`, "check-circle");
            }
        }

        // Handle GTA World OAuth logout
        if (!isNowGtaAuthenticated && wasGtaAuthenticated && !gtaAuthLoading) {
            console.log('[GTA OAuth Logout] User logged out from GTA World OAuth');
            
            // Try to get the username from previous state or fallback
            const loggedOutUsername = prevGtaAuthStateRef.current?.username || 'Unknown OAuth User';
            
            logAdminAction(
                loggedOutUsername,
                "Admin OAuth Logout",
                "GTA World OAuth user logged out from Admin Panel.",
                null,
                userAgent,
                timeZone,
                loggedOutUsername
            );

            if (showInAppNotification) {
                showInAppNotification(`OAuth logout completed.`, "info-circle");
            }
        }

        // Update the previous state reference
        prevGtaAuthStateRef.current = isNowGtaAuthenticated ? gtaAuthUser : null;
    }, [isGtaAuthenticated, gtaAuthUser, gtaAuthLoading, gtaAuthUsername, showInAppNotification]);



    const handleLoginAttempt = async () => {
        setError('');
        setIsLoadingAuth(true);
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the success case
        } catch (err) {
            setError(err.message || "Failed to login.");
            setIsLoadingAuth(false);

            Sentry.captureException(err, {
                level: 'warning',
                extra: {
                    email: email, // Log the email that was used for the attempt.
                    context: 'Admin Login Attempt'
                },
                tags: {
                    login_result: 'failure'
                }
            });
            // --- MODIFICATION END ---

            logAdminAction(email, "Admin Login Failed", `Attempted login with email: ${email}. Error: ${err.message}`, null, userAgent, timeZone, gtaAuthUsername);
            if (showInAppNotification) showInAppNotification(`Login failed: ${err.message}`, "error");
        }
    };

    const handlePasswordKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleLoginAttempt();
        }
    };

    const handleLogout = async () => {
        setError('');
        setIsLoggingOut(true); // CRITICAL SECURITY FIX: Immediately flag logout to hide admin content
        const { userAgent, timeZone } = getUserContext(); // Capture user context
        
        // Determine logout type for webhook
        const logoutType = isGtaAuthenticated ? 'GTA World OAuth' : 
                          isGoogleAuthenticated() ? 'Google Admin' : 'Firebase Email';
        const userIdentifier = unifiedCurrentUser?.email || unifiedCurrentUser?.displayName || "Unknown User";
        
        try {
            // Log the logout attempt
            console.log(`[Admin Logout] Logging out ${logoutType} user: ${userIdentifier}`);
            
            // Firebase logout
            if (authUser) {
                await signOut(auth);
                console.log('[Admin Logout] Firebase auth signed out');
            }
            
            // GTA World logout (clears session storage)
            if (isGtaAuthenticated || isGoogleAuthenticated()) {
                gtaLogout();
                console.log('[Admin Logout] GTA World session cleared');
            }
            
            // CRITICAL SECURITY FIX: Immediately clear local state to prevent admin panel access
            setError('');
            setEmail('');
            setPassword('');
            console.log('[Admin Logout] Local admin state cleared');
            
            // Send success webhook
            logAdminAction(
                userIdentifier, 
                "Admin Logout Successful", 
                `Successfully logged out from ${logoutType} authentication.`, 
                null, 
                userAgent, 
                timeZone
            );
            
            if (showInAppNotification) {
                showInAppNotification(`Successfully logged out from ${logoutType}`, "check-circle");
            }
            
            // CRITICAL SECURITY FIX: Immediate redirect after logout
            console.log('[Admin Logout] Initiating immediate redirect to home page');
            setTimeout(() => {
                window.location.href = '/forms';
            }, 500); // Small delay to allow webhook to send
            
        } catch (err) {
            console.error('[Admin Logout] Error during logout:', err);
            setError(err.message || "Failed to logout.");
            
            logAdminAction(
                userIdentifier, 
                "Admin Logout Failed", 
                `Failed to log out from ${logoutType}. Error: ${err.message}`, 
                null, 
                userAgent, 
                timeZone
            );
            
            if (showInAppNotification) {
                showInAppNotification(`Logout failed: ${err.message}`, "error");
            }
            
            // CRITICAL SECURITY FIX: Even on error, redirect to prevent admin panel access
            console.log('[Admin Logout] Logout failed, but redirecting for security');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000); // Slightly longer delay to show error message
        }
    };

    // Webhook Management Functions
    const handleAddWebhook = async () => {
        if (!newWebhook.name || !newWebhook.url || !newWebhook.type) {
            if (showInAppNotification) showInAppNotification('Please fill in all webhook fields', 'error');
            return;
        }

        setIsUpdatingWebhooks(true);
        try {
            const webhooksRef = ref(database, 'webhooks');
            const newWebhookRef = push(webhooksRef);
            await set(newWebhookRef, {
                ...newWebhook,
                createdAt: Date.now(),
                createdBy: unifiedCurrentUser?.email || "Unknown User"
            });
            
            // Reset form
            setNewWebhook({ name: '', url: '', type: 'all' });
            
            if (showInAppNotification) showInAppNotification('Webhook added successfully!', 'check-circle');
            
            // Refresh webhooks list
            await loadWebhooks();
        } catch (error) {
            console.error('Error adding webhook:', error);
            if (showInAppNotification) showInAppNotification('Failed to add webhook', 'error');
        } finally {
            setIsUpdatingWebhooks(false);
        }
    };

    const handleDeleteWebhook = async (webhookId) => {
        if (!window.confirm('Are you sure you want to delete this webhook?')) return;
        
        setIsUpdatingWebhooks(true);
        try {
            const webhookRef = ref(database, `webhooks/${webhookId}`);
            await remove(webhookRef);
            if (showInAppNotification) showInAppNotification('Webhook deleted successfully!', 'check-circle');
            
            // Refresh webhooks list
            await loadWebhooks();
        } catch (error) {
            console.error('Error deleting webhook:', error);
            if (showInAppNotification) showInAppNotification('Failed to delete webhook', 'error');
        } finally {
            setIsUpdatingWebhooks(false);
        }
    };

    const loadWebhooks = async () => {
        try {
            const webhooksRef = ref(database, 'webhooks');
            const snapshot = await get(webhooksRef);
            if (snapshot.exists()) {
                const webhooksData = snapshot.val();
                const webhooksList = Object.keys(webhooksData).map(key => ({
                    id: key,
                    ...webhooksData[key]
                }));
                setWebhooks(webhooksList);
            } else {
                setWebhooks([]);
            }
        } catch (error) {
            console.error('Error loading webhooks:', error);
        }
    };


    const handleAdminCustomWebhookSubmit = async (payloadFromModal) => {
        const { userAgent, timeZone } = getUserContext();
        try {
            await triggerWebhookProxy('admin', payloadFromModal);
            if (showInAppNotification) showInAppNotification('Admin webhook message sent successfully!', "check-circle");
            logAdminAction(unifiedCurrentUser?.email || "Unknown User", "Sent Admin Custom Webhook", "Admin successfully sent a custom webhook to the Admin Action channel.", null, userAgent, timeZone, gtaAuthUsername);
            logWebhookToFirebase('Admin Custom Webhook Sent', { admin: authEmail, title: payloadFromModal.embeds[0].title });
            return true;
        } catch (error) {
            console.error('Error sending admin custom webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Admin Custom Webhook Submission via Proxy' } });
            if (showInAppNotification) showInAppNotification('Failed to send admin webhook.', 'error');
            logAdminAction(unifiedCurrentUser?.email || "Unknown User", "Failed to Send Admin Custom Webhook", `Error: ${error.message}`, null, userAgent, timeZone, gtaAuthUsername);
            return false;
        }
    };
    // Bingo Activity Log Functions
    const [showMarkdownModal, setShowMarkdownModal] = useState(false);

    const handleCoronerWebhookSubmit = async (payloadFromModal) => {
        const { userAgent, timeZone } = getUserContext();
        try {
            await triggerWebhookProxy('coroner', payloadFromModal);
            if (showInAppNotification) showInAppNotification('Coroner webhook message sent successfully!', "check-circle");
            logAdminAction(unifiedCurrentUser?.email || "Unknown User", "Sent Coroner Custom Webhook", "Admin successfully sent a custom webhook to the Coroner Updates channel.", null, userAgent, timeZone);
            logWebhookToFirebase('Coroner Custom Webhook Sent', { admin: authEmail, title: payloadFromModal.embeds[0].title });
            return true;
        } catch (error) {
            console.error('Error sending Coroner webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Coroner Webhook via Proxy' } });
            if (showInAppNotification) showInAppNotification('Failed to send Coroner webhook.', 'error');
            logAdminAction(unifiedCurrentUser?.email || "Unknown User", "Failed to Send Coroner Custom Webhook", `Error: ${error.message}`, null, userAgent, timeZone);
            return false;
        }
    };


    // CRITICAL SECURITY FIX: Check if user is logging out first
    if (isLoggingOut) {
        return (
            <div className="container mt-5 text-center">
                <div className="card">
                    <div className="card-body">
                        <i className="fas fa-sign-out-alt fa-3x text-warning mb-3"></i>
                        <h4>Signing Out...</h4>
                        <p>You are being logged out for security. Redirecting to home page...</p>
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Check if either loading state is active
    if (isLoadingAuth || gtaAuthLoading) {
        return <p>Verifying authentication...</p>;
    }

    // Check if user is authenticated via Google admin OR GTA World OR Google override
    const isGoogleAdmin = isGoogleAuthenticated();
    const hasAnyAuthentication = authUser || isGtaAuthenticated || isGoogleAdmin;

    // Create a unified current user object for components that expect it
    const unifiedCurrentUser = authUser ? {
        email: authEmail,
        uid: authUser.uid,
        displayName: authDisplayName,
        isGtaAuth: authUser.uid.startsWith('gtaw:'),
        isGoogleAuth: !authUser.uid.startsWith('gtaw:'),
        ...gtaAuthUser
    } : null;

    if (!hasAnyAuthentication) {
        return (
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6 col-lg-4">
                        <div className="card">
                            <div className="card-body">
                                <h3 className="card-title text-center mb-4">Admin Login</h3>
                                <BootstrapForm.Group className="mb-3" controlId="adminAuthEmail">
                                    <BootstrapForm.Label>Email address</BootstrapForm.Label>
                                    <BootstrapForm.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter email" />
                                </BootstrapForm.Group>
                                <BootstrapForm.Group className="mb-3" controlId="adminAuthPassword">
                                    <BootstrapForm.Label>Password</BootstrapForm.Label>
                                    <BootstrapForm.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handlePasswordKeyDown} required placeholder="Password" />
                                </BootstrapForm.Group>
                                {error && <p className="text-danger text-center">{error}</p>}
                                <div className="d-grid">
                                    <Button variant="primary" type="button" onClick={handleLoginAttempt}>
                                        Login
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Helper to build rich Discord embed payload with PHMC branding
    const buildWebhookPayload = (title, message, customUrl = '') => {
        const FORM_GENERATOR_URL = "https://phmc-tools.gta.world/";
        const ALTERNATIVE_FORM_GENERATOR_URL = "https://gtaw-forms.github.io/forms/";
        const phmcLogoUrl = 'https://i.ibb.co/0pgw9hHm/phmc.png';
        
        // Create embed fields with form generator links
        const embedFields = [];
        if (FORM_GENERATOR_URL) {
            embedFields.push({ 
                name: "[Delayed Updates] Form Generator Link", 
                value: FORM_GENERATOR_URL, 
                inline: false 
            });
        }
        if (ALTERNATIVE_FORM_GENERATOR_URL) {
            embedFields.push({ 
                name: "Alternative Form Generator Link", 
                value: ALTERNATIVE_FORM_GENERATOR_URL, 
                inline: false 
            });
        }
        
        // Add custom URL field if provided
        if (customUrl && customUrl.trim()) {
            embedFields.push({
                name: "Related Link",
                value: customUrl.trim(),
                inline: false
            });
        }
                
        const embed = {
            title: title || "PHMC Admin Notification",
            url: customUrl && customUrl.trim() ? customUrl.trim() : FORM_GENERATOR_URL,
            description: message || undefined,
            color: 0x7289DA, // Discord blue color matching WebhookModal
            timestamp: new Date().toISOString(),
            fields: embedFields,
            footer: {
                text: `PHMC Form Generator v${commitInfo?.sha || 'N/A'}`
            }
        };
        
        return {
            username: "PHMC Admin",
            avatar_url: phmcLogoUrl,
            embeds: [embed]
        };
    };

    const handleSendCustomWebhook = async (e) => {
        e.preventDefault();
        setCustomWebhookSending(true);
        setCustomWebhookResult(null);
        
        // Find the selected webhook
        const selectedWebhook = webhooks.find(hook => hook.id === customWebhookChannel);
        if (!selectedWebhook) {
            console.error('No webhook selected or webhook not found');
            setCustomWebhookResult('error');
            setCustomWebhookSending(false);
            return;
        }

        const payload = buildWebhookPayload(customWebhookTitle, customWebhookMessage, customWebhookUrl);
        let result = false;
        let responseStatus = null;
        
        try {
            const response = await fetch(selectedWebhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            result = response.ok;
            responseStatus = response.status;
            if (!result) {
                console.error('Webhook send failed:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error sending custom webhook:', error);
            result = false;
        }
        
        // Log the webhook send to Firebase
        try {
            await logWebhookToFirebase('custom_webhook', {
                webhook: {
                    id: selectedWebhook.id,
                    name: selectedWebhook.name,
                    type: selectedWebhook.type,
                    url: selectedWebhook.url
                },
                title: customWebhookTitle,
                message: customWebhookMessage,
                customUrl: customWebhookUrl,
                adminUser: unifiedCurrentUser?.email || 'Unknown Admin',
                success: result,
                responseStatus: responseStatus,
                timestamp: new Date().toISOString()
            });
            
            // Trigger log refresh to update the WebhookLogs component
            setLogRefreshTrigger(prev => prev + 1);
        } catch (logError) {
            console.error('Failed to log custom webhook to Firebase:', logError);
        }
        
        setCustomWebhookResult(result ? 'success' : 'error');
        setCustomWebhookSending(false);
        if (result) {
            setCustomWebhookTitle('');
            setCustomWebhookMessage('');
            setCustomWebhookUrl('');
        }
    };

    return (
        <>
            {/* --- Main Admin Dashboard --- */}
            <AdminDashboard
                currentUser={unifiedCurrentUser}
                gtaWorldUser={gtaAuthUser}
                isLoadingStatus={isLoadingStatus}
                formGeneratorStatus={formGeneratorStatus}
                setFormGeneratorStatus={setFormGeneratorStatus}
                alternativeFormGeneratorStatus={alternativeFormGeneratorStatus}
                setAlternativeFormGeneratorStatus={setAlternativeFormGeneratorStatus}
                localHostStatus={localHostStatus}
                setLocalHostStatus={setLocalHostStatus}
                setShowMarkdownModal={setShowMarkdownModal}
                handleLogout={handleLogout}
                Sentry={Sentry}
                showInAppNotification={showInAppNotification}
                // handleGtaWorldLogin is now handled by unified auth service
                webhooks={webhooks}
                newWebhook={newWebhook}
                setNewWebhook={setNewWebhook}
                handleAddWebhook={handleAddWebhook}
                handleDeleteWebhook={handleDeleteWebhook}
                isUpdatingWebhooks={isUpdatingWebhooks}
                customWebhookChannel={customWebhookChannel}
                setCustomWebhookChannel={setCustomWebhookChannel}
                customWebhookTitle={customWebhookTitle}
                setCustomWebhookTitle={setCustomWebhookTitle}
                customWebhookMessage={customWebhookMessage}
                setCustomWebhookMessage={setCustomWebhookMessage}
                customWebhookUrl={customWebhookUrl}
                setCustomWebhookUrl={setCustomWebhookUrl}
                customWebhookSending={customWebhookSending}
                customWebhookResult={customWebhookResult}
                handleSendCustomWebhook={handleSendCustomWebhook}
                logRefreshTrigger={logRefreshTrigger}
                setLogRefreshTrigger={setLogRefreshTrigger}
            />




        </>
    );
};

export default AdminAuthAndActions;
