import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import panelStyles from './FormHandlerNavButtons.module.css';
import { useModal } from '../../contexts/ModalProvider';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useSeasonalEffects } from '../../contexts/SeasonalEffectsContext';
import { useNotification } from '../../contexts/NotificationContext';
import CctvRequestWebhookModal from '../Admin/CctvRequestWebhookModal';
import FormRequestModal from '../Modals/FormRequestModal';

import seasonalEvents from '../UI/SeasonalEvents';
import BusinessCardModal from '../Modals/BusinessCardModal';
import MapModal from '../Modals/MapModal';
import HallOfFameModal from '../Modals/HallOfFameModal';
import { uploadDataUrlToImgBB } from '../../utils/imageUploadUtils';

const FormHandlerNavButtons = ({ onToggleSavedReports, onToggleAgencyIncident, onStartTour }) => {
  const navigate = useNavigate();
  const { isPhmcMember } = useGtaWorldAuth();
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
  const [showHallOfFameModal, setShowHallOfFameModal] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showCctvPopup, setShowCctvPopup] = useState(() => {
    return localStorage.getItem('cctvPopupDismissed') !== 'true';
  });

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
    if (showCctvPopup) {
      setShowCctvPopup(false);
      localStorage.setItem('cctvPopupDismissed', 'true');
    }
  };

  const handleAction = (action) => {
    setIsPanelOpen(false);
    action();
  };

  return (
    <React.Fragment>
      {/* Sidebar Toggle & Container */}
      <div className={panelStyles.navContainer} data-tour="nav-buttons">
        <button 
          className={`${panelStyles.toggleButton} ${isPanelOpen ? panelStyles.active : ''}`}
          onClick={togglePanel}
          title={isPanelOpen ? "Close Tools" : "Open Tools & Navigation"}
        >
          <i className={`fas ${isPanelOpen ? 'fa-times' : 'fa-tools'}`}></i>
          {showCctvPopup && !isPanelOpen && <div className={panelStyles.cctvBadge} />}
        </button>
      </div>

      {/* Overlay */}
      <div 
        className={`${panelStyles.panelOverlay} ${isPanelOpen ? panelStyles.show : ''}`} 
        onClick={() => setIsPanelOpen(false)}
      />

      {/* Sliding Panel */}
      <div className={`${panelStyles.slidingPanel} ${isPanelOpen ? panelStyles.open : ''}`}>
        <div className={panelStyles.panelHeader}>Navigation</div>
        
        {(isPhmcMember || import.meta.env.DEV) && (
          <button className={panelStyles.panelButton} onClick={() => handleAction(() => navigate('/admin'))}>
            <i className="fas fa-user-shield"></i> Admin Panel
          </button>
        )}
        
        <button className={panelStyles.panelButton} onClick={() => handleAction(() => navigate('/ems-dashboard'))}>
          <i className="fas fa-tachometer-alt"></i> EMS Dashboard
        </button>

        <div className={panelStyles.panelDivider} />
        <div className={panelStyles.panelHeader}>Tools</div>

        <button className={panelStyles.panelButton} onClick={() => handleAction(onToggleSavedReports)}>
          <i className="fas fa-save"></i> Saved Reports
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowCctvModal(true))}>
          <i className="fas fa-video"></i> CCTV Request
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowEmsBingoModal(true))}>
          <i className="fas fa-trophy"></i> Bingo Night!
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowMapModal(true))}>
          <i className="fas fa-map-marked-alt"></i> GTA Map (Beta)
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowBusinessCardModal(true))}>
          <i className="fas fa-id-card"></i> Business Card
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowHallOfFameModal(true))}>
          <i className="fas fa-medal"></i> Hall of Fame
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(onToggleAgencyIncident)}>
          <i className="fas fa-shield-alt"></i> Agency Incident
        </button>

        <div className={panelStyles.panelDivider} />
        <div className={panelStyles.panelHeader}>Settings & Help</div>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setSeasonalEffectsEnabled(!seasonalEffectsEnabled))}>
          <i className={`fas ${seasonalEffectsEnabled ? "fa-toggle-on" : "fa-toggle-off"}`}></i>
          Effects: {seasonalEffectsEnabled ? "ON" : "OFF"}
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowFormRequestModal(true))}>
          <i className="fas fa-file-signature"></i> Request a Form
        </button>

        {import.meta.env.DEV && (
          <button className={panelStyles.panelButton} onClick={() => handleAction(onStartTour)}>
            <i className="fas fa-route"></i> Run UI Tour
          </button>
        )}
      </div>

      {/* Persistent Logo */}
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
        <img src={phmcLogoSrc} alt="PHMC Logo" className={phmcLogoClassName} style={{ height: '65px' }} />
      </div>

      {showCctvModal && (
        <CctvRequestWebhookModal
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

      <HallOfFameModal
        show={showHallOfFameModal}
        onHide={() => setShowHallOfFameModal(false)}
      />
    </React.Fragment>
  );
};

export default FormHandlerNavButtons;
