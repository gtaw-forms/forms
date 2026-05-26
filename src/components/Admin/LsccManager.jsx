// LsccManager.jsx
import { logAdminAction, getUserContext } from '../../utils/adminLogger';
import useGtaWorldAuth from '../../hooks/useGtaWorldAuth';
import React, { useState, useEffect, useCallback } from 'react';
import { database } from '../../firebase';
import { ref, get, set, onValue, runTransaction } from 'firebase/database';
import { Button, Spinner, Alert } from 'react-bootstrap';
import KeywordEditModal from './KeywordEditModal';
import LsccEditModal from './LsccEditModal';
import BaseModal from '../Modals/BaseModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import './LsccManager.css';

const SortableProtocolItem = ({ protocol, category, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: protocol.id });
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition, 
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1000 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="protocol-card sortable">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start">
            <h5 className="mb-0">{protocol.name}</h5>
            <span className="category-badge">{category}</span>
        </div>
      </div>
      <div className="card-body">
        <p className="content-preview">{protocol.content ? protocol.content.replace(/<[^>]+>/g, '').substring(0, 120) : 'No content'}...</p>
      </div>
      <div className="card-actions">
        <Button size="sm" variant="primary" onClick={() => onEdit(protocol)}>
            <i className="fas fa-edit me-1"></i> Edit
        </Button>
        <Button size="sm" variant="outline-danger" onClick={() => onDelete(protocol.id)}>
            <i className="fas fa-trash me-1"></i> Delete
        </Button>
        <div className="drag-handle ms-auto" {...attributes} {...listeners}>
            <i className="fas fa-grip-vertical me-1"></i> Drag
        </div>
      </div>
    </div>
  );
};

const ProtocolCard = ({ protocol, category, onEdit, onDelete }) => (
    <div className="protocol-card">
      <div className="card-header">
        <div className="d-flex justify-content-between align-items-start">
            <h5 className="mb-0">{protocol.name}</h5>
            <span className="category-badge">{category}</span>
        </div>
      </div>
      <div className="card-body">
        <p className="content-preview">{protocol.content ? protocol.content.replace(/<[^>]+>/g, '').substring(0, 120) : 'No content'}...</p>
      </div>
      <div className="card-actions">
        <Button size="sm" variant="primary" onClick={() => onEdit(protocol)}>
            <i className="fas fa-edit me-1"></i> Edit
        </Button>
        <Button size="sm" variant="outline-danger" onClick={() => onDelete(protocol.id)}>
            <i className="fas fa-trash me-1"></i> Delete
        </Button>
      </div>
    </div>
);

