import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import formStyles from './FormHandler.module.css';
import { useModal } from '../../contexts/ModalProvider';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useSeasonalEffects } from '../../contexts/SeasonalEffectsContext';
import { useNotification } from '../../contexts/NotificationContext';
import CctvRequestModal from './CctvRequestModal';
import { Dropdown } from 'react-bootstrap';
import FormRequestModal from '../Modals/FormRequestModal';

import seasonalEvents from '../UI/SeasonalEvents';
import BusinessCardModal from '../Modals/BusinessCardModal';
import MapModal from '../Modals/MapModal';
import { uploadDataUrlToImgBB } from '../../utils/imageUploadUtils';

const FormHandlerNavButtons = ({ onToggleSavedReports, onToggleAgencyIncident }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isPhmcMember, characterName, login, logout } = useGtaWorldAuth();
  const { setShowEmsBingoModal } = useModal();
  const { seasonalEffectsEnabled, setSeasonalEffectsEnabled } = useSeasonalEffects();

  const { imageSource: phmcLogoSrc, className: phmcLogoClassName } = seasonalEvents({
    imageType: 'phmcLogo',
    season: seasonalEffectsEnabled ? undefined : 'Default'
  });

  const { showNotification } = useNotification();
  const [showCctvModal, setShowCctvModal] = useState(false);
  const [showFormRequestModal, setShowFormRequestModal] = useState(false);
  const [showBusinessCardModal, setShowBusinessCardModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [userPrefs, setUserPrefs] = useState(null);
  const [showCctvPopup, setShowCctvPopup] = useState(false);

  useEffect(() => {
    const checkCctvPopupState = () => {
      const storedPrefs = localStorage.getItem('userOnboardingPreferences');
      let parsedPrefs = null;
      if (storedPrefs) {
        try {
          parsedPrefs = JSON.parse(storedPrefs);
        } catch (e) {
          console.error("Failed to parse user onboarding preferences from storage event", e);
        }
      }
      setUserPrefs(parsedPrefs); // Update userPrefs state

      const onboardingComplete = localStorage.getItem('onboardingComplete') === 'true';
      const cctvPopupDismissed = localStorage.getItem('cctvPopupDismissed') === 'true';
      const showHint = localStorage.getItem('showCctvHint') === 'true';

      if (onboardingComplete && parsedPrefs?.userType === 'leo' && showHint && !cctvPopupDismissed) {
        setShowCctvPopup(true);
      } else {
        setShowCctvPopup(false);
      }
    };

    checkCctvPopupState(); // Initial check on mount

    const handleStorageChange = (event) => {
      if (['userOnboardingPreferences', 'onboardingComplete', 'showCctvHint', 'cctvPopupDismissed'].includes(event.key)) {
        checkCctvPopupState();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  const isLeo = userPrefs?.userType === 'leo';

  const handleGtawLogin = useCallback(() => {
    showNotification('Please wait, this may take a moment...', 'info-circle', 10000);
    const returnPath = '#/'; 
    login({ returnPath });
  }, [showNotification, login]);

  const handleRestartOnboarding = () => {
    if (window.confirm('Are you sure you want to restart the onboarding process? Your current preferences will be lost.')) {
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('userOnboardingPreferences');
      localStorage.removeItem('onboardingSkipped');
      localStorage.removeItem('onboardingProgress');
      localStorage.removeItem('showCctvHint');
      localStorage.removeItem('cctvPopupDismissed');
      window.location.reload();
    }
  };

  const handleDropdownClick = () => {
    if (showCctvPopup) {
      setShowCctvPopup(false);
      localStorage.setItem('cctvPopupDismissed', 'true');
    }
  };

  return (
    <React.Fragment>
      <div style={{
        position: "fixed",
        top: 10,
        left: 10,
        right: 10,
        zIndex: 1000,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        width: "calc(100% - 20px)",
        pointerEvents: "none",
      }}>
        {/* Left-aligned buttons */}
        <div style={{ display: "flex", alignItems: 'center', gap: "10px", pointerEvents: "auto" }}>
          {(isPhmcMember || import.meta.env.DEV) && (
            <button
              className={formStyles.topButton}
              onClick={() => navigate('/admin')}
            >
              Admin
            </button>
          )}
                    <button
                      className={formStyles.topButton}
                      onClick={() => navigate('/ems-dashboard')}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      EMS Dashboard
                    </button>        </div>

        {/* Right-aligned buttons */}
        <div style={{ position: 'relative', display: "flex", alignItems: "center", gap: "10px", pointerEvents: "auto" }}>
          <button
              className={formStyles.topButton}
              onClick={onToggleSavedReports}
              title="Open Saved Reports"
          >
              <i className="fas fa-save"></i> Saved Reports
          </button>
          <button
            className={formStyles.topButton}
            onClick={isAuthenticated ? logout : handleGtawLogin}
          >
            {isAuthenticated ? `Sign Out (${characterName || user?.username})` : "Sign in with GTA:W"}
          </button>
          
          <Dropdown onToggle={handleDropdownClick}>
            <Dropdown.Toggle as="button" className={formStyles.topButton} id="dropdown-more-options">
              <i className="fas fa-cog"></i> More
            </Dropdown.Toggle>

            <Dropdown.Menu>
              {((isAuthenticated && isLeo) || import.meta.env.DEV) && (
                <Dropdown.Item onClick={() => setShowCctvModal(true)}>
                  <i className="fas fa-video"></i> CCTV Request
                </Dropdown.Item>
              )}
              <Dropdown.Item onClick={() => setShowEmsBingoModal(true)}>
                <i className="fas fa-trophy"></i> Bingo Night!
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setShowFormRequestModal(true)}>
                <i className="fas fa-file-alt"></i> Request a Form
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setShowBusinessCardModal(true)}>
                <i className="fas fa-id-card"></i> Business Card
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setShowMapModal(true)}>
                <i className="fas fa-map"></i> GTA Map (Experimental)
              </Dropdown.Item>
              <Dropdown.Item onClick={onToggleAgencyIncident}>
                <i className="fas fa-shield-alt"></i> Agency Incident
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setSeasonalEffectsEnabled(!seasonalEffectsEnabled)}>
                <i className={`fas ${seasonalEffectsEnabled ? "fa-toggle-on" : "fa-toggle-off"}`}></i>
                {seasonalEffectsEnabled ? "Effects ON" : "Effects OFF"}
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={handleRestartOnboarding}>
                <i className="fas fa-redo"></i> Restart Onboarding
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          {showCctvPopup && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '5px',
              background: 'var(--bs-warning)',
              color: '#000',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              zIndex: 1001,
            }}>
              CCTV in here!
              <div style={{
                content: '""',
                position: 'absolute',
                bottom: '100%',
                right: '15px',
                borderWidth: '5px',
                borderStyle: 'solid',
                borderColor: 'transparent transparent var(--bs-warning) transparent'
              }}/>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 1000,
        }}
        onClick={() => window.open('https://phmc.gta.world/', '_blank')}
        title="Go to PHMC Website"
      >
        <img src={phmcLogoSrc} alt="PHMC Logo" className={phmcLogoClassName} style={{ height: '85px' }} />
      </div>

      {showCctvModal && (
        <CctvRequestModal
          show={showCctvModal}
          onHide={() => setShowCctvModal(false)}
          showNotification={showNotification}
        />
      )}

      {showFormRequestModal && (
        <FormRequestModal
            show={showFormRequestModal}
            onClose={() => setShowFormRequestModal(false)}
        />
      )}

      {showBusinessCardModal && (
        <BusinessCardModal
          show={showBusinessCardModal}
          onHide={() => setShowBusinessCardModal(false)}
          showNotification={showNotification}
          commitInfo={{}}
          handleImageUpload={uploadDataUrlToImgBB}
        />
      )}

      <MapModal
        show={showMapModal}
        onHide={() => setShowMapModal(false)}
      />
    </React.Fragment>
  );
};

export default FormHandlerNavButtons;