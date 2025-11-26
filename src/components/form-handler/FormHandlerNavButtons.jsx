import React from 'react';
import { useNavigate } from 'react-router-dom';
import formStyles from './FormHandler.module.css'; // Assuming styles are needed here
import { useModal } from '../../contexts/ModalProvider'; // For setShowEmsBingoModal
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth'; // For auth status
import { useSeasonalEffects } from '../../contexts/SeasonalEffectsContext'; // Import useSeasonalEffects

const FormHandlerNavButtons = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isPhmcMember, characterName } = useGtaWorldAuth();
  const { setShowEmsBingoModal } = useModal(); // Assuming EmsBingoModal is still in MainApp or handled globally
  const { seasonalEffectsEnabled, setSeasonalEffectsEnabled } = useSeasonalEffects(); // Use seasonal effects context

  return (
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
        {isPhmcMember && (
          <button
            className={formStyles.topButton}
            onClick={() => navigate('/ems-dashboard')}
          >
            EMS Dashboard
          </button>
        )}
      </div>

      {/* Right-aligned buttons */}
      <div style={{ display: "flex", gap: "10px", pointerEvents: "auto" }}> {/* Re-enable pointer events for buttons */}
        <button
          className={formStyles.topButton}
          onClick={() => navigate('/auth/gtaworld')}
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
  );
};

export default FormHandlerNavButtons;