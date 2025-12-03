import React, { useState } from 'react';
import { useGtaWorldAuth } from '../hooks/useGtaWorldAuth'; // Assuming path is correct

const BugReportModal = ({ show, onClose, webhookUrl, showNotification }) => {
  const [report, setReport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useGtaWorldAuth();

  if (!show) {
    return null;
  }

  const handleSubmit = async () => {
    if (!report.trim()) {
      showNotification('Please enter a description of the bug.', 'warning');
      return;
    }
    if (!webhookUrl) {
      console.error('VITE_DEV_DISCORD webhook URL is not defined.');
      showNotification('Cannot submit bug report: Webhook URL is not configured.', 'error');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      embeds: [
        {
          title: 'New Bug Report',
          description: report,
          color: 15158332, // Red
          fields: [
            {
              name: 'Reporter',
              value: user ? `${user.username} (ID: ${user.id})` : 'Anonymous / Not logged in',
              inline: true,
            },
            {
              name: 'Timestamp',
              value: new Date().toISOString(),
              inline: true,
            },
          ],
          footer: {
            text: 'PHMC Forms - Bug Reporter',
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showNotification('Bug report submitted successfully!', 'success');
        setReport('');
        onClose();
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      showNotification('Failed to submit bug report. Please try again later.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Basic modal styling
  const modalStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050,
  };

  const contentStyle = {
    background: '#1e293b',
    padding: '2rem',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '500px',
    color: '#e2e8f0',
  };

  const textareaStyle = {
    width: '100%',
    minHeight: '150px',
    padding: '0.8rem',
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#e2e8f0',
    borderRadius: 8,
    marginBottom: '1rem',
  };

  const buttonStyle = {
    padding: '0.8rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
  };

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={contentStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: "#a78bfa", marginBottom: "1.5rem" }}>Submit a Bug Report</h3>
        <textarea
          style={textareaStyle}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          placeholder="Please describe the bug in detail. What were you doing? What did you expect to happen? What actually happened?"
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button
            style={{ ...buttonStyle, background: '#475569' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            style={{ ...buttonStyle, background: '#6366f1' }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BugReportModal;
