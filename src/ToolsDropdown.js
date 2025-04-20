import React, { useState } from 'react'; // Import useState
import { Dropdown } from 'react-bootstrap';
import './buttons.css'; // Make sure to import your CSS file

const ToolsDropdown = ({
    onShowMissingEmployee,
    onShowFeatureRequest,
    onShowSavedReports
}) => {
    // 1. Add state to control visibility
    const [isOpen, setIsOpen] = useState(false);

    // 2. Create a toggle handler
    const handleToggle = (nextOpenState, event, metadata) => {
        // Basic toggle: just set the state to the next value
        setIsOpen(nextOpenState);
    };

    const handleItemClick = (callback) => {
        return () => {
            callback(); // Call the original function (e.g., onShowMissingEmployee)
            setIsOpen(false); // Explicitly close the dropdown
        };
    };


    return (
        <div className="tools-dropdown-wrapper">
            <Dropdown
                className="floating-buttons-dropdown"
                show={isOpen}
                onToggle={handleToggle}
            >
                <Dropdown.Toggle id="tools-dropdown">
                    <i className="fas fa-tools"></i> Missing Employee Data | Report a Bug / Feature | Saved Reports
                </Dropdown.Toggle>

                {/* Add align="end" if the menu alignment is off */}
                <Dropdown.Menu align="end">
                    <Dropdown.Item onClick={handleItemClick(onShowMissingEmployee)}>
                        <i className="fas fa-user-plus"></i> Missing Employee Data
                    </Dropdown.Item>
                    <Dropdown.Item onClick={handleItemClick(onShowFeatureRequest)}>
                        <i className="fas fa-bug"></i> Report a Bug / Feature
                    </Dropdown.Item>
                    <Dropdown.Item onClick={handleItemClick(onShowSavedReports)}>
                        <i className="fas fa-save"></i> Saved Reports
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        </div>
    );
};

export default ToolsDropdown;
