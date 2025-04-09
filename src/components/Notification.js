// filepath: src/components/Notification.js
import React from 'react';

const Notification = ({ message, icon, onDismiss }) => (
  <div className="notification-wrapper">
    <div className="notification-content">
      {icon && <i className={`${icon} notification-icon`}></i>} {/* Conditionally render icon */}
      <span className="notification-message">{message}</span> {/* Render message directly */}
      <button onClick={onDismiss} className="notification-dismiss">
        <i className="fas fa-times"></i>
      </button>
    </div>
  </div>
);

export default Notification;
