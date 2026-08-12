import React, { useState } from 'react';
import { useGtaWorldAuth } from '../../hooks/useGtaWorldAuth';
import { triggerWebhookProxy } from '../../services/firebaseFunctions';

const BugReportModal = ({ show, onClose, showNotification }) => {
  const [report, setReport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useGtaWorldAuth();

  if (!show) return null;

  const handleSubmit = async () => {
    if (!report.trim()) {
      showNotification('Please enter a description of the bug.', 'warning');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      embeds: [
        {
          title: 'New Bug Report',
          description: report,
          color: 15158332,
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
      await triggerWebhookProxy('admin', payload);
      showNotification('Bug report submitted successfully!', 'success');
      setReport('');
      onClose();
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      showNotification('Failed to submit bug report. Please try again later.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay open" onClick={onClose} style={{ display: 'flex' }}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3><i className="fas fa-bug" style={{ color: 'var(--teal, #33D6C0)' }} /> Submit a Bug Report</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted, #8B96AE)', marginBottom: 12, lineHeight: 1.5 }}>
            Please describe the bug in detail. What were you doing? What did you expect to happen? What actually happened?
          </p>
          <textarea
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Describe the bug..."
            style={{ minHeight: 140, resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.6 : 1 }}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BugReportModal;
