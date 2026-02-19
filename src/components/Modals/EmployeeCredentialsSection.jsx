import React, { useEffect, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { refreshFactionData as refreshFactionDataService, STORAGE_KEYS } from '../../services/gtaWorldAuth';
import { cleanRankText } from '../../utils/textUtils';
import { getCharacterName, getCharacterID } from '../../utils/characterUtils';
import { database } from '../../firebase';
import { ref, update } from 'firebase/database';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { sendDiscordWebhook } from '../../utils/webhookUtils';

/**
 * EmployeeCredentialsSection (Universal)
 * - Provides GTAW OAuth autofill, saved profile usage, and manual selection (dev)
 * - Intended to be reused across any form that needs an employee selector
 */
const EmployeeCredentialsSection = ({
  formData,
  setFormData,
  groupedOptions,
  handleSelectChange,
  setShowEmployeeModal,
  employeeType = 'coroner',
  showNotification,
  context,
  persistEnabled: propPersistEnabled,
  setPersistEnabled: propSetPersistEnabled,
}) => {
  const {
    user: gtaWorldUser,
    isAuthenticated: isGtaAuthenticated,
    isPhmcMember,
    canSwapCharacters,
    swapCharacter,
    swappableCharacters,
    factionData,
    updateFactionData,
  } = useGtaWorldAuth();
  const { showNotification: notifyFromContext } = useNotification?.() || {};

  const [useGtawName, setUseGtawName] = useState(false);
  const [showFloatingText, setShowFloatingText] = useState(false);
  const [internalPersistEnabled, setInternalPersistEnabled] = useState(() => localStorage.getItem('phmc_gtaw_oauth_persist_enabled') === 'true');

  const persistEnabled = propPersistEnabled !== undefined ? propPersistEnabled : internalPersistEnabled;
  const setPersistEnabled = propSetPersistEnabled !== undefined ? propSetPersistEnabled : setInternalPersistEnabled;

  const hasShownFloatingTextRef = React.useRef(false);
  const lastUserRef = React.useRef(null);

  const togglePersistence = () => {
    const newValue = !persistEnabled;
    setPersistEnabled(newValue);
    localStorage.setItem('phmc_gtaw_oauth_persist_enabled', newValue ? 'true' : 'false');
    
    // Update token storage immediately
    const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      if (newValue) {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
    }
    
    (showNotification || notifyFromContext) && (showNotification || notifyFromContext)(
      newValue ? 'Session will persist across visits.' : 'Session will end when you close the browser.', 
      'info-circle', 
      3000
    );
  };

  // Effect 1: Determine if we should show the floating text
  useEffect(() => {
    if (isGtaAuthenticated && gtaWorldUser) {
      if (lastUserRef.current !== gtaWorldUser.id) {
          hasShownFloatingTextRef.current = false;
          lastUserRef.current = gtaWorldUser.id;
      }

      if (hasShownFloatingTextRef.current) return;

      const characterName = getCharacterName(gtaWorldUser);
      const allOptions = groupedOptions?.flatMap(group => group.options || []) || [];
      if (allOptions.length === 0) return; 

      const isFoundInDb = allOptions.some(opt => opt.value.toLowerCase() === characterName.toLowerCase());

      if (!isPhmcMember || !isFoundInDb) {
        setShowFloatingText(true);
        hasShownFloatingTextRef.current = true;
      }
    }
  }, [isGtaAuthenticated, gtaWorldUser, isPhmcMember, groupedOptions]);

  // Effect 2: Handle the timer for the floating text
  useEffect(() => {
      if (showFloatingText) {
          const timer = setTimeout(() => setShowFloatingText(false), 10000);
          return () => clearTimeout(timer);
      }
  }, [showFloatingText]);

  const handleNewEmployeeClick = async () => {
    setShowFloatingText(false);
    
    const webhookUrl = import.meta.env.VITE_DISCORD_WEBHOOK_AUTH || import.meta.env.VITE_DEV_WEBHOOK;
    if (webhookUrl) {
        const payload = {
            embeds: [{
                title: "🚨 Missing from Database Report",
                color: 0xFFAA00,
                fields: [
                    { name: "Character Name", value: factionData?.characterName || getCharacterName(gtaWorldUser) || "Unknown", inline: true },
                    { name: "UCP Username", value: gtaWorldUser?.username || "Unknown", inline: true },
                    { name: "Issue", value: "User is missing from Database", inline: false },
                    { name: "Source", value: "New Employee Button Click", inline: true }
                ],
                timestamp: new Date().toISOString()
            }]
        };
        try {
            await sendDiscordWebhook(webhookUrl, payload);
            (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Please notify Alyson Frost in the PHMC Discord!', 'success');
        } catch (e) {
            console.error("Failed to send missing name webhook", e);
        }
    }
    
    setShowEmployeeModal(true);
  };

  const employeeNameField = `${employeeType}Employee`;
  const employeeBadgeField = `${employeeType}Badge`;
  const employeeRankField = `${employeeType}Rank`;
  const employeePHNumberField = `${employeeType}PHNumber`;

  const isCivilianForm = typeof context === 'string' && context.startsWith('[Civilian]');

  const isDevelopmentEnvironment =
    window.location.hostname === 'localhost' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

  useEffect(() => {
    if (isGtaAuthenticated && gtaWorldUser && !useGtawName && !isCivilianForm) {
      const gtawCharacterName = getCharacterName(gtaWorldUser);
      if (gtawCharacterName && gtawCharacterName !== 'GTAW User') {
        setUseGtawName(true);
        const cleanRank = gtaWorldUser?.faction?.rank
          ? cleanRankText(gtaWorldUser.faction.rank)
          : 'GTAW User';
        const characterId = getCharacterID(gtaWorldUser);
        setFormData(prev => ({
          ...prev,
          [employeeNameField]: gtawCharacterName,
          [employeeBadgeField]: characterId,
          [employeeRankField]: cleanRank,
          [employeePHNumberField]: '50056',
        }));
      }
    }
  }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeePHNumberField, isCivilianForm]);

  useEffect(() => {
    if (useGtawName && isGtaAuthenticated && gtaWorldUser && factionData && !isCivilianForm) {
      if (!factionData.characterName) return;

      const cleanRank = factionData.rank ? cleanRankText(factionData.rank) : 'GTAW User';
      setFormData(prev => ({
        ...prev,
        [employeeNameField]: factionData.characterName,
        [employeeBadgeField]: factionData.characterId || '',
        [employeeRankField]: cleanRank,
        [employeePHNumberField]: '50056',
      }));
    }
  }, [factionData, useGtawName, isGtaAuthenticated, gtaWorldUser, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeePHNumberField, isCivilianForm]);

  const gtawCharacterName = factionData?.characterName || null;

  const handleSwap = () => {
    if (!canSwapCharacters || !factionData || !swappableCharacters || swappableCharacters.length < 2) return;
    const getCharId = (c) => c?.character?.characterId ?? c?.id ?? null;
    const validCharacters = swappableCharacters.filter(c => getCharId(c) !== null);
    if (validCharacters.length < 2) return;

    const currentIndex = validCharacters.findIndex(c => getCharId(c) === factionData.characterId);
    const nextIndex = (currentIndex + 1) % validCharacters.length;
    const nextCharacter = validCharacters[nextIndex];

    if (nextCharacter) swapCharacter(nextCharacter);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshFactionInfo = async () => {
    if (!isGtaAuthenticated) {
      (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Please log out and back in to refresh.', 'info-circle', 4000);
      return;
    }
    try {
      setIsRefreshing(true);
      (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Refreshing PHMC permissions...', 'info-circle', 3000);
      const updated = await refreshFactionDataService();
      if (updated && updated.faction) {
        updateFactionData(updated.faction);
        if (useGtawName) {
          const cleanRank = updated.faction.rank ? cleanRankText(updated.faction.rank) : updated.faction.scriptRank || '';
          setFormData(prev => ({
            ...prev,
            [employeeNameField]: updated.faction.characterName || prev[employeeNameField],
            [employeeBadgeField]: updated.faction.characterId || prev[employeeBadgeField],
            [employeeRankField]: cleanRank || prev[employeeRankField],
            [employeePHNumberField]: '50056',
          }));
        }
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Permissions refreshed.', 'check-circle', 3500);
      }
    } catch (err) {
      console.warn('[EmployeeCredentialsSection] Refresh failed:', err);
      (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Unable to refresh rank.', 'exclamation-triangle', 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <label style={{ margin: 0, fontWeight: "600", color: "#94a3b8", fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05rem' }}>
          Employee Information
        </label>
        
        <div style={{ display: 'flex', gap: '8px' }}>
            {isGtaAuthenticated && gtawCharacterName && !isCivilianForm && (
                <button
                    type="button"
                    onClick={() => setUseGtawName(!useGtawName)}
                    className={`btn btn-sm ${useGtawName ? 'btn-success' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '20px' }}
                >
                    <i className={`fas ${useGtawName ? 'fa-check-circle' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
                    {useGtawName ? 'Auto-fill ON' : 'Auto-fill OFF'}
                </button>
            )}
            {(isDevelopmentEnvironment || isCivilianForm) && !isGtaAuthenticated && (
                <div style={{ padding: '2px 10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <i className="fas fa-tools" style={{ marginRight: '5px' }}></i>
                    Manual Mode
                </div>
            )}
        </div>
      </div>

      {(isDevelopmentEnvironment || isCivilianForm) ? (
        <Select
          name={employeeNameField}
          value={
            groupedOptions
              ? groupedOptions
                  .flatMap(group => group.options)
                  .find(option => option && option.value === formData[employeeNameField]) || null
              : null
          }
          onChange={selectedOption => {
            handleSelectChange(selectedOption, { name: employeeNameField });
            setFormData(prev => ({
                ...prev,
                [employeeBadgeField]: selectedOption?.badge || '',
                [employeeRankField]: selectedOption?.rank || '',
                [employeePHNumberField]: selectedOption?.phNumber || '50056',
            }));
          }}
          options={groupedOptions || []}
          isClearable
          placeholder={`Search or select ${employeeType}...`}
          styles={{
            control: (base, state) => ({
              ...base,
              backgroundColor: '#162032',
              color: '#f8fafc',
              padding: '4px',
              borderRadius: '8px',
              borderColor: !formData[employeeNameField] ? '#ef4444' : state.isFocused ? '#3b82f6' : '#334155',
              boxShadow: state.isFocused ? '0 0 0 1px #3b82f6' : 'none',
              '&:hover': { borderColor: '#475569' }
            }),
            menu: base => ({ ...base, backgroundColor: '#1e293b', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#334155' : 'transparent', color: '#f8fafc', cursor: 'pointer' }),
            singleValue: base => ({ ...base, color: '#f8fafc' }),
            input: base => ({ ...base, color: '#f8fafc' }),
            placeholder: base => ({ ...base, color: '#64748b' }),
            groupHeading: base => ({ ...base, color: '#94a3b8', fontWeight: 700, fontSize: '0.7rem' }),
          }}
        />
      ) : useGtawName && !isCivilianForm ? (
        <div style={{ 
            background: '#1e293b', 
            border: '1px solid #334155', 
            borderRadius: '12px', 
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                <div>
                    <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05rem', marginBottom: '0.2rem' }}>
                        <i className="fas fa-shield-alt"></i> Authenticated Profile
                    </div>
                    <h5 style={{ color: '#f8fafc', margin: 0, fontSize: '1.1rem' }}>{gtawCharacterName}</h5>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '700' }}>
                        OAUTH ACTIVE
                    </div>
                    <div 
                        onClick={togglePersistence}
                        style={{ 
                            fontSize: '0.65rem', 
                            color: persistEnabled ? '#10b981' : '#64748b', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: persistEnabled ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                            transition: 'all 0.2s'
                        }}
                        title={persistEnabled ? "Click to disable persistence" : "Click to stay logged in across sessions"}
                    >
                        <i className={`fas ${persistEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}`} style={{ fontSize: '0.9rem' }}></i>
                        Stay Logged In
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 10px' }}>
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>UCP Username</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{gtaWorldUser?.username}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Badge / ID</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>#{factionData?.characterId || gtaWorldUser?.id}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Current Rank</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>{factionData?.rank ? cleanRankText(factionData.rank) : 'Guest'}</div>
                </div>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #334155', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRefreshFactionInfo}
                className="btn btn-outline-info btn-sm"
                disabled={isRefreshing}
                style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '5px 10px' }}
              >
                <i className={`fas ${isRefreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} style={{ marginRight: '6px' }}></i>
                {isRefreshing ? 'Refreshing…' : 'Refresh Data'}
              </button>

              {canSwapCharacters && (
                <button 
                    type="button" 
                    onClick={handleSwap} 
                    className="btn btn-outline-primary btn-sm"
                    style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '5px 10px' }}
                >
                    <i className="fas fa-exchange-alt" style={{ marginRight: '6px' }}></i>
                    Switch Character
                </button>
              )}

              <div style={{ position: 'relative' }}>
                {showFloatingText && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: '0',
                    marginBottom: '10px',
                    backgroundColor: '#f59e0b',
                    color: '#000',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 100
                  }}>
                    Missing Name? Report it!
                    <div style={{ position: 'absolute', top: '100%', right: '20px', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #f59e0b' }} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleNewEmployeeClick}
                  className="btn btn-outline-warning btn-sm"
                  style={{ fontSize: '0.75rem', borderRadius: '6px', padding: '5px 10px' }}
                >
                  <i className="fas fa-user-plus" style={{ marginRight: '6px' }}></i>
                  New Employee
                </button>
              </div>
            </div>
        </div>
      ) : (
        <div style={{ 
            padding: '2rem', 
            backgroundColor: '#162032', 
            border: '1px solid #334155', 
            borderRadius: '12px', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
        }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: '1.2rem', border: '1px solid #334155' }}>
            <i className="fas fa-lock"></i>
          </div>
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '1rem', marginBottom: '4px' }}>Identity Required</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Please log in via GTA World to populate these fields.</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeCredentialsSection;
