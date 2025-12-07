import React, { useState, useRef, useEffect } from 'react';
import './Dropdown.css';

const Dropdown = ({ trigger, children, onTriggerClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (onTriggerClick) {
      onTriggerClick();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // New part to close on item click
  const handleMenuClick = () => {
      setIsOpen(false);
  };

  return (
    <div className="dropdown" ref={dropdownRef}>
      <div onClick={toggleDropdown} style={{ cursor: 'pointer' }}>
        {trigger}
      </div>
      {isOpen && (
        <div className="dropdown-menu" onClick={handleMenuClick}>
          {children}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