const LsccManager = () => {
  const { user: gtawUser, username: gtawUsername } = useGtaWorldAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [keywords, setKeywords] = useState({});
  const [showKeywordManager, setShowKeywordManager] = useState(false);
  const [showKeywordEditModal, setShowKeywordEditModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [isReordering, setIsReordering] = useState(false);
  const [injuries, setInjuries] = useState({});
  const [showInjuryManager, setShowInjuryManager] = useState(false);
  const [showInjuryEditModal, setShowInjuryEditModal] = useState(false);
  const [editingInjury, setEditingInjury] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), 
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const bumpLsccVersion = useCallback(async () => {
    try {
      const metadataRef = ref(database, 'appMetadata/lsccDataVersion');
      await runTransaction(metadataRef, (v) => (v || 0) + 1);
      console.log('Bumped LSCC data version');
    } catch (err) {
      console.error('Failed to bump LSCC version:', err);
    }
  }, []);

  useEffect(() => {
    const injRef = ref(database, 'lscc/injuries');
    const unsubscribe = onValue(injRef, snap => setInjuries(snap.val() || {}));
    return () => unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await get(ref(database, 'lscc/protocols'));
      if (snap.exists()) {
        const rawData = snap.val() || [];
        const normalized = rawData.map(cat => ({
          category: cat.category || 'Uncategorized',
          protocols: (Array.isArray(cat.protocols) ? cat.protocols : []).map(p => ({
              ...p,
              id: p.id || `p_${Math.random().toString(36).substr(2, 9)}`
          }))
        })).filter(cat => cat.protocols.length > 0);
        setItems(normalized);
        setCategories(normalized.map(c => c.category));
      }
    } catch (err) { setError('Failed to load protocols'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const kwRef = ref(database, 'lscc/keywords');
    const unsubscribe = onValue(kwRef, snap => setKeywords(snap.val() || {}));
    return () => unsubscribe();
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEdit = (item) => { setEditingItem(item); setShowModal(true); };
  const handleAddNew = () => { setEditingItem({ name: '', content: '', category: '', images: [] }); setShowModal(true); };

  const handleDelete = async (id) => {
    const protocolToDelete = items.flatMap(cat => cat.protocols).find(p => p.id === id);
    if (!protocolToDelete || !window.confirm(`Delete protocol "${protocolToDelete.name}"?`)) return;
    
    const { userAgent, timeZone } = getUserContext();
    logAdminAction(gtawUsername, 'Deleted LSCC Protocol', `Protocol: ${protocolToDelete.name}`, 'LSCC Management', userAgent, timeZone, gtawUsername, gtawUser);
    
    const newData = items.map(cat => ({ 
        ...cat, 
        protocols: cat.protocols.filter(p => p.id !== id) 
    })).filter(cat => cat.protocols.length > 0);
    
    await set(ref(database, 'lscc/protocols'), newData);
    await bumpLsccVersion();
    fetchData();
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const newData = JSON.parse(JSON.stringify(items));
    let draggedItem = null;
    let sourceCatIdx = -1;
    let sourceProtoIdx = -1;

    // Find source
    for (let c = 0; c < newData.length; c++) {
      const idx = newData[c].protocols.findIndex(p => p.id === active.id);
      if (idx !== -1) {
          sourceCatIdx = c;
          sourceProtoIdx = idx;
          [draggedItem] = newData[c].protocols.splice(idx, 1); 
          break; 
      }
    }
    
    if (!draggedItem) return;

    // Find destination
    let destCatIdx = -1;
    let destProtoIdx = -1;
    for (let c = 0; c < newData.length; c++) {
      const idx = newData[c].protocols.findIndex(p => p.id === over.id);
      if (idx !== -1) {
          destCatIdx = c;
          destProtoIdx = idx;
          newData[c].protocols.splice(idx + 1, 0, draggedItem); 
          break; 
      }
    }

    if (destCatIdx === -1) {
        // Re-insert at source if failed
        newData[sourceCatIdx].protocols.splice(sourceProtoIdx, 0, draggedItem);
        return;
    }

    await set(ref(database, 'lscc/protocols'), newData.filter(c => c.protocols.length > 0));
    await bumpLsccVersion();
    setItems(newData);
  };

  const allProtocolsFlat = items.flatMap(cat => cat.protocols.map(p => ({ ...p, category: cat.category })));

  return (
    <div className="lscc-manager-container dark">
      <div className="lscc-header">
        <h2>LSCC Protocols Manager</h2>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant={isReordering ? "success" : "outline-primary"} onClick={() => setIsReordering(!isReordering)}>
            <i className={`fas ${isReordering ? 'fa-check' : 'fa-sort'} me-2`}></i>
            Reorder Mode {isReordering ? "ON" : "OFF"}
          </Button>
          <Button variant="primary" onClick={handleAddNew}>
            <i className="fas fa-plus me-2"></i>Add Protocol
          </Button>
          <Button variant="info" onClick={() => setShowKeywordManager(true)}>
            <i className="fas fa-key me-2"></i>Keywords ({Object.keys(keywords).length})
          </Button>
          <Button variant="warning" onClick={() => setShowInjuryManager(true)}>
            <i className="fas fa-user-injured me-2"></i>Injuries ({Object.keys(injuries).length})
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      
      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
      ) : isReordering ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={allProtocolsFlat.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="lscc-grid">
              {allProtocolsFlat.map(proto => (
                <SortableProtocolItem 
                  key={proto.id} 
                  protocol={proto} 
                  category={proto.category} 
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="lscc-categories-wrapper">
          {items.map(cat => (
            <div key={cat.category} className="category-section mb-5">
              <h3 className="category-title mb-4 border-bottom pb-2">
                <i className="fas fa-folder-open me-2 text-primary"></i>
                {cat.category}
              </h3>
              <div className="lscc-grid">
                {cat.protocols.map(proto => (
                  <ProtocolCard 
                    key={proto.id} 
                    protocol={proto} 
                    category={cat.category} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Protocol Edit Modal */}
      <LsccEditModal 
        show={showModal} 
        onHide={() => { setShowModal(false); setEditingItem(null); }} 
        item={editingItem} 
        onSave={fetchData} 
        categories={categories} 
        logAdminAction={logAdminAction} 
        gtawUser={gtawUser} 
        gtawUsername={gtawUsername} 
      />

      {/* Keyword Manager Modal */}
      <BaseModal isOpen={showKeywordManager} onClose={() => setShowKeywordManager(false)} title="Manage Keywords" modalSize="large" variant="info"
        footer={<Button variant="primary" onClick={() => { setEditingKeyword(null); setShowKeywordManager(false); setShowKeywordEditModal(true); }}>+ Add Keyword</Button>}
      >
        <div style={{ display: 'grid', gap: '15px' }}>
          {Object.entries(keywords).map(([id, kw]) => (
            <div key={id} style={{ backgroundColor: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h5 style={{ color: '#58a6ff' }}>{kw.keyword}</h5>
                  <p style={{ fontSize: '0.9rem', color: '#8b949e' }}>{kw.definition}</p>
                </div>
                <div>
                  <Button size="sm" variant="primary" onClick={() => { setEditingKeyword({ id, ...kw }); setShowKeywordManager(false); setShowKeywordEditModal(true); }} className="me-2">Edit</Button>
                  <Button size="sm" variant="danger" onClick={async () => {
                      if (window.confirm(`Delete ${kw.keyword}?`)) {
                          await set(ref(database, `lscc/keywords/${id}`), null);
                          await bumpLsccVersion();
                      }
                  }}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </BaseModal>

      {/* Injury Manager Modal */}
      <BaseModal isOpen={showInjuryManager} onClose={() => setShowInjuryManager(false)} title="Manage Injury Types" modalSize="large" variant="warning"
        footer={<Button variant="primary" onClick={() => { setEditingInjury(null); setShowInjuryManager(false); setShowInjuryEditModal(true); }}>+ Add Injury Type</Button>}
      >
        <div style={{ display: 'grid', gap: '15px' }}>
          {Object.entries(injuries).map(([id, injury]) => (
            <div key={id} style={{ backgroundColor: '#161b22', padding: '15px', borderRadius: '8px', border: '1px solid #30363d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h5 style={{ color: '#d29922' }}>{injury.name}</h5>
                  <p style={{ fontSize: '0.8rem', color: '#8b949e', fontFamily: 'monospace' }}>Triggers: {injury.words}</p>
                </div>
                <div>
                  <Button size="sm" variant="primary" onClick={() => { setEditingInjury({ id, ...injury }); setShowInjuryManager(false); setShowInjuryEditModal(true); }} className="me-2">Edit</Button>
                  <Button size="sm" variant="danger" onClick={async () => {
                      if (window.confirm(`Delete ${injury.name}?`)) {
                          await set(ref(database, `lscc/injuries/${id}`), null);
                          await bumpLsccVersion();
                      }
                  }}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </BaseModal>

      <KeywordEditModal show={showKeywordEditModal} onHide={() => { setShowKeywordEditModal(false); setEditingKeyword(null); setShowKeywordManager(true); }} keyword={editingKeyword} onSave={async (id, data) => {
          const refPath = id ? `lscc/keywords/${id}` : `lscc/keywords/${Date.now()}`;
          await set(ref(database, refPath), data);
          await bumpLsccVersion();
          setShowKeywordEditModal(false);
      }} />

      <KeywordEditModal show={showInjuryEditModal} onHide={() => { setShowInjuryEditModal(false); setEditingInjury(null); setShowInjuryManager(true); }} type="injury" keyword={{ id: editingInjury?.id, keyword: editingInjury?.name || '', definition: editingInjury?.words || '', tip: '' }} onSave={async (id, data) => {
          const injuryData = { name: data.keyword.trim(), words: data.definition.trim() };
          const path = id ? `lscc/injuries/${id}` : `lscc/injuries/${Date.now()}`;
          await set(ref(database, path), injuryData);
          await bumpLsccVersion();
          setShowInjuryEditModal(false);
      }} />
    </div>
  );
};

export default LsccManager;
