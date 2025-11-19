// LsccManager.jsx — FINAL FIXED & CLEAN VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { database } from '../../firebase';
import { ref, get, set, onValue } from 'firebase/database';
import { Button, Spinner, Alert } from 'react-bootstrap';
import KeywordEditModal from './KeywordEditModal';
import LsccEditModal from './LsccEditModal';
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

import './LsccManager.css';

const SortableProtocolItem = ({ protocol, category, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: protocol.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="protocol-card sortable">
      <div className="card-header">
        <h5>{protocol.name}</h5>
        <span className="category-badge">{category}</span>
      </div>
      <div className="card-body">
        <p className="content-preview">
          {protocol.content?.substring(0, 120) || 'No content'}...
        </p>
      </div>
      <div className="card-actions">
        <Button size="sm" onClick={() => onEdit(protocol)}>Edit</Button>
        <Button size="sm" variant="outline-danger" onClick={() => onDelete(protocol.id)}>Delete</Button>
        <div className="drag-handle" {...attributes} {...listeners}>Drag</div>
      </div>
    </div>
  );
};

const LsccManager = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Protocol modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Keyword system
  const [keywords, setKeywords] = useState({});
  const [showKeywordManager, setShowKeywordManager] = useState(false);
  const [showKeywordEditModal, setShowKeywordEditModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState(null);
  const [isReordering, setIsReordering] = useState(false);

  // injury types
  const [injuries, setInjuries] = useState({});
const [showInjuryManager, setShowInjuryManager] = useState(false);
const [showInjuryEditModal, setShowInjuryEditModal] = useState(false);
const [editingInjury, setEditingInjury] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
useEffect(() => {
  const injRef = ref(database, 'lscc/injuries');
  const unsubscribe = onValue(injRef, (snap) => {
    setInjuries(snap.val() || {});
  });
  return () => unsubscribe();
}, []);
  // Fetch protocols
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await get(ref(database, 'lscc/protocols'));
      if (snap.exists()) {
        const rawData = snap.val();
        const normalized = !rawData ? [] : rawData.map(cat => ({
          category: cat.category || 'Uncategorized',
          protocols: Array.isArray(cat.protocols) ? cat.protocols : []
        })).filter(cat => cat.protocols.length > 0);
        setItems(normalized);
        setCategories(normalized.map(c => c.category));
      } else {
        setItems([]);
        setCategories([]);
      }
    } catch (err) {
      setError('Failed to load protocols');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch keywords
  useEffect(() => {
    const kwRef = ref(database, 'lscc/keywords');
    const unsubscribe = onValue(kwRef, (snap) => {
      setKeywords(snap.val() || {});
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingItem({ name: '', content: '', category: '', images: [] });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const protocolToDelete = items.flatMap(cat => cat.protocols).find(p => p.id === id);
    if (!protocolToDelete) {
      console.warn(`Protocol with ID ${id} not found for deletion.`);
      return;
    }

    if (!window.confirm(`Delete protocol "${protocolToDelete.name}"?`)) return;

    // Send webhook notification BEFORE deletion
    await sendDiscordWebhook(
      'Protocol Deletion Initiated',
      `**${protocolToDelete.name}** is about to be deleted.`,
      16711680, // Red color for deletion
      [
        { name: 'Protocol ID', value: protocolToDelete.id, inline: true },
        { name: 'Category', value: protocolToDelete.category || 'N/A', inline: true },
        { name: 'Content Preview', value: protocolToDelete.content?.substring(0, 100) || 'N/A', inline: false },
        { name: 'Full Data (for recovery)', value: '```json\n' + JSON.stringify(protocolToDelete, null, 2).substring(0, 1000) + '\n```', inline: false },
      ]
    );

    const newData = items
      .map(cat => ({ ...cat, protocols: cat.protocols.filter(p => p.id !== id) }))
      .filter(cat => cat.protocols.length > 0);
    await set(ref(database, 'lscc/protocols'), newData);
    fetchData();
  };

  const handleSaveComplete = () => {
    fetchData();
    setShowModal(false);
    setEditingItem(null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const newData = JSON.parse(JSON.stringify(items));
    let draggedItem = null;

    // Remove from source
    for (let c = 0; c < newData.length; c++) {
      const idx = newData[c].protocols.findIndex(p => p.id === active.id);
      if (idx !== -1) {
        [draggedItem] = newData[c].protocols.splice(idx, 1);
        break;
      }
    }
    if (!draggedItem) return;

    // Insert into target
    let inserted = false;
    for (let c = 0; c < newData.length; c++) {
      const idx = newData[c].protocols.findIndex(p => p.id === over.id);
      if (idx !== -1) {
        newData[c].protocols.splice(idx + 1, 0, draggedItem);
        inserted = true;
        break;
      }
    }

    if (!inserted && over.id.startsWith('category-')) {
      const catName = over.id.replace('category-', '');
      let cat = newData.find(c => c.category === catName);
      if (!cat) {
        cat = { category: catName, protocols: [] };
        newData.push(cat);
      }
      cat.protocols.push(draggedItem);
    }

    const cleaned = newData.filter(c => c.protocols.length > 0);
    await set(ref(database, 'lscc/protocols'), cleaned);
    fetchData();
  };

  const flatItems = items.flatMap(cat => cat.protocols.map(p => ({ ...p, category: cat.category })));

  return (
    <div className="lscc-manager-container">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>LSCC Protocols Manager</h2>
        <div>
          <Button
            variant={isReordering ? "success" : "outline-primary"}
            onClick={() => setIsReordering(!isReordering)}
            className="me-2"
          >
            Reorder Mode {isReordering ? "ON" : "OFF"}
          </Button>
          <Button variant="primary" onClick={handleAddNew} className="me-2">
            + Add Protocol
          </Button>
          <Button
            variant="info"
            onClick={() => setShowKeywordManager(true)}
          >
            Keywords ({Object.keys(keywords).length})
          </Button>
          <Button
          variant="warning"
          onClick={() => setShowInjuryManager(true)}
          className="me-2"
        >
          Injury Types ({Object.keys(injuries).length})
        </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : isReordering ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={flatItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="lscc-grid">
              {flatItems.map(item => (
                <SortableProtocolItem
                  key={item.id}
                  protocol={item}
                  category={item.category}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        items.map(cat => (
          <div key={cat.category} className="mb-5">
            <h3 className="mb-4">{cat.category}</h3>
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
              {cat.protocols.map(proto => (
                <div key={proto.id} className="col">
                  <div className="protocol-card">
                    <div className="card-header">
                      <h5>{proto.name}</h5>
                      <span className="category-badge">{cat.category}</span>
                    </div>
                    <div className="card-body">
                      <p className="content-preview">{proto.content || 'No content'}</p>
                      {proto.images?.length > 0 && (
                        <div className="image-thumbnails">
                          {proto.images.slice(0, 3).map((url, i) => (
                            <img key={i} src={url} alt="" />
                          ))}
                          {proto.images.length > 3 && <span>+{proto.images.length - 3}</span>}
                        </div>
                      )}
                    </div>
                    <div className="card-actions">
                      <Button size="sm" onClick={() => handleEdit(proto)} className="me-2">Edit</Button>
                      <Button size="sm" variant="outline-danger" onClick={() => handleDelete(proto.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Protocol Edit Modal */}
      <LsccEditModal
        show={showModal}
        onHide={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSaveComplete}
        categories={categories}
      />

      {/* Keyword Manager Modal */}
{showKeywordManager && (
  <div className="modal-overlay" onClick={() => setShowKeywordManager(false)}>
    <div 
      className="cctv-modal-dialog" 
      style={{ maxWidth: 820, borderRadius: 16 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ 
        background: "#1e293b", 
        padding: "1.5rem 2rem", 
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottom: "1px solid #334155",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h4 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.5rem", fontWeight: 700 }}>
          Manage Keywords
        </h4>
        <button 
          className="modal-close-btn" 
          onClick={() => setShowKeywordManager(false)}
          style={{ fontSize: "1.8rem", color: "#94a3b8" }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ background: "#0f172a", padding: "2rem", maxHeight: "80vh", overflowY: "auto" }}>
        {/* Add Button */}
        <button
          className="mb-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg"
          onClick={() => {
            setEditingKeyword(null);
            setShowKeywordManager(false);
            setShowKeywordEditModal(true);
          }}
        >
          + Add New Keyword
        </button>

        {/* List */}
        <div style={{ display: "grid", gap: "1rem" }}>
          {Object.keys(keywords).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No keywords defined yet.</p>
              <p className="text-gray-500 text-sm mt-2">Click "Add New Keyword" to start teaching the app.</p>
            </div>
          ) : (
            Object.entries(keywords).map(([id, kw]) => (
              <div
                key={id}
                className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition shadow-sm"
                style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
              >
                <div className="flex justify-between items-start gap-5">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-2xl font-bold text-cyan-400 mb-3">
                      {kw.keyword || "Unnamed"}
                    </h5>

                    {kw.definition && (
                      <div className="mb-4">
                        <span className="text-gray-300 font-medium">Definition:</span>
                        <p className="mt-2 text-gray-200 leading-relaxed">
                          {kw.definition}
                        </p>
                      </div>
                    )}

                    {kw.tip && (
                      <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg px-4 py-3">
                        <span className="text-emerald-400 font-medium">Quick Tip:</span>
                        <p className="mt-1 text-emerald-200">
                          {kw.tip}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 ml-4 flex-shrink-0">
                    <button
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition shadow"
                      onClick={() => {
                        setEditingKeyword({ id, ...kw });
                        setShowKeywordManager(false);
                        setShowKeywordEditModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition shadow"
                      onClick={() => {
                        if (window.confirm(`Delete keyword "${kw.keyword}" permanently?`)) {
                          set(ref(database, `lscc/keywords/${id}`), null);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
)}{showInjuryManager && (
  <div className="modal-overlay" onClick={() => setShowInjuryManager(false)}>
    <div 
      className="cctv-modal-dialog" 
      style={{ maxWidth: 780, borderRadius: 16 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ 
        background: "#1e293b", 
        padding: "1.5rem 2rem", 
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottom: "1px solid #334155",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h4 style={{ margin: 0, color: "#e2e8f0", fontSize: "1.5rem", fontWeight: 700 }}>
          Manage Injury Types
        </h4>
        <button 
          className="modal-close-btn" 
          onClick={() => setShowInjuryManager(false)}
          style={{ fontSize: "1.8rem", color: "#94a3b8" }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ background: "#0f172a", padding: "2rem", maxHeight: "80vh", overflowY: "auto" }}>
        {/* Add Button */}
        <button
          className="mb-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg"
          onClick={() => {
            setEditingInjury(null);
            setShowInjuryManager(false);
            setShowInjuryEditModal(true);
          }}
        >
          + Add New Injury Type
        </button>

        {/* List */}
        <div style={{ display: "grid", gap: "1rem" }}>
          {Object.keys(injuries).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No injury types defined yet.</p>
              <p className="text-gray-600 text-sm mt-2">Click "Add New Injury Type" to get started.</p>
            </div>
          ) : (
            Object.entries(injuries).map(([id, injury]) => (
              <div
                key={id}
                className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition"
                style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xl font-bold text-indigo-400 mb-2">
                      {injury.name || "Unnamed Injury"}
                    </h5>
                    <div className="bg-slate-900 rounded-lg px-4 py-3 text-sm">
                      <span className="text-gray-400 font-medium">Trigger words:</span>
                      <div className="mt-2 text-cyan-300 font-mono break-all">
                        {injury.words || "(none)"}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 ml-4">
                    <button
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition shadow"
                      onClick={() => {
                        setEditingInjury({ id, ...injury });
                        setShowInjuryManager(false);
                        setShowInjuryEditModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition shadow"
                      onClick={() => {
                        if (window.confirm(`Delete "${injury.name}" permanently?`)) {
                          set(ref(database, `lscc/injuries/${id}`), null);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
)}
{/* Injury Edit Modal - Reuses KeywordEditModal with custom fields */}
{showInjuryEditModal && (
  <KeywordEditModal
    show={showInjuryEditModal}
    onHide={() => {
      setShowInjuryEditModal(false);
      setEditingInjury(null);
      setShowInjuryManager(true);
    }}
    type="injury"
    keyword={{
      id: editingInjury?.id,
      keyword: editingInjury?.name || '',
      definition: editingInjury?.words || '',
      tip: ''
    }}
    onSave={async (id, data) => {
      const injuryData = {
        name: data.keyword.trim(),
        words: data.definition.trim(),
      };
      const path = id ? `lscc/injuries/${id}` : `lscc/injuries/${Date.now()}`;
      await set(ref(database, path), injuryData);
      setShowInjuryEditModal(false);
      setEditingInjury(null);
    }}
  />
)}      {/* Actual Keyword Edit Modal */}
      <KeywordEditModal
        show={showKeywordEditModal}
        onHide={() => {
          setShowKeywordEditModal(false);
          setEditingKeyword(null);
          setShowKeywordManager(true); // go back to list
        }}
        keyword={editingKeyword}
        onSave={async (id, data) => {
          const refPath = id ? `lscc/keywords/${id}` : `lscc/keywords/${Date.now()}`;
          await set(ref(database, refPath), data);
          setShowKeywordEditModal(false);
          setEditingKeyword(null);
        }}
      />

    </div>
  );
};

export default LsccManager;