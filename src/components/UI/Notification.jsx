// src/components/Notification.js
import React from 'react';
import { Toast, Button } from 'react-bootstrap';

const Notification = ({ message, icon, type, onDismiss, actions }) => (
  <Toast 
    onClose={onDismiss} 
    className="d-inline-block m-1" 
    bg={type === 'info' ? 'primary' : type} // Bootstrap mapping
    autohide={false} // Managed by context
    style={{ color: 'white' }}
  >
    <Toast.Body className="d-flex align-items-center">
      <div className="flex-grow-1">
        {icon && <i className={`${icon} me-2`}></i>}
        {message}
      </div>
      <button 
        onClick={onDismiss} 
        className="btn-close btn-close-white ms-2" 
        aria-label="Close"
      ></button>
    </Toast.Body>
    {actions && actions.length > 0 && (
      <div className="p-2 border-top border-white border-opacity-25 d-flex justify-content-end gap-1">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'outline-light'}
            size="sm"
            onClick={() => {
              if (action.handler) action.handler();
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>
    )}
  </Toast>
);

export default Notification;