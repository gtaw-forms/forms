import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import React, { useState, useEffect } from 'react';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import { useNotification } from '../../contexts/NotificationContext';
import BaseModal from '../Modals/BaseModal';
import { Button, Form } from 'react-bootstrap';

const LsccEditModal = ({ show, onHide, item, onSave, categories, logAdminAction, gtawUser, gtawUsername }) => {
  const { showNotification } = useNotification();
  const [currentItem, setCurrentItem] = useState(item || { name: '', content: '', category: '', images: [], uniqueWords: [] });
  const [rawUniqueWordsInput, setRawUniqueWordsInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentItem(item || { name: '', content: '', category: '', images: [], uniqueWords: [] });
    setRawUniqueWordsInput(Array.isArray(item?.uniqueWords) ? item.uniqueWords.join(', ') : '');
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'images') setCurrentItem(prev => ({ ...prev, images: value.split('\n') }));
    else if (name === 'uniqueWords') setRawUniqueWordsInput(value);
    else setCurrentItem(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!currentItem.name.trim() || !currentItem.category.trim()) {
      showNotification('Name and Category are required!', 'warning');
      return;
    }
    setSaving(true);
    try {
      const protocolsRef = ref(database, 'lscc/protocols');
      const snapshot = await get(protocolsRef);
      let protocols = snapshot.val() || [];
      const newCategory = currentItem.category.trim();
      const isEditing = !!currentItem.id;

      if (isEditing) protocols = protocols.map(cat => ({ ...cat, protocols: cat.protocols.filter(p => p.id !== currentItem.id) }));

      let targetCat = protocols.find(c => c.category === newCategory);
      if (!targetCat) { targetCat = { category: newCategory, protocols: [] }; protocols.push(targetCat); }

      const savedItem = { ...currentItem, id: currentItem.id || `proto-${Date.now()}`, category: newCategory };
      savedItem.images = (savedItem.images || []).map(u => u.trim()).filter(u => u.length > 0 && /^https?:\/\//i.test(u));
      savedItem.uniqueWords = [...new Set(rawUniqueWordsInput.split(',').map(w => w.trim().toLowerCase()).filter(w => w.length > 0))];

      targetCat.protocols.push(savedItem);
      await set(protocolsRef, protocols.filter(cat => cat.protocols.length > 0));

      const { userAgent, timeZone } = getUserContext();
      logAdminAction(gtawUsername, isEditing ? 'Edited LSCC Protocol' : 'Added LSCC Protocol', `Protocol: ${savedItem.name}`, 'LSCC Management', userAgent, timeZone, gtawUsername, gtawUser);

      onSave?.(savedItem);
      onHide();
    } catch (err) {
      showNotification('Failed to save protocol: ' + err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <BaseModal
      isOpen={show}
      onClose={onHide}
      title={`${currentItem.id ? 'Edit' : 'Add'} Protocol`}
      modalSize="large"
      variant="info"
      footer={
        <>
          <Button variant="secondary" onClick={onHide} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} style={{ marginLeft: '10px' }}>
            {saving ? 'Saving...' : 'Save Protocol'}
          </Button>
        </>
      }
    >
      <Form style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <Form.Group>
            <Form.Label style={{ color: '#8b949e' }}>Protocol Name *</Form.Label>
            <Form.Control name="name" value={currentItem.name || ''} onChange={handleChange} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
          </Form.Group>
          <Form.Group>
            <Form.Label style={{ color: '#8b949e' }}>Category *</Form.Label>
            <Form.Control name="category" value={currentItem.category || ''} onChange={handleChange} list="cat-suggestions" style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
            <datalist id="cat-suggestions">{categories.map((cat, i) => <option key={i} value={cat} />)}</datalist>
          </Form.Group>
        </div>

        <Form.Group>
          <Form.Label style={{ color: '#8b949e' }}>Content</Form.Label>
          <Form.Control as="textarea" rows={8} name="content" value={currentItem.content || ''} onChange={handleChange} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
        </Form.Group>

        <Form.Group>
          <Form.Label style={{ color: '#8b949e' }}>Image URLs (one per line)</Form.Label>
          <Form.Control as="textarea" rows={3} name="images" value={currentItem.images?.join('\n') || ''} onChange={handleChange} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
        </Form.Group>

        <Form.Group>
          <Form.Label style={{ color: '#8b949e' }}>Unique Words (comma-separated)</Form.Label>
          <Form.Control type="text" name="uniqueWords" value={rawUniqueWordsInput} onChange={handleChange} style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
        </Form.Group>
      </Form>
    </BaseModal>
  );
};

export default LsccEditModal;
