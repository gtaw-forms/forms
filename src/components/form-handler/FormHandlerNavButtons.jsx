import React from 'react';
import SidebarNav from '../UI/SidebarNav';

/**
 * Adapter for the new SidebarNav in the Form Handler context
 */
const FormHandlerNavButtons = ({
    onToggleSavedReports,
    groupedForms,
    collapsedCategories,
    toggleCategory,
    onSelectForm,
    selectedForm,
    searchTerm,
    setSearchTerm,
    onOpenBotConsent,
}) => {
  return (
    <>
      <SidebarNav
        onToggleSavedReports={onToggleSavedReports}
        groupedForms={groupedForms}
        collapsedCategories={collapsedCategories}
        toggleCategory={toggleCategory}
        onSelectForm={onSelectForm}
        selectedForm={selectedForm}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onOpenBotConsent={onOpenBotConsent}
      />
    </>
  );
};

export default FormHandlerNavButtons;
