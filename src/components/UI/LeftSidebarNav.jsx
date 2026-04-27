import React, { useState, useEffect } from 'react';
import panelStyles from './SidebarNav.module.css'; // Reusing existing styles for consistency

const LeftSidebarNav = ({ 
  groupedForms,
  collapsedCategories,
  toggleCategory,
  onSelectForm,
  selectedForm,
  searchTerm,
  setSearchTerm,
  onPanelToggle, // New prop to notify parent of state change
  initialOpen = true
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(initialOpen); // Initialize from prop

  const togglePanel = () => {
    const newState = !isPanelOpen;
    setIsPanelOpen(newState);
    if (onPanelToggle) {
        onPanelToggle(newState);
    }
  };

  // Sync initial state on mount
  useEffect(() => {
      if (onPanelToggle) {
          onPanelToggle(isPanelOpen);
      }
  }, []);

  return (
    <React.Fragment>
      {/* Sidebar Toggle & Container - Left Aligned */}
      <div className={panelStyles.navContainer} style={{ left: '10px', right: 'auto', alignItems: 'flex-start' }}>
        <button 
          className={`${panelStyles.toggleButton} ${isPanelOpen ? panelStyles.active : ''}`}
          onClick={togglePanel}
          title={isPanelOpen ? "Close Forms List" : "Open Forms List"}
        >
          <i className={`fas ${isPanelOpen ? 'fa-chevron-left' : 'fa-list'}`}></i>
        </button>
      </div>

      {/* Overlay */}
      <div 
        className={`${panelStyles.panelOverlay} ${isPanelOpen ? panelStyles.show : ''}`} 
        onClick={() => {
            setIsPanelOpen(false);
            if (onPanelToggle) onPanelToggle(false);
        }}
        style={{ zIndex: 1045 }} // Slightly lower than right panel
      />

      {/* Sliding Panel - Left Aligned */}
      <div 
        className={`${panelStyles.slidingPanel} ${isPanelOpen ? panelStyles.open : ''}`}
        style={{ 
            right: 'auto', 
            left: 0, 
            transform: isPanelOpen ? 'translateX(0)' : 'translateX(-100%)',
            borderRight: '1px solid #30363d',
            borderLeft: 'none'
        }}
      >
        <div className={panelStyles.panelHeader}>Select Form</div>
        
        <input
            type="text"
            placeholder="Search forms..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={panelStyles.searchInput}
            style={{ width: '90%', margin: '0 auto 15px auto', display: 'block' }}
        />

        <div className={panelStyles.formListContainer} style={{ height: 'calc(100% - 100px)' }}>
            {groupedForms && Object.entries(groupedForms).length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: "1rem" }}>
                    Access Denied
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {groupedForms && Object.entries(groupedForms).map(([categoryName, formsInCategory]) => (
                        <div key={categoryName}>
                            <div
                                className={`${panelStyles.categoryHeader} ${collapsedCategories[categoryName] ? panelStyles.collapsed : ""}`}
                                onClick={() => toggleCategory(categoryName)}
                                style={{ 
                                    background: '#334155', 
                                    color: '#e2e8f0',
                                    padding: '10px', 
                                    borderRadius: '8px', 
                                    marginBottom: '5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <span>{categoryName}</span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{formsInCategory.length}</span>
                            </div>
                            {!collapsedCategories[categoryName] && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '5px', marginBottom: '10px' }}>
                                    {formsInCategory.map((form) => (
                                        <button
                                            key={form.firebaseKey}
                                            onClick={() => {
                                                onSelectForm(form);
                                                // Optional: Close panel on mobile, keep open on desktop
                                                if (window.innerWidth < 768) {
                                                    setIsPanelOpen(false);
                                                    if (onPanelToggle) onPanelToggle(false);
                                                }
                                            }}
                                            className={panelStyles.panelButton}
                                            style={{
                                                textAlign: 'left',
                                                background: selectedForm?.firebaseKey === form.firebaseKey ? '#4f46e5' : 'transparent',
                                                border: selectedForm?.firebaseKey === form.firebaseKey ? 'none' : '1px solid #334155',
                                                justifyContent: 'flex-start',
                                                padding: '10px 15px'
                                            }}
                                        >
                                            <i className="fas fa-file-alt" style={{ marginRight: '10px', opacity: 0.7 }}></i>
                                            {form.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </React.Fragment>
  );
};

export default LeftSidebarNav;
