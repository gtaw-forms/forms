import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import panelStyles from './SidebarNav.module.css';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import { useNotification } from '../../contexts/NotificationContext';
import { useImageUpload } from '../../hooks/useImageUpload';
import phmcLogoSrc from '../../assets/phmc.png';
import MapModal from '../Modals/MapModal';
import BusinessCardModal from '../Modals/BusinessCardModal';
/**
 * Reusable Sidebar Navigation component for Form Handler and EMS Dashboard
 */
const SidebarNav = ({
  children,
  onToggleSavedReports,
  onStartTour,
  groupedForms,
  collapsedCategories,
  toggleCategory,
  onSelectForm,
  selectedForm,
  searchTerm,
  setSearchTerm,
  onOpenBotConsent,
}) => {
  const navigate = useNavigate();
  const { isPhmcMember } = useGtaWorldAuth();

  const { showNotification } = useNotification();
  const { handleImageUpload } = useImageUpload(showNotification, () => {});

  const [showMapModal, setShowMapModal] = useState(false);
  const [showBusinessCardModal, setShowBusinessCardModal] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const handleAction = (action) => {
    if (!action) return;
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
          <i className={`fas ${isPanelOpen ? 'fa-times' : 'fa-bars'}`}></i>
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

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => navigate('/morgue'))}>
          <i className="fas fa-microscope"></i> Morgue Intake
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => navigate('/'))}>
          <i className="fas fa-file-medical"></i> Form Handler
        </button>

        {groupedForms && (
            <>
                <div className={panelStyles.panelDivider} />
                <div className={panelStyles.panelHeader}>Select Form</div>
                <input
                    type="text"
                    placeholder="Search forms..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className={panelStyles.searchInput}
                    style={{ width: '90%', margin: '0 auto 10px auto', display: 'block' }}
                />
                <div className={panelStyles.formListContainer}>
                    {Object.entries(groupedForms).length === 0 ? (
                        <div style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>
                            Access Denied
                        </div>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {Object.entries(groupedForms).map(([categoryName, formsInCategory]) => (
                                <li key={categoryName}>
                                    <div
                                        className={`${panelStyles.categoryHeader} ${collapsedCategories[categoryName] ? panelStyles.collapsed : ""}`}
                                        onClick={() => toggleCategory(categoryName)}
                                    >
                                        {categoryName} ({formsInCategory.length})
                                    </div>
                                    {!collapsedCategories[categoryName] && (
                                        <ul className={panelStyles.protocolList}>
                                            {formsInCategory.map((form) => (
                                                <li
                                                    key={form.firebaseKey}
                                                    onClick={() => {
                                                        onSelectForm(form);
                                                        setIsPanelOpen(false);
                                                    }}
                                                    className={`${panelStyles.formCard} ${selectedForm?.firebaseKey === form.firebaseKey ? panelStyles.selected : ""}`}
                                                >
                                                    <div className={panelStyles.formTitle}>{form.name}</div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </>
        )}

        <div className={panelStyles.panelDivider} />
        <div className={panelStyles.panelHeader}>Tools</div>

        {onToggleSavedReports && (
            <button className={panelStyles.panelButton} onClick={() => handleAction(onToggleSavedReports)}>
                <i className="fas fa-save"></i> Saved Reports
            </button>
        )}

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowMapModal(true))}>
          <i className="fas fa-map-marked-alt"></i> GTA Map (Beta)
        </button>

        <button className={panelStyles.panelButton} onClick={() => handleAction(() => setShowBusinessCardModal(true))}>
          <i className="fas fa-id-card"></i> Business Card
        </button>

        {/* Custom children buttons */}
        {children}

        <div className={panelStyles.panelDivider} />
        <div className={panelStyles.panelHeader}>Dev Feature</div>
        {onOpenBotConsent && (
          <button
            className={panelStyles.panelButton}
            onClick={() => handleAction(onOpenBotConsent)}
            style={{
              border: '1px solid #6366f1',
              background: '#1a1a3a',
            }}
          >
            <i className="fas fa-robot" style={{ color: '#6366f1' }}></i>
            <span style={{ flex: 1 }}>Bot Consent Settings</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: 10,
              background: '#6366f1',
              color: '#fff',
            }}>
              SETUP
            </span>
          </button>
        )}

        <div className={panelStyles.panelDivider} />
        <div className={panelStyles.panelHeader}>Settings & Help</div>

        {onStartTour && (
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
        <img src={phmcLogoSrc} alt="PHMC Logo" style={{ height: '65px' }} />
      </div>

      <MapModal
        show={showMapModal}
        onHide={() => setShowMapModal(false)}
      />

      <BusinessCardModal
        show={showBusinessCardModal}
        onHide={() => setShowBusinessCardModal(false)}
        showNotification={showNotification}
        handleImageUpload={handleImageUpload}
      />
    </React.Fragment>
  );
};

export default SidebarNav;
