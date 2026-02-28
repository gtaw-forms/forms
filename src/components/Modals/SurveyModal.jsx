import React, { useState } from 'react';
import styles from './SurveyModal.module.css';

const SurveyModal = ({ show, onClose, survey, onSubmit }) => {
  const [response, setResponse] = useState('');

  if (!show || !survey) {
    return null;
  }

  const handleSubmit = () => {
    onSubmit(survey.id, response);
    setResponse('');
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>{survey.title || 'Survey'}</div>
        <p className={styles.modalQuestion}>{survey.question || 'Please provide your feedback.'}</p>
        <textarea
          className={styles.inputField}
          rows="3"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Your response..."
        />
        <div className={styles.modalActions}>
          <button onClick={onClose} className={`${styles.btn} ${styles.btnSecondary}`}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!response.trim()} className={`${styles.btn} ${styles.btnPrimary}`}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveyModal;
