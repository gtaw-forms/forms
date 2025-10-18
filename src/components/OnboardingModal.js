// src/components/OnboardingModal.js
import { useState, useEffect } from 'react';
import { Button, Form } from 'react-bootstrap';
import { formDefinitions } from '../formDefinitions';
import { database } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { useWebhooks } from '../hooks/useWebhooks';
import * as Sentry from "@sentry/react";
import GtaWorldLoginButton from './Auth/GtaWorldLoginButton';
import useGtaWorldAuth from '../hooks/useGtaWorldAuth';

// Step definitions for the onboarding flow
const ONBOARDING_STEPS = {
    WELCOME: 'welcome',
    USER_TYPE: 'userType',
    ROLE_SPECIFIC: 'roleSpecific',
    FORM_PREVIEW: 'formPreview',
    PRIVACY_POLICY: 'privacyPolicy',
    COMPLETE: 'complete'
};

// User type categories
const USER_TYPES = {
    CIVILIAN: 'civilian',
    PHMC_STAFF: 'phmcStaff',
    CORONER: 'coroner',
    RECRUITMENT: 'recruitment',
    OTHER: 'other'
};

// Form categories for each user type
const FORM_CATEGORIES = {
    [USER_TYPES.CIVILIAN]: ['PHMC'],
    [USER_TYPES.PHMC_STAFF]: ['PHMC'],
    [USER_TYPES.CORONER]: ['PHMC'],
    [USER_TYPES.RECRUITMENT]: ['PHMC Recruitment'],
    [USER_TYPES.OTHER]: ['PHMC', 'PHMC Recruitment']
};

// Recommended forms for each user type
const RECOMMENDED_FORMS = {
    [USER_TYPES.CIVILIAN]: [24, 25, 3, 26], // Medical Release, Basic Patient File, Advanced Patient File
    [USER_TYPES.PHMC_STAFF]: [ 5, 6, 14, 19, 20, 22, 27], // Forensic Services, Surgical Ops, Physical Eval, ER Protocol, General Consultation
    [USER_TYPES.CORONER]: [1, 2, 4, 8, 11, 37, 27], // Forensic Services, Coroner Email, Autopsy, Certificate, Mass Fatality
    [USER_TYPES.RECRUITMENT]: [50, 51, 52, 53, 54, 55], // All recruitment forms
    [USER_TYPES.OTHER]: 'ALL_FORMS' // Show all available forms
};

