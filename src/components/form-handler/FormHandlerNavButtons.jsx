import React, { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import formStyles from './FormHandler.module.css'; // Assuming styles are needed here
import { useModal } from '../../contexts/ModalProvider'; // For setShowEmsBingoModal
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth'; // For auth status
import { useSeasonalEffects } from '../../contexts/SeasonalEffectsContext'; // Import useSeasonalEffects
import { useNotification } from '../../contexts/NotificationContext'; // Import useNotification
import CctvRequestModal from './CctvRequestModal'; // Import the CCTV modal

const FormHandlerNavButtons = ({ onToggleSavedReports }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isPhmcMember, characterName, login } = useGtaWorldAuth();
  const { setShowEmsBingoModal } = useModal(); // Assuming EmsBingoModal is still in MainApp or handled globally
  const { seasonalEffectsEnabled, setSeasonalEffectsEnabled } = useSeasonalEffects(); // Use seasonal effects context
  const { showNotification } = useNotification(); // Destructure showNotification
  const [showCctvModal, setShowCctvModal] = useState(false); // State for CCTV modal
  const [userPrefs, setUserPrefs] = useState(null);

  useEffect(() => {
    const storedPrefs = localStorage.getItem('userOnboardingPreferences');
    if (storedPrefs) {
      try {
        setUserPrefs(JSON.parse(storedPrefs));
      } catch (e) {
        console.error("Failed to parse user onboarding preferences", e);
      }
    }
  }, []);

  const isLeo = userPrefs?.userType === 'leo';

  // Enhanced GTAW login handler with loading notification and return path logic
  const handleGtawLogin = useCallback(() => {
    // Show loading notification
    showNotification('Please wait, this may take a moment...', 'info-circle', 10000);
    
    // Determine return path based on current location (simplified to homepage as per MainApp's logic)
    // The previous MainApp logic redirected all GTAW logins to homepage ('#/')
    const returnPath = '#/'; 
    
    // Call the original login function with proper return path
    login({ returnPath });
  }, [showNotification, login]);

  const handleRestartOnboarding = () => {
    if (window.confirm('Are you sure you want to restart the onboarding process? Your current preferences will be lost.')) {
      localStorage.removeItem('onboardingComplete');
      localStorage.removeItem('userOnboardingPreferences');
      localStorage.removeItem('onboardingSkipped');
      localStorage.removeItem('onboardingProgress');
      window.location.reload();
    }
  };

  return (
    <React.Fragment>
      <div style={{
        position: "fixed",
        top: 10, // Adjusted top for better spacing
        left: 10, // Adjusted left for left-aligned buttons
        right: 10, // Adjusted right for right-aligned buttons
        zIndex: 1000,
        display: "flex",
        justifyContent: "space-between", // Pushes content to left and right
        alignItems: "flex-start", // Align items to the top
        width: "calc(100% - 20px)", // Ensure it spans almost full width with padding
        pointerEvents: "none", // Allow clicks to pass through this container
      }}>
        {/* Left-aligned buttons */}
        <div style={{ display: "flex", gap: "10px", pointerEvents: "auto" }}> {/* Re-enable pointer events for buttons */}
          {isPhmcMember && (
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
            >
              EMS Dashboard
            </button>
        </div>

        {/* Right-aligned buttons */}
        <div style={{ display: "flex", gap: "10px", pointerEvents: "auto" }}> {/* Re-enable pointer events for buttons */}
          {((isAuthenticated && isLeo) || import.meta.env.DEV) && (
            <button
                className={formStyles.topButton}
                onClick={() => setShowCctvModal(true)}
                title="Request CCTV Footage"
            >
                <i className="fas fa-video"></i> CCTV Request
            </button>
          )}
          <button
              className={formStyles.topButton}
              onClick={onToggleSavedReports}
              title="Open Saved Reports"
          >
              <i className="fas fa-save"></i> Saved Reports
          </button>
          <button
            className={formStyles.topButton}
            onClick={handleGtawLogin}
          >
            {isAuthenticated ? `Signed in as ${characterName || user?.username}` : "Sign in with GTA:W"}
          </button>
          <button
              type="button"
              className={formStyles.bingoButton}
              onClick={() => setShowEmsBingoModal(true)}
              title="Open Bingo Night!"
          >
              <i className="fas fa-trophy"></i>
              Bingo Night!
          </button>
            {/* Seasonal Effects Toggle Button */}
            <button
              className={formStyles.topButton}
              onClick={() => setSeasonalEffectsEnabled(!seasonalEffectsEnabled)}
              title={seasonalEffectsEnabled ? "Disable Seasonal Effects" : "Enable Seasonal Effects"}
            >
              {seasonalEffectsEnabled ? "Effects ON" : "Effects OFF"}
            </button>
        </div>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 10,
        left: 10,
        zIndex: 1000,
        pointerEvents: 'auto'
      }}>
        <button
          className={formStyles.topButton} // Reuse existing style for consistency
          onClick={handleRestartOnboarding}
          title="Restart the onboarding process"
        >
          <i className="fas fa-redo"></i> Restart Onboarding
        </button>
      </div>

      {showCctvModal && (
        <CctvRequestModal
          show={showCctvModal}
          onHide={() => setShowCctvModal(false)}
          showNotification={showNotification}
        />
      )}
    </React.Fragment>
  );
};

export default FormHandlerNavButtons;