// components/KeywordEditModal.jsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import './CctvRequestWebhookModal.css'; // Reuse your existing modal styles

const KeywordEditModal = ({ show, onHide, keyword, onSave }) => {
  const [form, setForm] = useState({
    keyword: '',
    definition: '',
    tip: '',
  });

  useEffect(() => {
    if (keyword) {
      setForm({
        keyword: keyword.keyword || '',
        definition: keyword.definition || '',
        tip: keyword.tip || '',
      });
    } else {
      setForm({ keyword: '', definition: '', tip: '' });
    }
  }, [keyword]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.keyword.trim() || !form.definition.trim()) {
      alert('Keyword and Definition are required!');
      return;
    }
    await onSave(keyword?.id, form);
    onHide();
  };

  if (!show) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onHide}>
      <div className="keyword-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="keyword-modal-header">
          <h4 className="keyword-modal-title">
            {keyword?.id ? 'Edit' : 'Add'} Keyword
          </h4>
          <button type="button" className="modal-close-btn" onClick={onHide}>×</button>
        </div>

        <div className="keyword-modal-body">
          <div className="keyword-form-section">
            <div className="keyword-form-row">
              <div className="keyword-form-group">
                <label className="keyword-form-label required">Keyword</label>
                <input
                  type="text"
                  className="form-control"
                  name="keyword"
                  value={form.keyword}
                  onChange={handleChange}
                  placeholder="e.g. ETCO2"
                />
              </div>
            </div>

            <div className="keyword-form-row">
              <div className="keyword-form-group full-width">
                <label className="keyword-form-label required">Definition</label>
                <textarea
                  className="form-control keyword-textarea"
                  rows="5"
                  name="definition"
                  value={form.definition}
                  onChange={handleChange}
                  placeholder="End-tidal carbon dioxide — measurement of CO2 at the end of exhalation..."
                />
              </div>
            </div>

            <div className="keyword-form-row">
              <div className="keyword-form-group full-width">
                <label className="keyword-form-label">Quick Tip (Optional)</label>
                <textarea
                  className="form-control keyword-textarea"
                  rows="3"
                  name="tip"
                  value={form.tip}
                  onChange={handleChange}
                  placeholder="Normal range: 35–45 mmHg"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="keyword-modal-footer">
          <button className="btn btn-secondary" onClick={onHide}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {keyword?.id ? 'Save Changes' : 'Create Keyword'}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};
export default KeywordEditModal;