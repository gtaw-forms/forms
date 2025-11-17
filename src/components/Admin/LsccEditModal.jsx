// LsccEditModal.jsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { database } from '../../firebase';
import { ref, get, set } from 'firebase/database';
import './CctvRequestWebhookModal.css'; // Keep your styling

const LsccEditModal = ({ show, onHide, item, onSave, categories, loading: parentLoading }) => {
  const [currentItem, setCurrentItem] = useState(item || {
    name: '',
    content: '',
    category: '',
    images: [],
    uniqueWords: []
  });
  const [rawUniqueWordsInput, setRawUniqueWordsInput] = useState(''); // New state
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrentItem(item || { name: '', content: '', category: '', images: [], uniqueWords: [] });
    setRawUniqueWordsInput(Array.isArray(item?.uniqueWords) ? item.uniqueWords.join(', ') : '');
  }, [item]);
const normalizeProtocols = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(cat => ({
    ...cat,
    protocols: Array.isArray(cat.protocols) ? cat.protocols : []
  }));
};
const sendDiscordWebhook = async (title, description, color = 3447003, fields = []) => {
  const webhookUrl = import.meta.env.VITE_DEV_WEBHOOK;
  if (!webhookUrl) return; // Only skip if webhookUrl is not defined

  const embed = {
    title,
    description,
    color,
    fields,
    timestamp: new Date().toISOString(),
    footer: { text: 'LSCC Protocol Manager • Edited by Admin' },
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.warn('Discord webhook failed (non-blocking):', err);
  }
};

const formatProtocolText = (text = '', images = []) => {
  if (!text) return text;

  // First, apply inline formatting (bold, underline)
  let formattedText = text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')   // *bold*
    .replace(/_([^_]+)_/g, '<u>$1</u>');               // _underline_

  // Then, handle image placeholders
  formattedText = formattedText.replace(/\{image(\d+)\}/g, (match, index) => {
    const imgIndex = parseInt(index) - 1;
    if (images[imgIndex]) {
      return `<span style="color: #007bff; font-weight: bold;">[Image ${index}: ${images[imgIndex]}]</span>`;
    }
    return `<span style="color: #dc3545; font-weight: bold;">[Image ${index}: URL not found]</span>`;
  });

  // Then, handle bullet points and nested lists
  const lines = formattedText.split('\n');
  let html = [];
  let openLists = []; // Stack to keep track of open <ul> tags

  lines.forEach(line => {
    const trimmedLine = line.trim();
    let currentLevel = 0;

    if (trimmedLine.startsWith('>>')) {
      currentLevel = 2;
    } else if (trimmedLine.startsWith('>')) {
      currentLevel = 1;
    }

    const content = trimmedLine.substring(currentLevel > 0 ? currentLevel : 0).trim();

    if (currentLevel > 0) {
      // Close lists that are at a higher level than the current line
      while (openLists.length > currentLevel) {
        html.push('</ul>');
        openLists.pop();
      }
      // Open new lists if the current level is deeper than the stack
      while (openLists.length < currentLevel) {
        html.push('<ul>');
        openLists.push('ul');
      }
      html.push(`<li>${content}</li>`);
    } else {
      // Not a list item, close all open lists
      while (openLists.length > 0) {
        html.push('</ul>');
        openLists.pop();
      }
      if (trimmedLine.length > 0) {
        html.push(`<p>${trimmedLine}</p>`);
      }
    }
  });

  // Close any remaining open lists
  while (openLists.length > 0) {
    html.push('</ul>');
    openLists.pop();
  }

  return html.join('');
};


const handleChange = (e) => {
  const { name, value } = e.target;

  if (name === 'images') {
    // Split by lines, keep empty ones, only trim whitespace, don't filter them out
    const imageArray = value
      .split('\n')
      .map(line => line.trimEnd())  // Only trim trailing spaces (keep empty lines!)
      .map(line => {
        const trimmed = line.trim();
        // Only remove line if it's completely empty AND not between URLs
        return trimmed === '' ? '' : trimmed;
      })
      .filter(line => line !== null); // keep everything

    // Optional: Clean up duplicate empty lines later on save
    setCurrentItem(prev => ({ ...prev, images: imageArray }));
  } else if (name === 'uniqueWords') {
    setRawUniqueWordsInput(value); // Store raw input
  } else {
    setCurrentItem(prev => ({ ...prev, [name]: value }));
  }
};

