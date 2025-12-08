import React, { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { sendDiscordWebhook } from '../utils/webhookUtils';
import styles from './FormRequestModal.module.css';

const FormRequestModal = ({ show, onClose }) => {
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('Placeholder');
  const [formBbcode, setFormBbcode] = useState('');
  const [discordName, setDiscordName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showNotification } = useNotification();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName || !formBbcode || !discordName) {
      showNotification('Please fill out all fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;

    const embed = {
      username: "Form Request Bot",
      embeds: [
        {
          title: 'New Form Request',
          color: 7506394, // Blurple
          fields: [
            { name: 'Requested By', value: discordName, inline: true },
            { name: 'Form Name', value: formName, inline: true },
            { name: 'Form Type', value: formType, inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'PHMC Forms - Request' },
        },
      ],
    };

    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(embed));
    const bbcodeBlob = new Blob([formBbcode], { type: 'text/plain' });
    formData.append('files[0]', bbcodeBlob, `${formName.replace(/\s+/g, '_') || 'form'}_request.bbcode`);


    try {
      await sendDiscordWebhook(webhookUrl, formData);
      showNotification('Form request submitted successfully!', 'success');
      onClose();
      // Reset fields
      setFormName('');
      setFormType('Placeholder');
      setFormBbcode('');
      setDiscordName('');
    } catch (error) {
      console.error("Failed to submit form request:", error);
      showNotification('Failed to submit form request. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Request a New Form</h2>
          <button onClick={onClose} className={styles.modalCloseButton}>&times;</button>
        </div>
        <div className={styles.modalBody}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="discordName">Discord Name</label>
              <input
                id="discordName"
                type="text"
                value={discordName}
                onChange={(e) => setDiscordName(e.target.value)}
                placeholder="e.g., Alyson"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="formName">Form Name</label>
              <input
                id="formName"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Vehicle Maintenance Log"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="formType">Form Type</label>
              <select id="formType" value={formType} onChange={(e) => setFormType(e.target.value)}>
                <option value="Placeholder">Placeholder</option>
                <option value="PHMC">PHMC</option>
                <option value="ER">ER</option>
                <option value="Misc">Misc</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="formBbcode">Form BBCode</label>
              <textarea
                id="formBbcode"
                value={formBbcode}
                onChange={(e) => setFormBbcode(e.target.value)}
                rows="10"
                placeholder="Paste the desired BBCode for the form here."
                required
              />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onClose}>Cancel</button>
              <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FormRequestModal;