const OnboardingModal = ({ 
    show, 
    onComplete, 
    onSkip,
    formDefinitions: formDefs = formDefinitions,
    showNotification = () => {}, // Add showNotification prop with default fallback
    phmcList = [], // Add phmcList prop
    coronerList = [] // Add coronerList prop
}) => {
    // Initialize webhook functions
    const { logWebhookToFirebase } = useWebhooks({}, { sha: 'onboarding' }, showNotification);
    
    // GTAW Authentication hook
    const { user: gtaWorldUser, isAuthenticated: isGtaAuthenticated, isLoading: gtaLoading } = useGtaWorldAuth();
    const [currentStep, setCurrentStep] = useState(ONBOARDING_STEPS.WELCOME);
    const [selectedUserType, setSelectedUserType] = useState(null);
    const [selectedRole, setSelectedRole] = useState(null);
    const [recommendedForms, setRecommendedForms] = useState([]);
    const [showAccountCreation, setShowAccountCreation] = useState(false);
    const [accountData, setAccountData] = useState({
        firstName: '',
        lastName: '',
        discord: '',
        rank: '',
        badge: '',
        phNumber: ''
    });
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [accountCreated, setAccountCreated] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (show) {
            setCurrentStep(ONBOARDING_STEPS.WELCOME);
            setSelectedUserType(null);
            setSelectedRole(null);
            setRecommendedForms([]);
            setShowAccountCreation(false);
            setShowLogin(false);
            setSelectedEmployeeId('');
            setLoggedIn(false);
            setAccountData({
                firstName: '',
                lastName: '',
                discord: '',
                rank: '',
                badge: '',
                phNumber: ''
            });
            setIsCreatingAccount(false);
            setAccountCreated(false);
        }
    }, [show]);

    // Update recommended forms when user type changes
    useEffect(() => {
        if (selectedUserType) {
            const formIds = RECOMMENDED_FORMS[selectedUserType];
            if (formIds === 'ALL_FORMS') {
                // For OTHER user type, show all forms
                setRecommendedForms(formDefs);
            } else {
                const forms = formIds?.map(id => formDefs.find(form => form.version === id)).filter(Boolean) || [];
                setRecommendedForms(forms);
            }
        }
    }, [selectedUserType, formDefs]);

    const handleNext = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                setCurrentStep(ONBOARDING_STEPS.USER_TYPE);
                break;
            case ONBOARDING_STEPS.USER_TYPE:
                if (selectedUserType === USER_TYPES.PHMC_STAFF || selectedUserType === USER_TYPES.CORONER) {
                    setCurrentStep(ONBOARDING_STEPS.ROLE_SPECIFIC);
                } else {
                    setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                }
                break;
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                break;
            case ONBOARDING_STEPS.FORM_PREVIEW:
                setCurrentStep(ONBOARDING_STEPS.PRIVACY_POLICY);
                break;
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                setCurrentStep(ONBOARDING_STEPS.COMPLETE);
                break;
            case ONBOARDING_STEPS.COMPLETE:
                handleComplete();
                break;
            default:
                break;
        }
    };

    const handleBack = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.USER_TYPE:
                setCurrentStep(ONBOARDING_STEPS.WELCOME);
                break;
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                setCurrentStep(ONBOARDING_STEPS.USER_TYPE);
                break;
            case ONBOARDING_STEPS.FORM_PREVIEW:
                if (selectedUserType === USER_TYPES.PHMC_STAFF || selectedUserType === USER_TYPES.CORONER) {
                    setCurrentStep(ONBOARDING_STEPS.ROLE_SPECIFIC);
                } else {
                    setCurrentStep(ONBOARDING_STEPS.USER_TYPE);
                }
                break;
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                break;
            case ONBOARDING_STEPS.COMPLETE:
                setCurrentStep(ONBOARDING_STEPS.PRIVACY_POLICY);
                break;
            default:
                break;
        }
    };

    const handleComplete = () => {
        // Get logged-in user data if available
        const loggedInUser = loggedIn ? 
            [...(phmcList || []), ...(coronerList || [])].find(emp => emp.name === selectedEmployeeId) : null;
        
        // Determine default form based on user type and role
        let defaultForm = 1; // Default fallback
        if (selectedUserType === USER_TYPES.CIVILIAN) {
            defaultForm = 24; // Medical Release Form
        } else if (selectedUserType === USER_TYPES.PHMC_STAFF) {
            defaultForm = selectedRole === 'physician' ? 5 : // Surgical Ops for physicians
                         selectedRole === 'nurse' ? 6 : // Physical Evaluation for nurses
                         selectedRole === 'ems' ? 19 : // ER Protocol for EMS
                         selectedRole === 'psych' ? 14 : // Mental Health for psych
                         20; // General Consultation for others
        } else if (selectedUserType === USER_TYPES.CORONER) {
            defaultForm = 1; // Forensic Services
        } else if (selectedUserType === USER_TYPES.RECRUITMENT) {
            defaultForm = 50; // Physician recruitment (first recruitment form)
        }
            
        const preferences = {
            userType: selectedUserType,
            role: selectedRole,
            recommendedForms: recommendedForms.map(form => form.version),
            allowedCategories: FORM_CATEGORIES[selectedUserType] || ['PHMC', 'PHMC Recruitment'],
            onboardingComplete: true,
            completedAt: new Date().toISOString(),
            defaultForm: defaultForm,
            // Include user account info if logged in or account created
            ...(loggedInUser && { 
                userAccount: {
                    name: loggedInUser.name,
                    category: loggedInUser.category || loggedInUser.rank,
                    type: selectedUserType === USER_TYPES.CORONER ? 'coroner' : 'phmc'
                }
            }),
            ...(accountCreated && {
                accountCreated: true,
                newAccount: true
            })
        };

        // Save preferences to localStorage
        localStorage.setItem('userOnboardingPreferences', JSON.stringify(preferences));
        localStorage.setItem('onboardingComplete', 'true');

        // Send webhook notification for onboarding completion
        sendOnboardingCompletionWebhook(preferences);

        // Call completion callback
        onComplete(preferences);
    };

    const sendOnboardingCompletionWebhook = async (preferences) => {
        try {
            const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
            if (!webhookURL) {
                console.warn('Dev webhook URL not configured for onboarding notifications.');
                return;
            }

            const embed = {
                title: "🎯 User Onboarding Completed",
                color: 0x28a745, // Green color for success
                fields: [
                    { name: "User Type", value: getUserTypeLabel(preferences.userType), inline: true },
                    { name: "Role", value: preferences.role ? getRoleLabel(preferences.role) : 'Not specified', inline: true },
                    { name: "Recommended Forms", value: `${preferences.recommendedForms.length} forms`, inline: true },
                    { name: "Categories Access", value: preferences.allowedCategories.join(', '), inline: false },
                    { name: "Account Status", value: preferences.userAccount ? 'Logged In' : (preferences.accountCreated ? 'Account Created' : 'No Account'), inline: true },
                    ...(preferences.userAccount ? [{ name: "User Account", value: `${preferences.userAccount.name} (${preferences.userAccount.category})`, inline: true }] : [])
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "PHMC Forms - Onboarding System"
                }
            };

            const payload = {
                username: "Onboarding Bot",
                embeds: [embed]
            };

            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('Onboarding completion webhook sent successfully');
                // Log to Firebase
                await logWebhookToFirebase('onboarding_completion', payload);
            } else {
                console.error('Failed to send onboarding completion webhook:', response.status);
            }
        } catch (error) {
            console.error('Error sending onboarding completion webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Onboarding Completion Webhook' } });
        }
    };

    const handleSkip = () => {
        localStorage.setItem('onboardingComplete', 'true');
        localStorage.setItem('onboardingSkipped', 'true');
        onSkip();
    };

    const handleAccountDataChange = (e) => {
        setAccountData({
            ...accountData,
            [e.target.name]: e.target.value
        });
    };

    const handleCreateAccount = async () => {
        setIsCreatingAccount(true);
        try {
            const isCoroner = selectedUserType === USER_TYPES.CORONER;
            const requiredFields = isCoroner
                ? ['firstName', 'discord', 'rank', 'badge']
                : ['firstName', 'lastName', 'rank'];

            const emptyFields = requiredFields.filter(field => !accountData[field]?.trim());
            if (emptyFields.length > 0) {
                showNotification(`Please fill in all required fields: ${emptyFields.join(', ')}`, 'warning');
                setIsCreatingAccount(false);
                return;
            }

            const newStaffMemberName = isCoroner 
                ? accountData.firstName
                : `${accountData.firstName} ${accountData.lastName}`.trim();

            const newStaffMember = isCoroner ? {
                name: newStaffMemberName,
                discord: accountData.discord,
                rank: accountData.rank,
                badge: accountData.badge,
                phNumber: accountData.phNumber || "",
                category: accountData.rank,
            } : {
                name: newStaffMemberName,
                lastName: accountData.lastName,
                rank: accountData.rank,
                category: accountData.rank,
            };

            const listRef = ref(database, isCoroner ? 'staff/coroner' : 'staff/phmc');
            const snapshot = await get(listRef);
            const currentStaff = snapshot.exists() ? snapshot.val() : [];

            const isDuplicate = currentStaff.some(member => 
                member.name.toLowerCase() === newStaffMember.name.toLowerCase());
            if (isDuplicate) {
                showNotification(`Staff member with name "${newStaffMember.name}" already exists.`, 'warning');
                setIsCreatingAccount(false);
                return;
            }

            const updatedStaff = [...currentStaff, newStaffMember];
            await set(listRef, updatedStaff);
            
            // Send webhook notification for account creation
            await sendAccountCreationWebhook(newStaffMember, isCoroner);
            
            setAccountCreated(true);
            showNotification(`Successfully created account for ${newStaffMember.name}!`, 'success');
            
            // Auto-progress to next step after successful account creation
            setTimeout(() => {
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
            }, 1500);
        } catch (error) {
            console.error('Error creating account:', error);
            showNotification(`Error creating account: ${error.message}`, 'error');
        } finally {
            setIsCreatingAccount(false);
        }
    };

    const sendAccountCreationWebhook = async (staffMember, isCoroner) => {
        try {
            const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
            if (!webhookURL) {
                console.warn('Dev webhook URL not configured for account creation notifications.');
                return;
            }

            const embed = {
                title: `👤 New ${isCoroner ? 'Coroner' : 'PHMC Staff'} Account Created`,
                color: isCoroner ? 0x8b0000 : 0x007bff, // Red for coroner, blue for PHMC
                fields: [
                    { name: "Name", value: staffMember.name, inline: true },
                    { name: "Rank/Position", value: staffMember.rank || staffMember.category, inline: true },
                    ...(isCoroner ? [
                        { name: "Discord", value: staffMember.discord, inline: true },
                        { name: "Badge Number", value: staffMember.badge, inline: true },
                        ...(staffMember.phNumber ? [{ name: "PH Number", value: staffMember.phNumber, inline: true }] : [])
                    ] : [
                        { name: "Last Name", value: staffMember.lastName, inline: true }
                    ]),
                    { name: "Account Type", value: isCoroner ? 'Coroner Staff' : 'Hospital Staff', inline: true },
                    { name: "Created Via", value: 'Onboarding System', inline: true }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: "PHMC Forms - Account Creation"
                }
            };

            const payload = {
                username: "Account Bot",
                embeds: [embed]
            };

            const response = await fetch(webhookURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('Account creation webhook sent successfully');
                // Log to Firebase
                await logWebhookToFirebase('account_creation', payload);
            } else {
                console.error('Failed to send account creation webhook:', response.status);
            }
        } catch (error) {
            console.error('Error sending account creation webhook:', error);
            Sentry.captureException(error, { extra: { context: 'Account Creation Webhook' } });
        }
    };

    const handleLogin = async () => {
        if (!selectedEmployeeId) {
            showNotification('Please select an employee to login as.', 'warning');
            return;
        }
        
        setIsLoggingIn(true);
        
        try {
            // Find the selected employee
            const allEmployees = [...(phmcList || []), ...(coronerList || [])];
            const selectedEmployee = allEmployees.find(emp => emp.name === selectedEmployeeId);
            
            // Send webhook notification for login
            await sendAccountCreationWebhook({
                name: selectedEmployee?.name || 'Unknown',
                role: selectedEmployee?.category || selectedEmployee?.rank || 'Unknown',
                userType: getUserTypeLabel(selectedUserType),
                action: 'login'
            }, selectedUserType === USER_TYPES.CORONER);
            
            setLoggedIn(true);
            showNotification(`Successfully logged in as ${selectedEmployee?.name || 'Employee'}!`, 'success');
            
            // Auto-progress to next step after successful login
            setTimeout(() => {
                setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
            }, 1500);
        } catch (error) {
            console.error('Error during login:', error);
            showNotification(`Error during login: ${error.message}`, 'error');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleGtawLogin = async (userData) => {
        try {
            console.log('[Onboarding] GTAW login successful:', userData);
            
            // Check if user is a PHMC faction member
            const isFactionMember = userData?.faction && userData.faction.characterName;
            
            if (isFactionMember) {
                const characterName = (userData.faction.firstname && userData.faction.lastname) ? 
                    `${userData.faction.firstname} ${userData.faction.lastname}` : 
                    userData.faction.characterName;
                
                // Send webhook notification for GTAW login
                await sendAccountCreationWebhook({
                    name: characterName,
                    role: userData.faction.rank || 'Unknown',
                    userType: getUserTypeLabel(selectedUserType),
                    scriptRank: userData.faction.scriptRank,
                    action: 'gtaw_oauth_login'
                }, selectedUserType === USER_TYPES.CORONER);
                
                setLoggedIn(true);
                showNotification(`Successfully logged in via GTAW as ${characterName}!`, 'success');
                
                // Auto-progress to next step after successful login
                setTimeout(() => {
                    setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                }, 1500);
            } else {
                showNotification('GTAW login successful, but you are not a PHMC faction member. Proceeding with standard access.', 'warning');
                setLoggedIn(true);
                // Still allow progression for non-faction members
                setTimeout(() => {
                    setCurrentStep(ONBOARDING_STEPS.FORM_PREVIEW);
                }, 1500);
            }
        } catch (error) {
            console.error('Error during GTAW login:', error);
            showNotification(`Error during GTAW login: ${error.message}`, 'error');
        }
    };

    const getStepNumber = () => {
        const steps = [ONBOARDING_STEPS.WELCOME, ONBOARDING_STEPS.USER_TYPE, ONBOARDING_STEPS.ROLE_SPECIFIC, ONBOARDING_STEPS.FORM_PREVIEW, ONBOARDING_STEPS.PRIVACY_POLICY, ONBOARDING_STEPS.COMPLETE];
        const totalSteps = selectedUserType === USER_TYPES.PHMC_STAFF || selectedUserType === USER_TYPES.CORONER ? 6 : 5;
        let currentStepIndex = steps.indexOf(currentStep) + 1;
        
        // Adjust for skipped role step
        if ((selectedUserType !== USER_TYPES.PHMC_STAFF && selectedUserType !== USER_TYPES.CORONER) && currentStepIndex > 2) {
            currentStepIndex -= 1;
        }
        
        return { current: currentStepIndex, total: totalSteps };
    };

    if (!show) return null;

    const renderProgressBar = () => {
        const { current, total } = getStepNumber();
        const percentage = (current / total) * 100;

        return (
            <div style={progressContainerStyle}>
                <div style={progressBarStyle}>
                    <div style={{...progressFillStyle, width: `${percentage}%`}} />
                </div>
                <span style={progressTextStyle}>Step {current} of {total}</span>
            </div>
        );
    };

    const renderWelcomeStep = () => (
        <div style={stepContentStyle}>
            <div style={welcomeIconStyle}>
                <i className="fas fa-hand-wave" style={{fontSize: '3rem', color: '#007bff'}}></i>
            </div>
            <h2 style={stepTitleStyle}>Welcome to PHMC Forms!</h2>
            <p style={stepDescriptionStyle}>
                We're here to help you get started with the right forms for your needs. 
                This quick setup will customize your experience and show you the most relevant tools.
            </p>
            <div style={featureListStyle}>
                <div style={featureItemStyle}>
                    <i className="fas fa-check-circle" style={checkIconStyle}></i>
                    <span>Personalized form recommendations</span>
                </div>
                <div style={featureItemStyle}>
                    <i className="fas fa-check-circle" style={checkIconStyle}></i>
                    <span>Streamlined interface for your role</span>
                </div>
                <div style={featureItemStyle}>
                    <i className="fas fa-check-circle" style={checkIconStyle}></i>
                    <span>Quick access to frequently used forms</span>
                </div>
            </div>
            <p style={timeEstimateStyle}>
                <i className="fas fa-clock"></i> This should take less than 2 minutes
            </p>
        </div>
    );

    const renderUserTypeStep = () => (
        <div style={stepContentStyle}>
            <h2 style={stepTitleStyle}>What best describes your role?</h2>
            <p style={stepDescriptionStyle}>
                Select the option that best matches how you'll be using the forms system:
            </p>
            <div style={userTypeGridStyle}>
                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.CIVILIAN ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.CIVILIAN ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.CIVILIAN ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.CIVILIAN)}
                >
                    <i className="fas fa-user" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Civilian</h4>
                    <p style={userTypeButtonDescStyle}>
                        I need to submit a form on the forums (patient files, medical releases, etc.)
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.PHMC_STAFF ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.PHMC_STAFF ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.PHMC_STAFF ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.PHMC_STAFF)}
                >
                    <i className="fas fa-user-md" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>PHMC Staff</h4>
                    <p style={userTypeButtonDescStyle}>
                        I work at PHMC and create medical reports, consultations, and patient documentation
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.CORONER ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.CORONER ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.CORONER ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.CORONER)}
                >
                    <i className="fas fa-search" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Coroner</h4>
                    <p style={userTypeButtonDescStyle}>
                        I handle forensic services, death reports, autopsies, and coroner investigations
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.RECRUITMENT ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.RECRUITMENT ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.RECRUITMENT ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.RECRUITMENT)}
                >
                    <i className="fas fa-clipboard-user" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Job Applicant</h4>
                    <p style={userTypeButtonDescStyle}>
                        I'm applying for a position at PHMC (physician, nurse, admin, etc.)
                    </p>
                </button>

                <button
                    style={{
                        ...userTypeButtonStyle,
                        ...(selectedUserType === USER_TYPES.OTHER ? selectedButtonStyle : {}),
                        backgroundColor: selectedUserType === USER_TYPES.OTHER ? '#1a3a5c' : '#2a2a2a',
                        borderColor: selectedUserType === USER_TYPES.OTHER ? '#007bff' : '#444'
                    }}
                    onClick={() => setSelectedUserType(USER_TYPES.OTHER)}
                >
                    <i className="fas fa-question-circle" style={userTypeIconStyle}></i>
                    <h4 style={userTypeButtonTitleStyle}>Other/Multiple</h4>
                    <p style={userTypeButtonDescStyle}>
                        I use forms for multiple purposes or don't fit the above categories
                    </p>
                </button>
            </div>
        </div>
    );

    const renderRoleSpecificStep = () => {
        if (selectedUserType === USER_TYPES.PHMC_STAFF) {
            if (showAccountCreation) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Create Your PHMC Staff Account</h2>
                        <p style={stepDescriptionStyle}>
                            Fill in your details to create your staff account:
                        </p>
                        <div style={accountFormStyle}>
                            <div style={formRowStyle}>
                                <Form.Control
                                    type="text"
                                    name="firstName"
                                    value={accountData.firstName}
                                    onChange={handleAccountDataChange}
                                    placeholder="First Name *"
                                    style={formInputStyle}
                                />
                                <Form.Control
                                    type="text"
                                    name="lastName"
                                    value={accountData.lastName}
                                    onChange={handleAccountDataChange}
                                    placeholder="Last Name *"
                                    style={formInputStyle}
                                />
                            </div>
                            <Form.Control
                                type="text"
                                name="rank"
                                value={accountData.rank}
                                onChange={handleAccountDataChange}
                                placeholder="Rank/Position *"
                                style={formInputStyle}
                            />
                            <div style={accountActionsStyle}>
                                <Button 
                                    variant="outline-secondary" 
                                    onClick={() => setShowAccountCreation(false)}
                                    style={skipAccountButtonStyle}
                                >
                                    Skip Account Creation
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={handleCreateAccount}
                                    disabled={isCreatingAccount}
                                    style={createAccountButtonStyle}
                                >
                                    {isCreatingAccount ? 'Creating...' : 'Create Account'}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            }

            // Show login form for PHMC Staff
            if (showLogin) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Login to Your PHMC Staff Account</h2>
                        <p style={stepDescriptionStyle}>
                            Select your name from the list below:
                        </p>
                        
                        <div style={{margin: '20px 0'}}>
                            <Form.Group>
                                <Form.Label style={{fontWeight: 'bold', marginBottom: '10px'}}>
                                    Select Your Name:
                                </Form.Label>
                                <Form.Select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: '1px solid #ddd',
                                        fontSize: '16px'
                                    }}
                                >
                                    <option value="">Choose your name...</option>
                                    {phmcList && phmcList.map((employee, index) => (
                                        <option key={index} value={employee.name}>
                                            {employee.name} - {employee.category || employee.rank || 'PHMC Staff'}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </div>

                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px'}}>
                            <Button 
                                variant="secondary" 
                                onClick={() => setShowLogin(false)}
                                style={{padding: '10px 20px'}}
                            >
                                Back
                            </Button>
                            <Button 
                                variant="success" 
                                onClick={handleLogin}
                                disabled={!selectedEmployeeId || isLoggingIn}
                                style={{padding: '10px 20px'}}
                            >
                                {isLoggingIn ? 'Logging in...' : 'Login'}
                            </Button>
                        </div>
                    </div>
                );
            }

            return (
                <div style={stepContentStyle}>
                    <h2 style={stepTitleStyle}>What's your primary role at PHMC?</h2>
                    <p style={stepDescriptionStyle}>
                        This helps us show you the most relevant forms for your department:
                    </p>
                    <div style={roleGridStyle}>
                        {[
                            { id: 'physician', icon: 'fas fa-stethoscope', title: 'Physician', desc: 'Surgeon, ER Doctor, Specialist' },
                            { id: 'nurse', icon: 'fas fa-user-nurse', title: 'Nurse', desc: 'RN, LPN, Nurse Practitioner' },
                            { id: 'ems', icon: 'fas fa-ambulance', title: 'EMS', desc: 'Paramedic, EMT' },
                            { id: 'admin', icon: 'fas fa-clipboard-list', title: 'Administrator', desc: 'Management, Clerical, Support' },
                            { id: 'psych', icon: 'fas fa-brain', title: 'Mental Health', desc: 'Psychiatrist, Psychologist' },
                            { id: 'other', icon: 'fas fa-ellipsis-h', title: 'Other', desc: 'Multiple roles or other specialty' }
                        ].map(role => (
                            <button
                                key={role.id}
                                style={{
                                    ...roleButtonStyle,
                                    ...(selectedRole === role.id ? selectedButtonStyle : {}),
                                    backgroundColor: selectedRole === role.id ? '#1a3a5c' : '#2a2a2a',
                                    borderColor: selectedRole === role.id ? '#007bff' : '#444'
                                }}
                                onClick={() => setSelectedRole(role.id)}
                            >
                                <i className={role.icon} style={roleIconStyle}></i>
                                <h5 style={roleButtonTitleStyle}>{role.title}</h5>
                                <p style={roleButtonDescStyle}>{role.desc}</p>
                            </button>
                        ))}
                    </div>
                    <div style={accountPromptStyle}>
                        <p style={accountPromptTextStyle}>
                            <i className="fas fa-user-plus" style={promptIconStyle}></i>
                            Would you like to create a staff account, login with an existing one, or use GTAW OAuth?
                        </p>
                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'}}>
                            <Button 
                                variant="outline-primary" 
                                onClick={() => setShowAccountCreation(true)}
                                style={{
                                    borderColor: '#007bff',
                                    color: '#007bff',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#007bff';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#007bff';
                                }}
                            >
                                Create Staff Account
                            </Button>
                            <Button 
                                variant="outline-success" 
                                onClick={() => setShowLogin(true)}
                                style={{
                                    borderColor: '#28a745',
                                    color: '#28a745',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#28a745';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#28a745';
                                }}
                            >
                                Login
                            </Button>
                            <GtaWorldLoginButton
                                variant="outline-warning"
                                returnPath={window.location.hash || '#/'}
                                onSuccess={handleGtawLogin}
                                onError={(error) => showNotification(`GTAW Login failed: ${error}`, 'error')}
                                disabled={gtaLoading || isGtaAuthenticated}
                                style={{
                                    borderColor: '#ffc107',
                                    color: '#ffc107',
                                    backgroundColor: 'transparent'
                                }}
                            >
                                {isGtaAuthenticated ? (
                                    <>
                                        <i className="fas fa-check me-2"></i>
                                        GTAW Connected
                                    </>
                                ) : (
                                    <>
                                        <i className="fab fa-steam me-2"></i>
                                        Login with GTAW
                                    </>
                                )}
                            </GtaWorldLoginButton>
                        </div>
                    </div>
                </div>
            );
        }

        if (selectedUserType === USER_TYPES.CORONER) {
            if (showAccountCreation) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Create Your Coroner Account</h2>
                        <p style={stepDescriptionStyle}>
                            Fill in your details to create your coroner account:
                        </p>
                        <div style={accountFormStyle}>
                            <div style={formRowStyle}>
                                <Form.Control
                                    type="text"
                                    name="firstName"
                                    value={accountData.firstName}
                                    onChange={handleAccountDataChange}
                                    placeholder="Name *"
                                    style={formInputStyle}
                                />
                                <Form.Control
                                    type="text"
                                    name="discord"
                                    value={accountData.discord}
                                    onChange={handleAccountDataChange}
                                    placeholder="Discord Name *"
                                    style={formInputStyle}
                                />
                            </div>
                            <div style={formRowStyle}>
                                <Form.Control
                                    type="text"
                                    name="rank"
                                    value={accountData.rank}
                                    onChange={handleAccountDataChange}
                                    placeholder="Rank/Position *"
                                    style={formInputStyle}
                                />
                                <Form.Control
                                    type="text"
                                    name="badge"
                                    value={accountData.badge}
                                    onChange={handleAccountDataChange}
                                    placeholder="Badge Number *"
                                    style={formInputStyle}
                                />
                            </div>
                            <Form.Control
                                type="text"
                                name="phNumber"
                                value={accountData.phNumber}
                                onChange={handleAccountDataChange}
                                placeholder="PH Number (Optional)"
                                style={formInputStyle}
                            />
                            <div style={accountActionsStyle}>
                                <Button 
                                    variant="outline-secondary" 
                                    onClick={() => setShowAccountCreation(false)}
                                    style={skipAccountButtonStyle}
                                >
                                    Skip Account Creation
                                </Button>
                                <Button 
                                    variant="primary" 
                                    onClick={handleCreateAccount}
                                    disabled={isCreatingAccount}
                                    style={createAccountButtonStyle}
                                >
                                    {isCreatingAccount ? 'Creating...' : 'Create Account'}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            }

            // Show login form for Coroner
            if (showLogin) {
                return (
                    <div style={stepContentStyle}>
                        <h2 style={stepTitleStyle}>Login to Your Coroner Account</h2>
                        <p style={stepDescriptionStyle}>
                            Select your name from the list below:
                        </p>
                        
                        <div style={{margin: '20px 0'}}>
                            <Form.Group>
                                <Form.Label style={{fontWeight: 'bold', marginBottom: '10px'}}>
                                    Select Your Name:
                                </Form.Label>
                                <Form.Select 
                                    value={selectedEmployeeId}
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                    style={{
                                        padding: '10px',
                                        borderRadius: '5px',
                                        border: '1px solid #ddd',
                                        fontSize: '16px'
                                    }}
                                >
                                    <option value="">Choose your name...</option>
                                    {coronerList && coronerList.map((employee, index) => (
                                        <option key={index} value={employee.name}>
                                            {employee.name} - {employee.category || employee.rank || 'Coroner'}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </div>

                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px'}}>
                            <Button 
                                variant="secondary" 
                                onClick={() => setShowLogin(false)}
                                style={{padding: '10px 20px'}}
                            >
                                Back
                            </Button>
                            <Button 
                                variant="success" 
                                onClick={handleLogin}
                                disabled={!selectedEmployeeId || isLoggingIn}
                                style={{padding: '10px 20px'}}
                            >
                                {isLoggingIn ? 'Logging in...' : 'Login'}
                            </Button>
                        </div>
                    </div>
                );
            }

            return (
                <div style={stepContentStyle}>
                    <h2 style={stepTitleStyle}>Welcome, Coroner!</h2>
                    <p style={stepDescriptionStyle}>
                        Let's set up your access to the coroner forms and services:
                    </p>
                    <div style={coronerWelcomeStyle}>
                        <div style={coronerInfoCardStyle}>
                            <i className="fas fa-clipboard-check" style={coronerInfoIconStyle}></i>
                            <h4 style={coronerInfoTitleStyle}>Access to Forensic Forms</h4>
                            <p style={coronerInfoDescStyle}>Complete access to all coroner and forensic service forms</p>
                        </div>
                        <div style={coronerInfoCardStyle}>
                            <i className="fas fa-search" style={coronerInfoIconStyle}></i>
                            <h4 style={coronerInfoTitleStyle}>Investigation Tools</h4>
                            <p style={coronerInfoDescStyle}>Autopsy reports, death certificates, and case management</p>
                        </div>
                    </div>
                    <div style={accountPromptStyle}>
                        <p style={accountPromptTextStyle}>
                            <i className="fas fa-user-plus" style={promptIconStyle}></i>
                            Would you like to create a coroner account, login with an existing one, or use GTAW OAuth?
                        </p>
                        <div style={{display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'}}>
                            <Button 
                                variant="outline-primary" 
                                onClick={() => setShowAccountCreation(true)}
                                style={{
                                    borderColor: '#007bff',
                                    color: '#007bff',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#007bff';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#007bff';
                                }}
                            >
                                Create Coroner Account
                            </Button>
                            <Button 
                                variant="outline-success" 
                                onClick={() => setShowLogin(true)}
                                style={{
                                    borderColor: '#28a745',
                                    color: '#28a745',
                                    backgroundColor: 'transparent'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = '#28a745';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                    e.target.style.color = '#28a745';
                                }}
                            >
                                Login
                            </Button>
                            <GtaWorldLoginButton
                                variant="outline-warning"
                                returnPath={window.location.hash || '#/'}
                                onSuccess={handleGtawLogin}
                                onError={(error) => showNotification(`GTAW Login failed: ${error}`, 'error')}
                                disabled={gtaLoading || isGtaAuthenticated}
                                style={{
                                    borderColor: '#ffc107',
                                    color: '#ffc107',
                                    backgroundColor: 'transparent'
                                }}
                            >
                                {isGtaAuthenticated ? (
                                    <>
                                        <i className="fas fa-check me-2"></i>
                                        GTAW Connected
                                    </>
                                ) : (
                                    <>
                                        <i className="fab fa-steam me-2"></i>
                                        Login with GTAW
                                    </>
                                )}
                            </GtaWorldLoginButton>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    const renderFormPreviewStep = () => (
        <div style={stepContentStyle}>
            <h2 style={stepTitleStyle}>Here are your recommended forms</h2>
            <p style={stepDescriptionStyle}>
                Based on your selection, these forms will be prioritized in your interface:
            </p>
            <div style={formPreviewGridStyle}>
                {recommendedForms.slice(0, 6).map(form => (
                    <div key={form.version} style={formPreviewCardStyle}>
                        <div style={formPreviewIconStyle}>
                            <img src={form.icon} alt={form.name} style={formIconImageStyle} />
                        </div>
                        <h5 style={formPreviewTitleStyle}>{form.name}</h5>
                        <p style={formPreviewDescStyle}>Version {form.version}</p>
                    </div>
                ))}
            </div>
            {recommendedForms.length > 6 && (
                <p style={moreFormsTextStyle}>
                    + {recommendedForms.length - 6} more forms available for your role
                </p>
            )}
            <div style={previewNoteStyle}>
                <i className="fas fa-info-circle" style={noteIconStyle}></i>
                <span>You can always access all forms through the form selector, but these will be highlighted for quick access.</span>
            </div>
        </div>
    );

    const renderPrivacyPolicyStep = () => (
        <div style={stepContentStyle}>
            <div style={privacyIconStyle}>
                <i className="fas fa-shield-alt" style={{fontSize: '3rem', color: '#007bff'}}></i>
            </div>
            <h2 style={stepTitleStyle}>Privacy Policy</h2>
            <p style={stepDescriptionStyle}>
                Please review our privacy policy before completing your setup.
            </p>
            <div style={privacyContentStyle}>
                <div style={privacyPolicyBoxStyle}>
                    <p>This policy covers the use of PHMC Tools and complies with the <a href="https://gta.world/terms/" target="_blank" rel="noopener noreferrer" style={linkStyle}>GTA World Privacy Policy</a>.</p>
                    <p>This website processes <strong>IN CHARACTER</strong> information for the usage of Pillbox Hill Medical Center (A GTA World Faction)</p>
                    <p>We are in full compliance of the <a href="https://forum.gta.world/en/topic/141256-gta-world-website-regulations-last-update-march-1st-2025/" target="_blank" rel="noopener noreferrer" style={linkStyle}>GTA World Regulations</a> by hosting this website on GTA World Servers and code is vetted by GTAW Developers.</p>
                    <p>
                        We utilize tools from third party providers: 
                        <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" style={linkStyle}> Sentry</a> (Error Tracking) and 
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}> Google Firebase</a> (Report Saving).
                    </p>
                    <p><strong>We collect the following data:</strong></p>
                    <ul style={privacyListStyle}>
                        <li>Firebase only stores Saved Reports, Dropdown Fields and Employee Names</li>
                        <li>Error Logs Device Information (Mobile / Desktop / Tablet), related error file and button pressed.</li>
                        <li>Only myself and Everett can view the Error Logs and the Firebase Database.</li>
                    </ul>
                    <p>We do not share your data with any third parties except for the third party providers mentioned above.</p>
                    <p><strong>Questions:</strong> Ask in the PHMC Discord Server.</p>
                </div>
            </div>
        </div>
    );

    const renderCompleteStep = () => (
        <div style={stepContentStyle}>
            <div style={completeIconStyle}>
                <i className="fas fa-check-circle" style={{fontSize: '4rem', color: '#28a745'}}></i>
            </div>
            <h2 style={stepTitleStyle}>You're all set!</h2>
            <p style={stepDescriptionStyle}>
                Your interface has been customized for your role. You can change these preferences anytime from the Tools menu.
            </p>
            <div style={summaryBoxStyle}>
                <h4 style={summaryTitleStyle}>Your Setup Summary:</h4>
                <div style={summaryItemStyle}>
                    <strong>Role:</strong> {getUserTypeLabel(selectedUserType)}
                    {selectedRole && ` (${getRoleLabel(selectedRole)})`}
                </div>
                <div style={summaryItemStyle}>
                    <strong>Primary Forms:</strong> {recommendedForms.length} forms recommended
                </div>
                <div style={summaryItemStyle}>
                    <strong>Available Categories:</strong> {FORM_CATEGORIES[selectedUserType]?.join(', ') || 'All categories'}
                </div>
            </div>
        </div>
    );

    const getUserTypeLabel = (userType) => {
        const labels = {
            [USER_TYPES.CIVILIAN]: 'Civilian',
            [USER_TYPES.PHMC_STAFF]: 'PHMC Staff',
            [USER_TYPES.CORONER]: 'Coroner',
            [USER_TYPES.RECRUITMENT]: 'Job Applicant',
            [USER_TYPES.OTHER]: 'Multiple Roles'
        };
        return labels[userType] || 'Unknown';
    };

    const getRoleLabel = (role) => {
        const labels = {
            physician: 'Physician',
            nurse: 'Nurse',
            ems: 'EMS',
            admin: 'Administrator',
            psych: 'Mental Health',
            investigator: 'Investigator',
            examiner: 'Medical Examiner',
            supervisor: 'Supervisor',
            other: 'Other'
        };
        return labels[role] || role;
    };

    const canProceed = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                return true;
            case ONBOARDING_STEPS.USER_TYPE:
                return selectedUserType !== null;
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                if (selectedUserType === USER_TYPES.PHMC_STAFF) {
                    return selectedRole !== null || showAccountCreation || (showLogin && selectedEmployeeId) || accountCreated || loggedIn;
                }
                if (selectedUserType === USER_TYPES.CORONER) {
                    return true || showAccountCreation || (showLogin && selectedEmployeeId) || accountCreated || loggedIn;
                }
                return selectedRole !== null;
            case ONBOARDING_STEPS.FORM_PREVIEW:
                return true;
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                return true;
            case ONBOARDING_STEPS.COMPLETE:
                return true;
            default:
                return false;
        }
    };

    const getNextButtonText = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                return "Let's Get Started";
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                return "Accept & Continue";
            case ONBOARDING_STEPS.COMPLETE:
                return "Start Using Forms";
            default:
                return "Continue";
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case ONBOARDING_STEPS.WELCOME:
                return renderWelcomeStep();
            case ONBOARDING_STEPS.USER_TYPE:
                return renderUserTypeStep();
            case ONBOARDING_STEPS.ROLE_SPECIFIC:
                return renderRoleSpecificStep();
            case ONBOARDING_STEPS.FORM_PREVIEW:
                return renderFormPreviewStep();
            case ONBOARDING_STEPS.PRIVACY_POLICY:
                return renderPrivacyPolicyStep();
            case ONBOARDING_STEPS.COMPLETE:
                return renderCompleteStep();
            default:
                return null;
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    {renderProgressBar()}
                    <button style={skipButtonStyle} onClick={handleSkip} title="Skip onboarding">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                
                <div style={contentStyle}>
                    {renderStepContent()}
                </div>

                <div style={footerStyle}>
                    {currentStep !== ONBOARDING_STEPS.WELCOME && (
                        <Button 
                            variant="outline-secondary" 
                            onClick={handleBack}
                            style={backButtonStyle}
                        >
                            <i className="fas fa-arrow-left"></i> Back
                        </Button>
                    )}
                    
                    <div style={footerRightStyle}>
                        <Button 
                            variant="primary" 
                            onClick={handleNext}
                            disabled={!canProceed()}
                            style={nextButtonStyle}
                        >
                            {getNextButtonText()} <i className="fas fa-arrow-right"></i>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Styles
const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1070,
    padding: '20px'
};

const modalStyle = {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    borderRadius: '12px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
};

const headerStyle = {
    padding: '20px 20px 0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
};

const progressContainerStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
};

const progressBarStyle = {
    flex: 1,
    height: '6px',
    backgroundColor: '#333',
    borderRadius: '3px',
    overflow: 'hidden'
};

const progressFillStyle = {
    height: '100%',
    backgroundColor: '#007bff',
    transition: 'width 0.3s ease'
};

const progressTextStyle = {
    fontSize: '0.85rem',
    color: '#ccc',
    whiteSpace: 'nowrap'
};

const skipButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#ccc',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '5px',
    borderRadius: '4px',
    transition: 'color 0.2s ease'
};

