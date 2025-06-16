// src/components/Notification.js
import React from 'react';

const Notification = ({ message, icon, onDismiss, actions = [] }) => (
  <div className="notification-wrapper">
    <div className="notification-content">
      {icon && <i className={`${icon} notification-icon`}></i>}
      <span className="notification-message">{message}</span>
      <button onClick={onDismiss} className="notification-dismiss" aria-label="Dismiss notification">
        <i className="fas fa-times"></i>
      </button>
    </div>
    {actions.length > 0 && (
      <div className="notification-actions">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              if (action.handler) action.handler();
              onDismiss(); // Dismiss notification after action is handled
            }}
            className={`notification-action-button notification-action-${action.variant || 'default'}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

export default Notification;
