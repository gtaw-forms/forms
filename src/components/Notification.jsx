// src/components/Notification.js
import React from 'react';
import { Button } from 'react-bootstrap';

const Notification = ({ message, icon, onDismiss, actions }) => (
  <div className="notification-wrapper">
    <div className="notification-content" style={{ display: 'flex', flexDirection: 'column' }}> {/* Ensure flex column layout */}
      <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}> {/* Main content row */}
        {icon && <i className={`${icon} notification-icon`} style={{ marginRight: '10px' }}></i>}
        <span className="notification-message" style={{ flexGrow: 1, wordBreak: 'break-word' }}>{message}</span>
        <button onClick={onDismiss} className="notification-dismiss" style={{ marginLeft: '10px' }}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      {/* Render action buttons if provided */}
      {actions && actions.length > 0 && (
        <div
          className="notification-actions"
          style={{
            marginTop: '10px',
            display: 'flex',
            justifyContent: 'flex-end', // Aligns buttons to the right
            gap: '5px',
            width: '100%', // Ensure it takes full width to allow justify-content to work
            flexShrink: 0, // Prevent actions div from shrinking if message is long
          }}
        >
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'outline-light'}
              size="sm"
              onClick={() => {
                if (action.handler) action.handler();
              }}
              className="notification-action-button"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default Notification;