const contentStyle = {
    padding: '20px',
    flex: 1,
    overflow: 'auto'
};

const stepContentStyle = {
    textAlign: 'center'
};

const welcomeIconStyle = {
    marginBottom: '20px'
};

const stepTitleStyle = {
    fontSize: '2rem',
    marginBottom: '15px',
    color: '#ffffff'
};

const stepDescriptionStyle = {
    fontSize: '1.1rem',
    color: '#ccc',
    marginBottom: '30px',
    lineHeight: '1.5'
};

const featureListStyle = {
    textAlign: 'left',
    maxWidth: '400px',
    margin: '0 auto 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
};

const featureItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
};

const checkIconStyle = {
    color: '#28a745',
    fontSize: '1.1rem'
};

const timeEstimateStyle = {
    color: '#aaa',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px'
};

const userTypeGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '15px',
    maxWidth: '900px',
    margin: '0 auto'
};

const userTypeButtonStyle = {
    background: '#2a2a2a',
    border: '2px solid #444',
    borderRadius: '8px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    color: '#fff',
    '&:hover': {
        borderColor: '#666',
        backgroundColor: '#333'
    }
};

const selectedButtonStyle = {
    borderColor: '#007bff !important',
    backgroundColor: '#1a3a5c !important',
    boxShadow: '0 0 0 2px rgba(0, 123, 255, 0.25)',
    color: '#fff !important'
};

