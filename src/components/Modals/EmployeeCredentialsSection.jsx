import React, { useEffect, useState } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { refreshFactionData as refreshFactionDataService, STORAGE_KEYS } from '../../services/gtaWorldAuth';
import { cleanRankText } from '../../utils/textUtils';
import { getCharacterName, getCharacterID } from '../../utils/characterUtils';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { GtaAuthLoading } from '../Auth/GtaCallback';

/**
 * EmployeeCredentialsSection (Refined & Sidebar Optimized)
 * - Removed Bootstrap Row/Col to prevent negative margin overflow
 * - Modern flex-based grid for profile details
 * - Descriptive labels under action buttons
 * - Fixed innerText crash by using state-based image fallback
 */
const EmployeeCredentialsSection = ({
  formData,
  setFormData,
  selectedEmployee,
  setSelectedEmployee,
  groupedOptions,
  handleSelectChange,
  setShowEmployeeModal,
  employeeType = 'coroner',
  showNotification,
  context,
  persistEnabled: propPersistEnabled,
  setPersistEnabled: propSetPersistEnabled,
  // Auth props passed from parent
  user: propUser,
  isAuthenticated: propIsAuthenticated,
  isPhmcMember: propIsPhmcMember,
  canSwapCharacters: propCanSwapCharacters,
  swapCharacter: propSwapCharacter,
  swappableCharacters: propSwappableCharacters,
  factionData: propFactionData,
  updateFactionData: propUpdateFactionData,
  triggerFactionSync: propTriggerFactionSync,
  login: propLogin,
  logout: propLogout
}) => {
  const authHook = useGtaWorldAuth();
  const { showNotification: notifyFromContext } = useNotification?.() || {};

  const gtaWorldUser = propUser !== undefined ? propUser : authHook.user;
  const isGtaAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : authHook.isAuthenticated;
  const canSwapCharacters = propCanSwapCharacters !== undefined ? propCanSwapCharacters : authHook.canSwapCharacters;
  const swapCharacter = propSwapCharacter || authHook.swapCharacter;
  const swappableCharacters = propSwappableCharacters || authHook.swappableCharacters;
  const factionData = propFactionData !== undefined ? propFactionData : authHook.factionData;
  const updateFactionData = propUpdateFactionData || authHook.updateFactionData;
  const triggerFactionSync = propTriggerFactionSync || authHook.triggerFactionSync;
  const login = propLogin || authHook.login;
  const logout = propLogout || authHook.logout;
  const isLoading = authHook.isLoading;

  const [useGtawName, setUseGtawName] = useState(false);
  const [internalPersistEnabled, setInternalPersistEnabled] = useState(() => localStorage.getItem('phmc_gtaw_oauth_persist_enabled') === 'true');

  const persistEnabled = propPersistEnabled !== undefined ? propPersistEnabled : internalPersistEnabled;
  const setSetPersistEnabled = propSetPersistEnabled !== undefined ? propSetPersistEnabled : setInternalPersistEnabled;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isCivilianForm = typeof context === 'string' && context.startsWith('[Civilian]');
  const isDevelopmentEnvironment = window.location.hostname === 'localhost';

  const gtawCharacterName = factionData?.characterName || getCharacterName(gtaWorldUser);

  // Sync OAuth character to selectedEmployee if not set
  useEffect(() => {
    if (isGtaAuthenticated && gtawCharacterName && gtawCharacterName !== 'GTAW User') {
      const currentEmployeeValue = typeof selectedEmployee === 'object' ? selectedEmployee?.value : selectedEmployee;
      if (!currentEmployeeValue || currentEmployeeValue !== gtawCharacterName) {
        if (typeof setSelectedEmployee === 'function') {
          setSelectedEmployee({ value: gtawCharacterName, label: gtawCharacterName });
        }
      }
    }
  }, [isGtaAuthenticated, gtawCharacterName, selectedEmployee, setSelectedEmployee]);

  // Reset imgError when character name changes
  useEffect(() => {
    setImgError(false);
  }, [gtawCharacterName]);

  const togglePersistence = () => {
    const newValue = !persistEnabled;
    setSetPersistEnabled(newValue);
    localStorage.setItem('phmc_gtaw_oauth_persist_enabled', newValue ? 'true' : 'false');
    localStorage.setItem('seenKeepCredentialsPrompt', 'true');
    
    const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      if (newValue) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
    }
    
    const notify = showNotification || notifyFromContext;
    notify && notify(newValue ? 'Session will persist.' : 'Session will end on close.', 'info-circle', 3000);
  };

  const handleUpdateDiscord = () => {
    if (!isGtaAuthenticated) return;
    const charId = factionData?.characterId || getCharacterID(gtaWorldUser);
    if (charId) {
        sessionStorage.removeItem(`discord_check_asked_${charId}`);
        sessionStorage.setItem('force_discord_check', 'true');
        
        // Dispatch custom event to trigger the DiscordNameCheck component
        window.dispatchEvent(new CustomEvent('trigger_discord_check'));
        
        // Trigger a re-render of the parent tree to catch the session storage change
        setUseGtawName(prev => !prev);
        setTimeout(() => setUseGtawName(prev => !prev), 10);
    }
  };

  const handleRefreshFactionInfo = async () => {
    const notify = showNotification || notifyFromContext;
    if (!isGtaAuthenticated) return;
    try {
      setIsRefreshing(true);
      
      // Step 1: Trigger Faction Sync (RTDB -> GtaWorld API)
      if (typeof triggerFactionSync === 'function') {
        try {
          await triggerFactionSync();
        } catch (syncErr) {
          // If it's a permission error (e.g., Only Super Admins can manually trigger a sync), 
          // we just log it and proceed to Step 2 to at least refresh local data.
          console.warn('[EmployeeCredentialsSection] Background sync skipped or failed:', syncErr.message);
        }
      }

      // Step 2: Refresh Faction Data (Local State -> RTDB)
      const updated = await refreshFactionDataService();
      if (updated && updated.faction) {
        updateFactionData(updated.faction);
        notify && notify('Profile refreshed.', 'check-circle', 3000);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
      notify && notify('Refresh failed.', 'exclamation-triangle', 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwap = async () => {
    if (!isGtaAuthenticated || !canSwapCharacters) return;
    const notify = showNotification || notifyFromContext;

    if (swappableCharacters.length >= 2) {
        const getCharId = (c) => c?.character?.characterId ?? c?.id ?? null;
        const currentId = factionData?.characterId || getCharacterID(gtaWorldUser);
        const currentIndex = swappableCharacters.findIndex(c => getCharId(c) === currentId);
        const nextIndex = (currentIndex + 1) % swappableCharacters.length;
        const nextCharacter = swappableCharacters[nextIndex];

        if (nextCharacter) {
            swapCharacter(nextCharacter);
            notify && notify(`Swapped character.`, 'success', 3000);
        }
    }
  };

  useEffect(() => {
    if (isGtaAuthenticated && gtaWorldUser && !useGtawName && !isCivilianForm) {
      const charName = getCharacterName(gtaWorldUser);
      if (charName && charName !== 'GTAW User') setUseGtawName(true);
    }
  }, [isGtaAuthenticated, gtaWorldUser, useGtawName, isCivilianForm]);

  if (isLoading && !isGtaAuthenticated && !isDevelopmentEnvironment) {
    return <GtaAuthLoading isMini={true} />;
  }

  if (!isGtaAuthenticated && !isDevelopmentEnvironment && !isCivilianForm) {
      return (
        <div style={{ padding: '1.5rem', background: '#162032', borderRadius: '12px', textAlign: 'center', border: '1px solid #334155' }}>
            <i className="fas fa-lock mb-3" style={{ fontSize: '2rem', color: '#60a5fa' }}></i>
            <h5 style={{ color: '#f8fafc' }}>Auth Required</h5>
            <button onClick={() => login({ returnPath: window.location.hash || '#/' })} className="btn btn-primary mt-3 w-100">
                Log In
            </button>
        </div>
      );
  }

  const labelStyle = { 
    fontSize: '0.6rem', 
    color: '#94a3b8', 
    marginTop: '4px', 
    textTransform: 'uppercase', 
    fontWeight: '700',
    textAlign: 'center'
  };

  return (
    <div className="employee-credentials-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        {isGtaAuthenticated && (
            <Badge bg={persistEnabled ? "success" : "secondary"} style={{ cursor: 'pointer' }} onClick={togglePersistence}>
                {persistEnabled ? "Saved" : "Not Saved"}
            </Badge>
        )}
      </div>

      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem', overflow: 'hidden' }}>
        {/* Profile Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ 
                width: '56px', height: '56px', borderRadius: '50%', 
                background: '#1e293b', 
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '1.25rem', fontWeight: 'bold',
                overflow: 'hidden',
                border: '2px solid #3b82f6',
                flexShrink: 0
            }}>
                {((gtawCharacterName || isDevelopmentEnvironment) && !imgError) ? (
                    <img 
                        src={`https://cad.gta.world/img/persons/${isDevelopmentEnvironment ? 'Alyson_Frost' : gtawCharacterName.replace(/\s+/g, '_')}.png?${Date.now()}`}
                        alt={gtawCharacterName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span>{gtawCharacterName ? gtawCharacterName.charAt(0).toUpperCase() : '?'}</span>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gtawCharacterName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '8px' }}>
                    <span>ID: {factionData?.characterId || gtaWorldUser?.id || 'N/A'}</span>
                </div>
            </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, background: '#1e293b', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', minWidth: 0 }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Department</div>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <i className="fas fa-building me-1 text-primary"></i>
                    {(() => {
                        const rank = factionData?.rank?.toLowerCase() || '';
                        if (rank.includes('medical examiner') || rank.includes('forensic attendant') || rank.includes('coroner investigator')) {
                            return 'Forensic Science';
                        }
                        return 'PHMC Staff';
                    })()}
                </div>
            </div>
            <div style={{ flex: 1, background: '#1e293b', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Rank</div>
                <div style={{ color: '#e2e8f0', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <i className="fas fa-id-badge me-1 text-info"></i>
                    {factionData?.rank ? cleanRankText(factionData.rank) : 'N/A'}
                </div>
            </div>
        </div>

        {/* Action Buttons with Labels */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Button variant="outline-info" size="sm" onClick={handleRefreshFactionInfo} disabled={isRefreshing} style={{ width: '100%' }}>
                    <i className={`fas ${isRefreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
                </Button>
                <div style={labelStyle}>Reload</div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Button variant="outline-info" size="sm" onClick={handleUpdateDiscord} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg 
                        width="16" 
                        height="16" 
                        viewBox="0 0 24 24" 
                        fill="currentColor" 
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1971.3728.2914a.077.077 0 01-.0066.1277 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                    </svg>
                </Button>
                <div style={labelStyle}>Discord</div>
            </div>
            
            {canSwapCharacters && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Button variant="outline-primary" size="sm" onClick={handleSwap} style={{ width: '100%' }}>
                        <i className="fas fa-exchange-alt"></i>
                    </Button>
                    <div style={labelStyle}>Swap</div>
                </div>
            )}
            
            <div style={{ flex: 0, display: 'flex', flexDirection: 'column', minWidth: '40px' }}>
                <Button variant="outline-danger" size="sm" onClick={() => logout()} style={{ width: '100%' }} title="Sign Out">
                    <i className="fas fa-sign-out-alt"></i>
                </Button>
                <div style={labelStyle}>Exit</div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCredentialsSection;
