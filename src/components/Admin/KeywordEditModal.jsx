// components/KeywordEditModal.jsx
import React, { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import BaseModal from '../Modals/BaseModal';
import { Button, Form } from 'react-bootstrap';

const KeywordEditModal = ({ show, onHide, keyword, onSave, type = 'keyword' }) => {
  const { showNotification } = useNotification();
  const [form, setForm] = useState({ keyword: '', definition: '', tip: '' });

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
      showNotification(`${type === 'injury' ? 'Injury Name' : 'Keyword'} and ${type === 'injury' ? 'Triggers' : 'Definition'} are required!`, 'warning');
      return;
    }
    await onSave(keyword?.id, form);
    onHide();
  };

  return (
    <BaseModal
      isOpen={show}
      onClose={onHide}
      title={keyword?.id 
        ? (type === 'injury' ? 'Edit Injury Type' : 'Edit Keyword')
        : (type === 'injury' ? 'Add Injury Type' : 'Add Keyword')
      }
      modalSize="medium"
      variant={type === 'injury' ? 'warning' : 'info'}
      footer={
        <>
          <Button variant="secondary" onClick={onHide}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} style={{ marginLeft: '10px' }}>
            {keyword?.id ? 'Save Changes' : 'Create'}
          </Button>
        </>
      }
    >
      <Form style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <Form.Group>
          <Form.Label style={{ color: '#8b949e' }}>
            {type === 'injury' ? 'Injury Name *' : 'Keyword *'}
          </Form.Label>
          <Form.Control 
            type="text" 
            name="keyword" 
            value={form.keyword} 
            onChange={handleChange} 
            placeholder={type === 'injury' ? "e.g. Gunshot Wound" : "e.g. ETCO2"}
            style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }}
          />
        </Form.Group>

        <Form.Group>
          <Form.Label style={{ color: '#8b949e' }}>
            {type === 'injury' ? 'Trigger Words * (comma-separated)' : 'Definition *'}
          </Form.Label>
          <Form.Control 
            as="textarea" 
            rows={type === 'injury' ? 3 : 5} 
            name="definition" 
            value={form.definition} 
            onChange={handleChange}
            placeholder={type === 'injury' ? "GSW, gunshot, shooting" : "Definition goes here..."}
            style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }}
          />
        </Form.Group>

        {type === 'keyword' && (
          <Form.Group>
            <Form.Label style={{ color: '#8b949e' }}>Quick Tip (Optional)</Form.Label>
            <Form.Control 
              as="textarea" 
              rows={2} 
              name="tip" 
              value={form.tip} 
              onChange={handleChange}
              placeholder="e.g. Normal range: 35–45 mmHg"
              style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }}
            />
          </Form.Group>
        )}
      </Form>
    </BaseModal>
  );
};

export default KeywordEditModal;
