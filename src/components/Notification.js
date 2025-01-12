import React from 'react';

const Notification = ({ message, icon, onDismiss }) => (
  <div className="notification-wrapper">
    <div className="notification-content">
      <i className={`fas fa-${icon}`}></i>
      <span>{message}</span>
      <button onClick={onDismiss} className="notification-dismiss">
        <i className="fas fa-times"></i>
      </button>
    </div>
  </div>
);

export default Notification;