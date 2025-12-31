import React, { useEffect, useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Select from 'react-select';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { refreshFactionData as refreshFactionDataService } from '../../services/gtaWorldAuth';
import { cleanRankText } from '../../utils/textUtils';
import { getCharacterName, getCharacterID } from '../../utils/characterUtils';
import DiscordNameModal from './DiscordNameModal';
import { database } from '../../firebase';
import { ref, update } from 'firebase/database';
import { useNotification } from '../../contexts/NotificationContext.jsx';

/**
 * EmployeeCredentialsSection (Universal)
 * - Provides GTAW OAuth autofill, saved profile usage, and manual selection (dev)
 * - Intended to be reused across any form that needs an employee selector
 *
 * Props:
 * - formData, setFormData: parent form state handlers
 * - groupedOptions: react-select grouped options for manual selection (dev)
 * - handleSelectChange: handler used across the app for react-select
 * - setShowEmployeeModal: opens the Missing Name modal
 * - employeeType: 'coroner' | 'phmc' | ... (determines field names)
 * - showNotification: toast/notification function
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
}) => {
  const {
    user: gtaWorldUser,
    isAuthenticated: isGtaAuthenticated,
    canSwapCharacters,
    swapCharacter,
    swappableCharacters,
    factionData,
    updateFactionData,
    loadFromSavedProfile,
  } = useGtaWorldAuth();
  const { showNotification: notifyFromContext } = useNotification?.() || {};

  const [useGtawName, setUseGtawName] = useState(false);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [customDiscordName, setCustomDiscordName] = useState('');
  const employeeNameField = `${employeeType}Employee`;
  const employeeBadgeField = `${employeeType}Badge`;
  const employeeRankField = `${employeeType}Rank`;
  const employeeDiscordField = `${employeeType}Discord`;
  const employeePHNumberField = `${employeeType}PHNumber`;

  const isCivilianForm = typeof context === 'string' && context.startsWith('[Civilian]');

  const isDevelopmentEnvironment =
    window.location.hostname === 'localhost' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

  // Initialize GTAW autofill once
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
          [employeeDiscordField]: (customDiscordName || gtaWorldUser?.username || ''),
          [employeePHNumberField]: '50056',
        }));
      }
    }
  }, [isGtaAuthenticated, gtaWorldUser, useGtawName, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField, customDiscordName, isCivilianForm]);

  // Keep authed faction data in sync
  useEffect(() => {
    if (useGtawName && isGtaAuthenticated && gtaWorldUser && factionData && !isCivilianForm) {
      const cleanRank = factionData.rank ? cleanRankText(factionData.rank) : 'GTAW User';
      setFormData(prev => ({
        ...prev,
        [employeeNameField]: factionData.characterName,
        [employeeBadgeField]: factionData.characterId || '',
        [employeeRankField]: cleanRank,
        [employeeDiscordField]: (customDiscordName || gtaWorldUser?.username || ''),
        [employeePHNumberField]: '50056',
      }));
    }
  }, [factionData, useGtawName, isGtaAuthenticated, gtaWorldUser, setFormData, employeeNameField, employeeBadgeField, employeeRankField, employeeDiscordField, employeePHNumberField, customDiscordName, isCivilianForm]);

  // Sync custom discord name from faction data, when available
  useEffect(() => {
    if (isGtaAuthenticated && gtaWorldUser && factionData) {
      if (factionData.discordName) {
        setCustomDiscordName(factionData.discordName);
      } else {
        setCustomDiscordName('');
      }
    }
  }, [isGtaAuthenticated, gtaWorldUser, factionData]);

  const gtawCharacterName = factionData?.characterName || null;

  // Saved profile support (opt-in persistence)
  const [savedProfile, setSavedProfile] = useState(() => {
    try {
      const raw = localStorage.getItem('phmc_gtaw_oauth_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [usingSavedProfile, setUsingSavedProfile] = useState(false);
  const [persistEnabled, setPersistEnabled] = useState(
    () => localStorage.getItem('phmc_gtaw_oauth_persist_enabled') === 'true'
  );
  const [persistedAt, setPersistedAt] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('phmc_gtaw_oauth_profile') || 'null');
      return saved?.savedAt ? new Date(saved.savedAt) : null;
    } catch {
      return null;
    }
  });

  const buildCompactProfile = () => {
    const name = factionData?.characterName || getCharacterName(gtaWorldUser) || null;
    const badge = factionData?.characterId || getCharacterID(gtaWorldUser) || null;
    const rankRaw = factionData?.rank || gtaWorldUser?.faction?.rank || gtaWorldUser?.faction?.scriptRank || '';
    const rank = rankRaw ? cleanRankText(rankRaw) : '';

    const getCharId = (c) => c?.character?.characterId ?? c?.id ?? null;
    const getCharName = (c) => c?.character?.characterName ?? c?.name ?? null;

    const normalizedSwappable = swappableCharacters.map(c => {
      const charId = getCharId(c);
      let charData = {
        characterId: charId,
        characterName: getCharName(c),
      };

      // If this is the currently active character, we have full data for it.
      if (charId === factionData.characterId) {
        charData = { ...charData, ...factionData };
      }
      
      return { character: charData };
    }).filter(c => c.character.characterId);


    return {
      username: gtaWorldUser?.username || null,
      userId: gtaWorldUser?.id || null,
      isFactionMember: !!(gtaWorldUser?.isFactionMember || factionData),
      faction: factionData
        ? {
            characterName: factionData.characterName || null,
            characterId: factionData.characterId || null,
            rank: factionData.rank || null,
            scriptRank: factionData.scriptRank || null,
          }
        : null,
      swappableCharacters: normalizedSwappable,
      preferredEmployee: {
        name,
        badge,
        rank,
        discord: gtaWorldUser?.username || null,
        phNumber: '50056',
      },
      accessLevel: gtaWorldUser?.accessLevel || 'none',
      permissions: Array.isArray(gtaWorldUser?.permissions) ? gtaWorldUser.permissions : [],
      savedAt: Date.now(),
      version: 2,
    };
  };

  const handleTogglePersist = e => {
    const next = e.target.checked;
    setPersistEnabled(next);
    if (next) {
      try {
        const profile = buildCompactProfile();
        localStorage.setItem('phmc_gtaw_oauth_profile', JSON.stringify(profile));
        localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'true');
        setPersistedAt(new Date(profile.savedAt));
      } catch (err) {
        console.warn('[EmployeeCredentialsSection] Failed to persist OAuth profile:', err);
      }
    } else {
      localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'false');
      localStorage.removeItem('phmc_gtaw_oauth_profile');
      setPersistedAt(null);
    }
  };

  const handleSwap = () => {
    if (!canSwapCharacters || !factionData || !swappableCharacters || swappableCharacters.length < 2) {
        console.log("Cannot swap characters", { canSwapCharacters, factionData, swappableCharacters });
        return;
    }

    const getCharId = (c) => c?.character?.characterId ?? c?.id ?? null;

    const validCharacters = swappableCharacters.filter(c => getCharId(c) !== null);

    if (validCharacters.length < 2) {
        console.log("Not enough valid characters to swap", { validCharacters });
        return;
    }

    const currentIndex = validCharacters.findIndex(c => getCharId(c) === factionData.characterId);
    
    const nextIndex = (currentIndex + 1) % validCharacters.length;
    
    const nextCharacter = validCharacters[nextIndex];
    const nextCharacterId = getCharId(nextCharacter);

    if (nextCharacter) {
        console.log(`Swapping from ${factionData.characterId} to ${nextCharacterId}`);
        swapCharacter(nextCharacter);
    } else {
        console.log("Could not determine next character ID to swap to", { nextCharacter });
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefreshFactionInfo = async () => {
    if (!isGtaAuthenticated) {
      (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Please log out and back in to refresh your rank and permissions.', 'info-circle', 4000);
      return;
    }
    try {
      setIsRefreshing(true);
      (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Refreshing your PHMC rank and permissions...', 'info-circle', 3000);
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
            [employeeDiscordField]: (customDiscordName || gtaWorldUser?.username || prev[employeeDiscordField]),
            [employeePHNumberField]: '50056',
          }));
        }
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Your PHMC rank and permissions have been refreshed.', 'check-circle', 3500);
      } else {
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('No faction membership found. If this is unexpected, please log out and back in.', 'exclamation-triangle', 5000);
      }
    } catch (err) {
      console.warn('[EmployeeCredentialsSection] Failed to refresh faction info:', err);
      const errorMessage = err?.message || '';
      if (errorMessage.includes('404: Not Found')) {
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('GTA World API endpoint not found. Please contact support.', 'exclamation-triangle', 7000);
      } else {
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Unable to refresh now. Please log out and back in to update your rank.', 'exclamation-triangle', 5000);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const enableDiscordEdit = context === 'CoronerEmail' || employeeType === 'coroner';

  const handleSaveDiscordName = async newDiscordName => {
    if (!enableDiscordEdit) {
      setShowDiscordModal(false);
      return;
    }
    if (factionData && factionData.characterId) {
      const characterId = factionData.characterId;
      const userRef = ref(database, `factions/364/members/${characterId}`);
      try {
        await update(userRef, { discordName: newDiscordName });
        setCustomDiscordName(newDiscordName);
        const updatedFactionData = { ...factionData, discordName: newDiscordName };
        updateFactionData(updatedFactionData);
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Discord name updated successfully!', 'success');
      } catch (error) {
        console.error('Error updating Discord name:', error);
        (showNotification || notifyFromContext) && (showNotification || notifyFromContext)('Failed to update Discord name. Please try again.', 'error');
      }
    }
    setShowDiscordModal(false);
  };

  const handleUseSavedProfile = () => {
    if (!savedProfile) return;

    if (savedProfile.version >= 2 && loadFromSavedProfile) {
      loadFromSavedProfile(savedProfile);
    }

    const pref = savedProfile.preferredEmployee || {};
    const preferredRank = pref.rank ? cleanRankText(pref.rank) : '';
    setFormData(prev => ({
      ...prev,
      [employeeNameField]: pref.name || '',
      [employeeBadgeField]: pref.badge || '',
      [employeeRankField]: preferredRank,
      [employeeDiscordField]: savedProfile.username || pref.discord || '',
      [employeePHNumberField]: pref.phNumber || '50056',
    }));
    // Set local Discord state for edit button
    setCustomDiscordName(savedProfile.username || pref.discord || '');
    setUsingSavedProfile(true);
    setUseGtawName(true); // Show the "Using GTAW OAuth Credentials" panel after using saved profile
  };

  const handleClearSavedProfile = () => {
    try {
      localStorage.removeItem('phmc_gtaw_oauth_profile');
      localStorage.setItem('phmc_gtaw_oauth_persist_enabled', 'false');
      setSavedProfile(null);
      setPersistEnabled(false);
      setPersistedAt(null);
      setUsingSavedProfile(false);
    } catch {}
  };

  return (
    <>
      <DiscordNameModal
        show={enableDiscordEdit && showDiscordModal}
        handleClose={() => setShowDiscordModal(false)}
        handleSave={handleSaveDiscordName}
        currentDiscordName={customDiscordName || gtaWorldUser?.username}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
        <Form.Label style={{ marginBottom: 0 }}>Employee Name</Form.Label>
        <button
          type="button"
          onClick={() => setShowEmployeeModal(true)}
          className="close-button"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', lineHeight: '1.2' }}
        >
          <i className="fas fa-question-circle" style={{ marginRight: '5px' }}></i>
          Missing Name?
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
        {isGtaAuthenticated && gtawCharacterName && !isCivilianForm && (
          <button
            type="button"
            onClick={() => setUseGtawName(!useGtawName)}
            className="btn btn-outline-light"
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem', border: useGtawName ? '1px solid #28a745' : '1px solid #6c757d', color: useGtawName ? '#28a745' : '#6c757d' }}
            title={useGtawName ? `Using GTAW: ${gtawCharacterName}` : `Use GTAW name: ${gtawCharacterName}`}
          >
            <i className={`fas ${useGtawName ? 'fa-check' : 'fa-user'}`} style={{ marginRight: '5px' }}></i>
            {useGtawName ? 'Using GTAW' : 'Use GTAW'}
          </button>
        )}
        {canSwapCharacters && useGtawName && factionData && (
          <button type="button" onClick={handleSwap} className="btn btn-outline-info" style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}>
            <i className="fas fa-random" style={{ marginRight: '5px' }}></i>
            Switch Employee
          </button>
        )}
        {(isDevelopmentEnvironment || isCivilianForm) && !isGtaAuthenticated && (
          <div style={{ padding: '5px 10px', backgroundColor: '#ffc107', color: '#000', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            <i className="fas fa-code" style={{ marginRight: '5px' }}></i>
            {isCivilianForm ? 'Manual Selection for Patients' : 'Development Mode: Manual Selection Enabled'}
          </div>
        )}
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
                [employeeDiscordField]: selectedOption?.discord || '',
                [employeePHNumberField]: selectedOption?.phNumber || '50056',
            }));
          }}
          options={groupedOptions || []}
          isClearable
          placeholder={`Search or select ${employeeType}...`}
          styles={{
            control: (base, state) => ({
              ...base,
              backgroundColor: '#16202c',
              color: '#eeeeeeb0',
              borderColor: !formData[employeeNameField] && state.isFocused ? '#dc3545' : !formData[employeeNameField] ? '#dc3545' : state.isFocused ? '#86b7fe' : '#6c757d',
              '&:hover': { borderColor: !formData[employeeNameField] ? '#dc3545' : '#86b7fe' },
              boxShadow: !formData[employeeNameField] && state.isFocused ? '0 0 0 0.25rem rgba(220, 53, 69, 0.25)' : state.isFocused ? '0 0 0 0.25rem rgba(13, 110, 253, 0.25)' : null,
            }),
            menu: base => ({ ...base, backgroundColor: '#16202c', zIndex: 1051 }),
            option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? 'Grey' : '#16202c', color: '#eeeeeeb0' }),
            singleValue: base => ({ ...base, color: '#eeeeeeb0' }),
            input: base => ({ ...base, color: '#eeeeeeb0' }),
            placeholder: base => ({ ...base, color: '#eeeeeeb0' }),
            group: base => ({ ...base, paddingTop: 8, paddingBottom: 8 }),
            groupHeading: base => ({ ...base, color: '#6c757d', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: 4 }),
          }}
        />
      ) : useGtawName && !isCivilianForm ? (
        <div style={{ padding: '10px', backgroundColor: '#1a2332', border: '1px solid #28a745', borderRadius: '4px', marginBottom: '1rem' }}>
          <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '5px' }}>
            <i className="fas fa-user-check" style={{ marginRight: '8px' }}></i>
            Using GTAW OAuth Credentials
          </div>
          <div style={{ color: '#eeeeeeb0' }}>
            <div style={{ color: '#cfe6cf', fontSize: '0.9rem', marginBottom: '10px' }}>
              {persistEnabled ? (
                <><i className="fas fa-bookmark" style={{ marginRight: '5px' }}></i> Your credentials will be saved automatically.</>
              ) : (
                <><i className="fas fa-eraser" style={{ marginRight: '5px' }}></i> Your credentials will NOT be saved automatically.</>
              )}
            </div>
            <strong>Character Name:</strong> {usingSavedProfile ? formData[employeeNameField] : gtawCharacterName}<br />
            <strong>UCP User:</strong> {usingSavedProfile ? formData[employeeDiscordField] : gtaWorldUser?.username}<br />
            <strong>Badge Number:</strong> {usingSavedProfile ? formData[employeeBadgeField] : (factionData?.characterId || gtaWorldUser?.id)}<br />
            <strong>Rank:</strong> {usingSavedProfile ? formData[employeeRankField] : (factionData?.rank ? cleanRankText(factionData.rank) : '')}<br />
            {enableDiscordEdit && (
              <>
                <strong>Discord:</strong> {usingSavedProfile ? formData[employeeDiscordField] : (customDiscordName || gtaWorldUser?.username)}
                <Button variant="link" size="sm" onClick={() => setShowDiscordModal(true)}>(Edit)</Button>
                <br />
              </>
            )}
            <div style={{ marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleRefreshFactionInfo}
                className="btn btn-outline-info btn-sm"
                disabled={isRefreshing}
                title="Refresh your GTAW rank and permissions"
              >
                <i className={`fas ${isRefreshing ? 'fa-spinner fa-spin' : 'fa-rotate'}`} style={{ marginRight: '6px' }}></i>
                {isRefreshing ? 'Refreshing…' : 'Refresh Rank/Permissions'}
              </button>
            </div>
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #2f3b52' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={persistEnabled} onChange={handleTogglePersist} style={{ accentColor: '#28a745' }} />
                <span style={{ color: '#cfe6cf' }}>
                  Keep me logged in on this browser.
                </span>
              </label>
              {persistEnabled && (
                <div style={{ color: '#9fb59f', fontSize: '0.85rem', marginTop: '6px' }}>
                  <i className="fas fa-save" style={{ marginRight: '6px' }}></i>
                  Saved{persistedAt ? ` on ${persistedAt.toLocaleString()}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {savedProfile ? (
            <div style={{ padding: '12px', backgroundColor: '#1a2332', border: '1px solid #198754', borderRadius: '4px', marginBottom: '1rem' }}>
              <div style={{ color: '#20c997', fontWeight: 'bold', marginBottom: '6px' }}>
                <i className="fas fa-id-badge" style={{ marginRight: '8px' }}></i>
                Saved OAuth Details Available
              </div>
              <div style={{ color: '#cfe6cf', fontSize: '0.9rem', marginBottom: '10px' }}>
                {persistEnabled ? (
                  <><i className="fas fa-bookmark" style={{ marginRight: '5px' }}></i> Your credentials will be saved automatically.</>
                ) : (
                  <><i className="fas fa-eraser" style={{ marginRight: '5px' }}></i> Your credentials will NOT be saved automatically.</>
                )}
              </div>
              <div style={{ color: '#eeeeeeb0', marginBottom: '8px' }}>
                <strong>Character Name:</strong> {savedProfile?.preferredEmployee?.name || 'Unknown'}
                <br />
                <strong>UCP User:</strong> {savedProfile?.username || 'Unknown'}
                <br />
                {savedProfile?.preferredEmployee?.badge && (
                  <>
                    <strong>Badge Number:</strong> {savedProfile.preferredEmployee.badge}
                    <br />
                  </>
                )}
                {savedProfile?.preferredEmployee?.rank && (
                  <>
                    <strong>Rank:</strong> {cleanRankText(savedProfile.preferredEmployee.rank)}
                    <br />
                  </>
                )}
                {/* Show Discord and Edit if using Coroner context */}
                {enableDiscordEdit && (
                  <>
                    <strong>Discord:</strong> {customDiscordName || savedProfile.username || savedProfile?.preferredEmployee?.discord || ''}
                    <Button variant="link" size="sm" onClick={() => setShowDiscordModal(true)}>(Edit)</Button>
                    <br />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-success btn-sm" onClick={handleUseSavedProfile}>
                  <i className="fas fa-check" style={{ marginRight: '6px' }}></i>
                  Use Saved Details
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleClearSavedProfile}>
                  <i className="fas fa-trash" style={{ marginRight: '6px' }}></i>
                  Clear Saved
                </button>
              </div>
              {usingSavedProfile && (
                <div style={{ color: '#9fb59f', fontSize: '0.85rem', marginTop: '8px' }}>
                  <i className="fas fa-check-circle" style={{ marginRight: '6px' }}></i>
                  Applied saved details to this report.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '15px', backgroundColor: '#2a2a2a', border: '1px solid #6c757d', borderRadius: '4px', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ color: '#6c757d', marginBottom: '10px' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                GTAW Authentication Required
              </div>
              <div style={{ color: '#ccc', fontSize: '0.9rem' }}>
                Please log in with your GTAW account to automatically populate your credentials.
              </div>
            </div>
          )}
        </>
      )}

      {/* Note: The non-dev unauthenticated message is merged to allow saved-profile CTA */}
    </>
  );
};

export default EmployeeCredentialsSection;
