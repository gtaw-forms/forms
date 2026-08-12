import React from 'react';
import './TestModal.css';

/**
 * Minimal inline modal — no portals, no BaseModal.
 * Renders directly where it sits in the component tree.
 * Used to isolate whether BaseModal's createPortal is the issue.
 */
const TestModal = ({ show, onClose, title, children }) => {
  if (!show) return null;

  return (
    <div className="test-overlay" onClick={onClose}>
      <div className="test-box" onClick={e => e.stopPropagation()}>
        <div className="test-head">
          <h3>{title || 'Modal'}</h3>
          <button className="test-close" onClick={onClose}>✕</button>
        </div>
        <div className="test-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default TestModal;
