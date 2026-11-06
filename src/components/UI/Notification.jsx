// src/components/UI/Notification.jsx
// Custom dark-themed toast — replaces react-bootstrap Toast.
// On the new platform route (.pmc) it switches to the compact platform palette
// so notifications match the surrounding UI instead of the legacy navy theme.
import React, { useEffect, useState } from 'react';

const TYPE_ACCENTS = {
  success: { bar: '#22c55e', icon: 'fa-check-circle' },
  danger:  { bar: '#ef4444', icon: 'fa-exclamation-circle' },
  warning: { bar: '#f59e0b', icon: 'fa-exclamation-triangle' },
  info:    { bar: '#6366f1', icon: 'fa-info-circle' },
  primary: { bar: '#6366f1', icon: 'fa-spinner fa-spin' },
};

const PLATFORM_ACCENTS = {
  success: '#3aa08a',
  danger:  '#d63a3a',
  warning: '#c99a3a',
  info:    '#8e8e96',
  primary: '#d63a3a',
};

const Notification = ({ message, icon, type = 'info', onDismiss, actions }) => {
  const [visible, setVisible] = useState(false);
  const accent = TYPE_ACCENTS[type] || TYPE_ACCENTS.info;
  const platform = typeof document !== 'undefined' && !!document.querySelector('.pmc');

  const ui = platform
    ? {
        background: '#121214',
        border: '1px solid #232327',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        marginBottom: 8,
        minWidth: 260,
        maxWidth: 360,
        text: '#e9e9ec',
        muted: '#8e8e96',
        padding: '10px 12px',
        fontSize: 12.5,
        fontFamily: '"Segoe UI", system-ui, -apple-system, Arial, sans-serif',
        barWidth: 3,
        actionBg: '#17171a',
        actionBorder: '#232327',
        actionHoverBg: '#1d1d22',
      }
    : {
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-accent)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
        marginBottom: 10,
        minWidth: 320,
        maxWidth: 420,
        text: 'var(--text)',
        muted: 'var(--text-faint)',
        padding: '13px 12px',
        fontSize: 13,
        fontFamily: 'inherit',
        barWidth: 4,
        actionBg: 'var(--bg-surface)',
        actionBorder: 'var(--border-accent)',
        actionHoverBg: 'var(--bg-surface-hover)',
      };

  useEffect(() => {
    // Trigger enter animation after mount
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Extract the fa-* class from the icon string (e.g. "fas fa-check-circle me-2")
  const iconClass = icon?.split(' ').find(c => c.startsWith('fa-')) || accent.icon;
  const bar = platform ? (PLATFORM_ACCENTS[type] || PLATFORM_ACCENTS.info) : accent.bar;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: ui.background,
        border: ui.border,
        borderRadius: ui.borderRadius,
        boxShadow: ui.boxShadow,
        marginBottom: ui.marginBottom,
        minWidth: ui.minWidth,
        maxWidth: ui.maxWidth,
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(40px)',
        transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: 'auto',
        fontFamily: ui.fontFamily,
      }}
    >
      {/* Accent bar */}
      <div style={{ width: ui.barWidth, flexShrink: 0, background: bar, alignSelf: 'stretch' }} />

      {/* Icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: platform ? 11 : 14,
        color: bar,
        fontSize: platform ? 14 : 15,
        flexShrink: 0,
      }}>
        <i className={`fas ${iconClass}`} />
      </div>

      {/* Body */}
      <div style={{
        flex: 1,
        padding: ui.padding,
        fontSize: ui.fontSize,
        color: ui.text,
        lineHeight: 1.45,
        display: 'flex',
        flexDirection: 'column',
        gap: platform ? 6 : 8,
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {message}
          </span>
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: ui.muted,
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: platform ? 13 : 14,
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
                  padding: platform ? '4px 10px' : '5px 12px',
                  borderRadius: 6,
                  border: `1px solid ${ui.actionBorder}`,
                  background: ui.actionBg,
                  color: ui.muted,
                  fontSize: platform ? 11 : 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = ui.actionHoverBg;
                  e.currentTarget.style.color = ui.text;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = ui.actionBg;
                  e.currentTarget.style.color = ui.muted;
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
