// src/components/UI/Notification.jsx
// Custom dark-themed toast — replaces react-bootstrap Toast
import React, { useEffect, useState } from 'react';

const TYPE_ACCENTS = {
  success: { bar: '#22c55e', icon: 'fa-check-circle' },
  danger:  { bar: '#ef4444', icon: 'fa-exclamation-circle' },
  warning: { bar: '#f59e0b', icon: 'fa-exclamation-triangle' },
  info:    { bar: '#6366f1', icon: 'fa-info-circle' },
  primary: { bar: '#6366f1', icon: 'fa-spinner fa-spin' },
};

const Notification = ({ message, icon, type = 'info', onDismiss, actions }) => {
  const [visible, setVisible] = useState(false);
  const accent = TYPE_ACCENTS[type] || TYPE_ACCENTS.info;

  useEffect(() => {
    // Trigger enter animation after mount
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Extract the fa-* class from the icon string (e.g. "fas fa-check-circle me-2")
  const iconClass = icon?.split(' ').find(c => c.startsWith('fa-')) || accent.icon;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-accent)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
        marginBottom: 10,
        minWidth: 320,
        maxWidth: 420,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(40px)',
        transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: 'auto',
      }}
    >
      {/* Accent bar */}
      <div style={{
        width: 4,
        flexShrink: 0,
        background: accent.bar,
        alignSelf: 'stretch',
      }} />

      {/* Icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 14,
        color: accent.bar,
        fontSize: 15,
        flexShrink: 0,
      }}>
        <i className={`fas ${iconClass}`} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        padding: '13px 12px',
        fontSize: 13,
        color: 'var(--text)',
        lineHeight: 1.45,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message}
          </span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-faint)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: 14,
                lineHeight: 1,
                flexShrink: 0,
                opacity: 0.6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        {actions && actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.handler?.()}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-accent)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-muted)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-surface-hover)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notification;