const userTypeIconStyle = {
    fontSize: '2.5rem',
    color: '#007bff',
    marginBottom: '15px'
};

const userTypeButtonTitleStyle = {
    fontSize: '1.3rem',
    marginBottom: '10px',
    color: '#fff'
};

const userTypeButtonDescStyle = {
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.4',
    margin: 0
};

const roleGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    maxWidth: '700px',
    margin: '0 auto'
};

const roleButtonStyle = {
    background: '#2a2a2a',
    border: '2px solid #444',
    borderRadius: '8px',
    padding: '15px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    color: '#fff',
    '&:hover': {
        borderColor: '#666',
        backgroundColor: '#333'
    }
};

const roleIconStyle = {
    fontSize: '2rem',
    color: '#007bff',
    marginBottom: '10px'
};

const roleButtonTitleStyle = {
    fontSize: '1.1rem',
    marginBottom: '8px',
    color: '#fff'
};

const roleButtonDescStyle = {
    fontSize: '0.8rem',
    color: '#ccc',
    lineHeight: '1.3',
    margin: 0
};

const formPreviewGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '15px',
    maxWidth: '600px',
    margin: '0 auto 20px'
};

const formPreviewCardStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '15px',
    textAlign: 'center'
};

const formPreviewIconStyle = {
    marginBottom: '10px'
};

