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
    setSearchTerm
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
    />
  );
};

export default FormHandlerNavButtons;
