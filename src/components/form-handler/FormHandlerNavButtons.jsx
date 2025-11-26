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
      top: 20,
      right: 20,
      zIndex: 1000,
      display: "flex",
      gap: "10px", // Space between buttons
    }}>
      {isPhmcMember && (
        <button
          className={formStyles.topButton}
          onClick={() => window.location.href = "/admin"}
        >
          Admin
        </button>
      )}
      {isPhmcMember && (
        <button
          className={formStyles.topButton}
          onClick={() => window.location.href = "/ems-dashboard"}
        >
          EMS Dashboard
        </button>
      )}
      <button
        className={formStyles.topButton}
        onClick={() => window.location.href = "/auth/gtaworld"}
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
              <button
          className={formStyles.topButton}
          onClick={() => window.location.href = "#/admin"}
        >
          Admin
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
  );
};

export default FormHandlerNavButtons;