const formIconImageStyle = {
    width: '40px',
    height: '40px',
    objectFit: 'contain'
};

const formPreviewTitleStyle = {
    fontSize: '0.9rem',
    marginBottom: '5px',
    color: '#fff'
};

const formPreviewDescStyle = {
    fontSize: '0.8rem',
    color: '#ccc',
    margin: 0
};

const moreFormsTextStyle = {
    color: '#aaa',
    fontSize: '0.9rem',
    marginTop: '10px'
};

const previewNoteStyle = {
    background: '#2a3a2a',
    borderRadius: '6px',
    padding: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '20px',
    fontSize: '0.9rem',
    color: '#ccc'
};

const noteIconStyle = {
    color: '#17a2b8',
    fontSize: '1.1rem'
};

const completeIconStyle = {
    marginBottom: '20px'
};

const summaryBoxStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'left',
    maxWidth: '500px',
    margin: '0 auto'
};

const summaryTitleStyle = {
    color: '#fff',
    marginBottom: '15px'
};

const summaryItemStyle = {
    marginBottom: '10px',
    color: '#ccc'
};

const footerStyle = {
    padding: '20px',
    borderTop: '1px solid #444',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const footerRightStyle = {
    marginLeft: 'auto'
};

const backButtonStyle = {
    marginRight: '10px'
};

const nextButtonStyle = {
    minWidth: '120px'
};

// Account creation styles
const accountFormStyle = {
    maxWidth: '500px',
    margin: '0 auto',
    textAlign: 'left'
};

const formRowStyle = {
    display: 'flex',
    gap: '15px',
    marginBottom: '15px'
};

const formInputStyle = {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '15px'
};

const accountActionsStyle = {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginTop: '20px'
};

const skipAccountButtonStyle = {
    borderColor: '#6c757d',
    color: '#6c757d'
};

const createAccountButtonStyle = {
    backgroundColor: '#007bff',
    borderColor: '#007bff'
};

const accountPromptStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '30px',
    textAlign: 'center'
};