const handleSave = async () => {
    if (!currentItem.name.trim() || !currentItem.category.trim()) {
      alert('Name and Category are required!');
      return;
    }

    setSaving(true);
    try {
      const protocolsRef = ref(database, 'lscc/protocols');
      const snapshot = await get(protocolsRef);
      let protocols = normalizeProtocols(snapshot.val() || []);

      const newCategory = currentItem.category.trim();
      const isEditing = !!currentItem.id;

      let oldCategory = null;
      if (isEditing) {
        // Find old category for logging
        const found = protocols.find(cat =>
          cat.protocols.some(p => p.id === currentItem.id)
        );
        oldCategory = found?.category || 'Unknown';
      }

      // === 1. Remove from old category (if editing) ===
      if (isEditing) {
        protocols = protocols.map(cat => ({
          ...cat,
          protocols: cat.protocols.filter(p => p.id !== currentItem.id)
        }));
      }

      // === 2. Find or create target category ===
      let targetCat = protocols.find(c => c.category === newCategory);
      if (!targetCat) {
        targetCat = { category: newCategory, protocols: [] };
        protocols.push(targetCat);
      }

      // === 3. Create saved item ===
      let savedItem;
      if (isEditing) {
        savedItem = { ...currentItem, category: newCategory };
      } else {
        const newId = `proto-${Date.now()}`;
        savedItem = { ...currentItem, id: newId, category: newCategory };
      }

      // Clean images on save
      savedItem.images = (savedItem.images || [])
        .map(url => url.trim())
        .filter(url => url.length > 0 && /^https?:\/\//i.test(url));

      targetCat.protocols.push(savedItem);

      // Clean unique words on save
      const wordsArray = rawUniqueWordsInput
        .split(',')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length > 0);
      savedItem.uniqueWords = [...new Set(wordsArray)]; // Ensure uniqueness

      // === 4. Clean up empty categories ===
      protocols = protocols.filter(cat => cat.protocols.length > 0);

      await set(protocolsRef, protocols);

      // DISCORD WEBHOOK NOTIFICATION
      if (isEditing) {
        const moved = oldCategory !== newCategory;
        await sendDiscordWebhook(
          moved ? 'Protocol Moved & Edited' : 'Protocol Edited',
          `**${savedItem.name}**`,
          moved ? 15158332 : 3066993, // Red if moved, green if just edited
          [
            { name: 'Category', value: moved ? `${oldCategory} → **${newCategory}**` : newCategory, inline: true },
            { name: 'Editor', value: 'Admin Panel', inline: true },
            { name: 'Images', value: savedItem.images.length.toString(), inline: true },
            { name: 'Protocol ID', value: savedItem.id, inline: false },
          ]
        );
      } else {
        await sendDiscordWebhook(
          'New Protocol Created',
          `**${savedItem.name}**`,
          5763719, // Teal
          [
            { name: 'Category', value: newCategory, inline: true },
            { name: 'Images', value: savedItem.images.length.toString(), inline: true },
            { name: 'Protocol ID', value: savedItem.id, inline: true },
          ]
        );
      }

      onSave?.(savedItem);
      onHide();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save protocol: ' + err.message);
    } finally {
      setSaving(false);
    }
  };  if (!show) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onHide}>
      <div className="cctv-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="cctv-modal-header">
          <h4 className="cctv-title">{currentItem.id ? 'Edit' : 'Add'} Protocol</h4>
          <button type="button" className="modal-close-btn" onClick={onHide}>×</button>
        </div>

        <div className="cctv-modal-body">
          <div className="cctv-form-section">
            <div className="cctv-form-row">
              <div className="cctv-form-group">
                <label className="cctv-form-label required">Protocol Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="name"
                  value={currentItem.name || ''}
                  onChange={handleChange}
                  placeholder="e.g. Cardiac Arrest"
                  disabled={saving}
                />
              </div>
              <div className="cctv-form-group">
                <label className="cctv-form-label required">Category</label>
                <input
                  type="text"
                  className="form-control"
                  name="category"
                  list="category-suggestions"
                  value={currentItem.category || ''}
                  onChange={handleChange}
                  placeholder="e.g. Cardiac"
                  disabled={saving}
                />
                <datalist id="category-suggestions">
                  {categories.map((cat, i) => <option key={i} value={cat} />)}
                </datalist>
              </div>
            </div>

            <div className="cctv-form-row">
              <div className="cctv-form-group full-width">
                <label className="cctv-form-label">
                  Content (use Enter for new lines — {`{image1}`}, {`{image2}`}, etc. for images) 
                  <br />
                  <small>
                    Use *asterisks* for <strong>bold</strong>, _underscores_ for <u>underline</u>,
                    and prefix lines with &gt; or &gt;&gt; for bullet points and nested lists.
                  </small>
                </label>
                <textarea
                  className="form-control cctv-textarea"
                  rows="10"
                  name="content"
                  value={currentItem.content || ''}
                  onChange={handleChange}
                  placeholder="1. Assess airway...
2. Begin CPR...
{image1}
3. Attach monitor..."
                  disabled={saving}
                />
              </div>
            </div>

            <div className="cctv-form-row">
              <div className="cctv-form-group full-width">
                <label className="cctv-form-label">Content Preview</label>
                <div
                  className="form-control cctv-textarea" // Reusing textarea styling for consistency
                  style={{ minHeight: '100px', padding: '10px', overflowY: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: formatProtocolText(currentItem.content, currentItem.images) }}
                />
              </div>
            </div>

            <div className="cctv-form-row">
              <div className="cctv-form-group full-width">
                <label className="cctv-form-label">Image URLs (one per line)</label>
                <textarea
                  className="form-control cctv-textarea"
                  rows="6"
                  name="images"
                  value={Array.isArray(currentItem.images) ? currentItem.images.join('\n') : ''}
                  onChange={handleChange}
                  placeholder="https://i.imgur.com/abc123.png
https://i.imgur.com/def456.png"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="cctv-form-row">
              <div className="cctv-form-group full-width">
                <label className="cctv-form-label">Unique Words (comma-separated)</label>
                <textarea
                  className="form-control cctv-textarea"
                  rows="3"
                  name="uniqueWords"
                  value={rawUniqueWordsInput}
                  onChange={handleChange}
                  placeholder="word1, word2, phrase three"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="cctv-modal-footer">
          <button className="cctv-btn cctv-btn-secondary" onClick={onHide} disabled={saving}>
            Cancel
          </button>
          <button
            className="cctv-btn cctv-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Protocol'}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')
  );
};

export default LsccEditModal;