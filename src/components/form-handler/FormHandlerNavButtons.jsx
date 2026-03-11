import React from 'react';
import SidebarNav from '../UI/SidebarNav';

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
  return (
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
    />
  );
};

export default FormHandlerNavButtons;