const accountPromptTextStyle = {
    color: '#ccc',
    marginBottom: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
};

const promptIconStyle = {
    color: '#007bff',
    fontSize: '1.1rem'
};

const coronerWelcomeStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
};

const coronerInfoCardStyle = {
    background: '#2a2a2a',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center'
};

const coronerInfoIconStyle = {
    fontSize: '2.5rem',
    color: '#007bff',
    marginBottom: '15px'
};

const coronerInfoTitleStyle = {
    fontSize: '1.2rem',
    marginBottom: '10px',
    color: '#fff'
};

const coronerInfoDescStyle = {
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.4',
    margin: 0
};

const privacyIconStyle = {
    fontSize: '3rem',
    color: '#17a2b8',
    marginBottom: '20px'
};

const privacyContentStyle = {
    textAlign: 'left',
    color: '#f8f9fa',
    maxHeight: '400px',
    overflowY: 'auto',
    backgroundColor: '#2c3e50',
    border: '1px solid #495057',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
};

const privacyPolicyBoxStyle = {
    backgroundColor: '#2c3e50',
    border: '1px solid #495057',
    borderRadius: '4px',
    padding: '15px',
    margin: '10px 0',
    color: '#f8f9fa'
};

const linkStyle = {
    color: '#17a2b8',
    textDecoration: 'none'
};

const privacyListStyle = {
    color: '#e9ecef',
    paddingLeft: '20px',
    marginBottom: '15px'
};

export default OnboardingModal;