import React, { useState, lazy, Suspense } from 'react';
import SidebarNav from '../UI/SidebarNav';
import BaseModal from '../Modals/BaseModal';
import { useNotification } from '../../contexts/NotificationContext';
import panelStyles from '../UI/SidebarNav.module.css'; // Import styles for the button

const CctvRequestWebhookModal = lazy(() => import('../Admin/CctvRequestWebhookModal'));

/**
 * Adapter for the new SidebarNav in the Form Handler context
 */
const FormHandlerNavButtons = ({ 
    onToggleSavedReports, 
    onToggleAgencyIncident, 
    onStartTour,
    groupedForms,
    collapsedCategories,
    toggleCategory,
    onSelectForm,
    selectedForm,
    searchTerm,
    setSearchTerm,
    phmcLogoSrc
}) => {
  const [showCctvRequestModal, setShowCctvRequestModal] = useState(false);
  const { showNotification } = useNotification();

  return (
    <>
      <SidebarNav 
        onToggleSavedReports={onToggleSavedReports}
        onToggleAgencyIncident={onToggleAgencyIncident}
        onStartTour={onStartTour}
        groupedForms={groupedForms}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        onSelectForm={onSelectForm}
        selectedForm={selectedForm}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        phmcLogoSrc={phmcLogoSrc}
      >
        {/* CCTV Request Button */}
        <button className={panelStyles.panelButton} onClick={() => setShowCctvRequestModal(true)}>
          <i className="fas fa-camera"></i> Request CCTV Footage
        </button>
      </SidebarNav>

      <Suspense fallback={<div>Loading...</div>}>
        <CctvRequestWebhookModal
          isOpen={showCctvRequestModal}
          onHide={() => setShowCctvRequestModal(false)}
          showNotification={showNotification}
        />
      </Suspense>
    </>
  );
};

export default FormHandlerNavButtons;
