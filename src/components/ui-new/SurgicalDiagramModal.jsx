import React, { useState, useEffect, useRef } from 'react';

import maleSilhouette from '../../assets/male-body-silhouette.jpg';
import femaleSilhouette from '../../assets/female-body-silhouette.png';

const MIN_FONT = 12;
const MAX_FONT = 72;
const DEFAULT_FONT = 18;
const STROKE_COLORS = ['#ff4d4d', '#ffd166', '#4dd2ff', '#ffffff'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clamp = (v) => Math.max(0, Math.min(100, v));

const arrowHead = (points, size = 4) => {
    const a = points[0];
    const b = points[points.length - 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const p1 = { x: b.x - size * Math.cos(ang - 0.45), y: b.y - size * Math.sin(ang - 0.45) };
    const p2 = { x: b.x - size * Math.cos(ang + 0.45), y: b.y - size * Math.sin(ang + 0.45) };
    return `M ${p1.x} ${p1.y} L ${b.x} ${b.y} L ${p2.x} ${p2.y} Z`;
};

const freehandPath = (points) => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');

const SurgicalDiagramModal = ({ show, onClose, data, onChange }) => {
    const [imageType, setImageType] = useState(data?.imageType || 'male');
    const [texts, setTexts] = useState(data?.texts || []);
    const [shapes, setShapes] = useState(data?.shapes || []);
    const [selectedId, setSelectedId] = useState(null);
    const [selectedShapeId, setSelectedShapeId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [tool, setTool] = useState(null);
    const [strokeColor, setStrokeColor] = useState(STROKE_COLORS[0]);
    const [strokeWidth, setStrokeWidth] = useState(2.5);
    const [drawing, setDrawing] = useState(null);
    const [showAnnotations, setShowAnnotations] = useState(false);

    const wrapRef = useRef(null);
    const dragRef = useRef(null);
    const editRef = useRef(null);
    const drawingRef = useRef(null);
    const historyRef = useRef([]);

    useEffect(() => {
        if (show) {
            setImageType(data?.imageType || 'male');
            setTexts(data?.texts || []);
            setShapes(data?.shapes || []);
            setSelectedId(null);
            setSelectedShapeId(null);
            setEditingId(null);
            setTool(null);
            setDrawing(null);
            drawingRef.current = null;
            historyRef.current = [];
            setShowAnnotations(false);
        }
    }, [show]);

    useEffect(() => {
        if (editingId && editRef.current) {
            editRef.current.focus();
            const range = document.createRange();
            range.selectNodeContents(editRef.current);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, [editingId]);

    useEffect(() => {
        if (!show) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
            if ((e.key === 'Delete' || e.key === 'Backspace') && !editingId && (selectedId || selectedShapeId)) {
                e.preventDefault();
                deleteSelected();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoLast();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [show, selectedId, selectedShapeId, editingId, texts, shapes]);

    const commit = (nextImageType, nextTexts, nextShapes) => {
        setImageType(nextImageType);
        setTexts(nextTexts);
        setShapes(nextShapes);
        if (onChange) onChange({ imageType: nextImageType, texts: nextTexts, shapes: nextShapes });
    };

    const updateText = (id, patch) => commit(imageType, texts.map(t => (t.id === id ? { ...t, ...patch } : t)), shapes);
    const updateShape = (id, patch) => commit(imageType, texts, shapes.map(s => (s.id === id ? { ...s, ...patch } : s)));

    const removeText = (id) => {
        setSelectedId(null);
        setEditingId(null);
        commit(imageType, texts.filter(t => t.id !== id), shapes);
    };

    const removeShape = (id) => {
        setSelectedShapeId(null);
        commit(imageType, texts, shapes.filter(s => s.id !== id));
    };

    const selectAnnotation = (kind, id) => {
        if (kind === 'text') { setSelectedId(id); setSelectedShapeId(null); setEditingId(null); }
        else { setSelectedShapeId(id); setSelectedId(null); setEditingId(null); }
        requestAnimationFrame(() => {
            const el = document.querySelector(`[data-aid="${id}"]`);
            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        });
    };

    const deleteSelected = () => {
        if (selectedShapeId) {
            setSelectedShapeId(null);
            commit(imageType, texts, shapes.filter(s => s.id !== selectedShapeId));
        } else if (selectedId) {
            setSelectedId(null);
            setEditingId(null);
            commit(imageType, texts.filter(t => t.id !== selectedId), shapes);
        }
    };

    const undoLast = () => {
        const entry = historyRef.current.pop();
        if (!entry) return;
        if (entry.kind === 'text') {
            setSelectedId(null);
            setEditingId(null);
            commit(imageType, texts.filter(t => t.id !== entry.id), shapes);
        } else {
            setSelectedShapeId(null);
            commit(imageType, texts, shapes.filter(s => s.id !== entry.id));
        }
    };

    const clearAll = () => {
        setSelectedId(null);
        setSelectedShapeId(null);
        setEditingId(null);
        historyRef.current = [];
        commit(imageType, [], []);
    };

    const toPct = (e) => {
        const rect = wrapRef.current.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        };
    };

    // ── Text placement ──
    const placeText = (e) => {
        if (tool !== 'text' || !wrapRef.current) return;
        const p = toPct(e);
        const id = uid();
        const next = [...texts, { id, x: clamp(p.x), y: clamp(p.y), text: 'Text', fontSize: DEFAULT_FONT }];
        commit(imageType, next, shapes);
        historyRef.current.push({ kind: 'text', id });
        setSelectedId(id);
        setEditingId(id);
    };

    // ── Drag (text) ──
    const startDrag = (e, id) => {
        if (editingId === id) return;
        e.stopPropagation();
        setSelectedId(id);
        setSelectedShapeId(null);
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        dragRef.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            dx: e.clientX - (r.left + r.width / 2),
            dy: e.clientY - (r.top + r.height / 2),
            active: false,
        };
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    const moveDrag = (e, id) => {
        const d = dragRef.current;
        if (!d || d.id !== id || !wrapRef.current) return;
        if (!d.active) {
            if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
            d.active = true;
        }
        const rect = wrapRef.current.getBoundingClientRect();
        const nx = ((e.clientX - d.dx - rect.left) / rect.width) * 100;
        const ny = ((e.clientY - d.dy - rect.top) / rect.height) * 100;
        updateText(id, { x: clamp(nx), y: clamp(ny) });
    };

    // ── Shape drawing ──
    const startDraw = (e) => {
        if (!tool || tool === 'text') return;
        e.preventDefault();
        e.stopPropagation();
        const p = toPct(e);
        const shape = { id: uid(), type: tool, points: [p], color: strokeColor, width: strokeWidth };
        drawingRef.current = shape;
        setDrawing(shape);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    const moveDraw = (e) => {
        const cur = drawingRef.current;
        if (!cur) return;
        const p = toPct(e);
        const next = cur.type === 'freehand'
            ? { ...cur, points: [...cur.points, p] }
            : { ...cur, points: [cur.points[0], p] };
        drawingRef.current = next;
        setDrawing(next);
    };

    const endDraw = () => {
        const cur = drawingRef.current;
        if (!cur) return;
        drawingRef.current = null;
        setDrawing(null);
        if (cur.type === 'freehand') {
            if (cur.points.length < 2) return;
        } else {
            const a = cur.points[0];
            const b = cur.points[cur.points.length - 1];
            if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 0.5) return;
            cur.points = [a, b];
        }
        const shape = { id: cur.id, type: cur.type, points: cur.points, color: cur.color, width: cur.width };
        commit(imageType, texts, [...shapes, shape]);
        historyRef.current.push({ kind: 'shape', id: shape.id });
        setSelectedShapeId(shape.id);
        setSelectedId(null);
    };

    const toggleTool = (t) => setTool(prev => (prev === t ? null : t));

    const handleImageClick = (e) => {
        if (tool === 'text') { placeText(e); return; }
        setSelectedId(null);
        setSelectedShapeId(null);
    };

    const resizeFont = (dir) => {
        if (!selectedId) return;
        const cur = texts.find(t => t.id === selectedId)?.fontSize || DEFAULT_FONT;
        updateText(selectedId, { fontSize: Math.min(MAX_FONT, Math.max(MIN_FONT, cur + dir)) });
    };

    const pickColor = (c) => {
        setStrokeColor(c);
        if (selectedShapeId) updateShape(selectedShapeId, { color: c });
    };

    const selectedFont = texts.find(t => t.id === selectedId)?.fontSize || DEFAULT_FONT;
    const drawActive = !!tool && tool !== 'text';

    if (!show) return null;

    const renderShape = (s) => {
        const sel = selectedShapeId === s.id;
        const geo = s.type === 'freehand'
            ? { path: freehandPath(s.points) }
            : { line: { x1: s.points[0].x, y1: s.points[0].y, x2: s.points[1].x, y2: s.points[1].y } };
        const base = {
            stroke: s.color, strokeWidth: s.width, fill: 'none',
            strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke',
        };
        const interactive = {
            pointerEvents: drawActive ? 'none' : 'stroke',
            onClick: (e) => { e.stopPropagation(); setSelectedShapeId(s.id); setSelectedId(null); },
        };
        const halo = sel ? {
            stroke: '#ffffff', strokeWidth: s.width + 4, fill: 'none',
            strokeDasharray: '5 4', opacity: 0.6, vectorEffect: 'non-scaling-stroke', pointerEvents: 'none',
        } : null;
        return (
            <g key={s.id} data-aid={s.id}>
                {halo && (s.type === 'freehand' ? <path d={geo.path} {...halo} /> : <line {...geo.line} {...halo} />)}
                {s.type === 'freehand'
                    ? <path d={geo.path} {...base} {...interactive} />
                    : <line {...geo.line} {...base} {...interactive} />}
                {s.type === 'arrow' && (
                    <path d={arrowHead(s.points)} fill={s.color} stroke={s.color} strokeWidth={1} pointerEvents="none" />
                )}
            </g>
        );
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(6,10,18,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onClick={onClose}>
            <div style={{ maxWidth: '98vw', width: '100%', height: '96vh', background: 'var(--bg-elevated)', border: '1px solid var(--border-accent)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <i className="fas fa-syringe" style={{ color: 'var(--teal)' }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                        Surgical Diagram <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)', fontFamily: 'var(--mono)', marginLeft: 6 }}>DEV</span>
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => commit('male', texts, shapes)} style={{ ...btnStyle, background: imageType === 'male' ? 'var(--teal-dim)' : 'var(--bg-surface)', color: imageType === 'male' ? 'var(--teal)' : 'var(--text)' }}>Male</button>
                        <button onClick={() => commit('female', texts, shapes)} style={{ ...btnStyle, background: imageType === 'female' ? 'var(--teal-dim)' : 'var(--bg-surface)', color: imageType === 'female' ? 'var(--teal)' : 'var(--text)' }}>Female</button>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">&times;</button>
                    </div>
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0 }}>
                    <button onClick={() => toggleTool('text')} style={{ ...btnStyle, background: tool === 'text' ? 'var(--amber-dim)' : 'var(--bg-surface)', color: tool === 'text' ? 'var(--amber)' : 'var(--text)' }}>
                        <i className="fas fa-font" style={{ marginRight: 6 }} />Text
                    </button>
                    <button onClick={() => toggleTool('line')} style={{ ...btnStyle, background: tool === 'line' ? 'var(--amber-dim)' : 'var(--bg-surface)', color: tool === 'line' ? 'var(--amber)' : 'var(--text)' }}>
                        <i className="fas fa-slash" style={{ marginRight: 6 }} />Line
                    </button>
                    <button onClick={() => toggleTool('arrow')} style={{ ...btnStyle, background: tool === 'arrow' ? 'var(--amber-dim)' : 'var(--bg-surface)', color: tool === 'arrow' ? 'var(--amber)' : 'var(--text)' }}>
                        <i className="fas fa-long-arrow-alt-right" style={{ marginRight: 6 }} />Arrow
                    </button>
                    <button onClick={() => toggleTool('freehand')} style={{ ...btnStyle, background: tool === 'freehand' ? 'var(--amber-dim)' : 'var(--bg-surface)', color: tool === 'freehand' ? 'var(--amber)' : 'var(--text)' }}>
                        <i className="fas fa-pen" style={{ marginRight: 6 }} />Draw
                    </button>

                    <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />

                    {STROKE_COLORS.map(c => (
                        <button key={c} onClick={() => pickColor(c)} title={`Stroke color ${c}`}
                            style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: strokeColor === c ? '2px solid var(--amber)' : '2px solid var(--border)', cursor: 'pointer', flexShrink: 0 }} />
                    ))}
                    <button onClick={() => setStrokeWidth(w => (w === 1.5 ? 3.5 : 1.5))} style={{ ...btnStyle, fontSize: 11, fontFamily: 'var(--mono)' }} title="Toggle stroke thickness">
                        {strokeWidth === 1.5 ? 'Thin' : 'Thick'}
                    </button>

                    <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />

                    <button onClick={() => resizeFont(-2)} disabled={!selectedId} style={{ ...btnStyle, opacity: selectedId ? 1 : 0.4 }}>
                        <i className="fas fa-minus" /> <span style={{ marginLeft: 5 }}>Size -</span>
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--mono)', minWidth: 28, textAlign: 'center' }}>{selectedFont}px</span>
                    <button onClick={() => resizeFont(2)} disabled={!selectedId} style={{ ...btnStyle, opacity: selectedId ? 1 : 0.4 }}>
                        <i className="fas fa-plus" /> <span style={{ marginLeft: 5 }}>Size +</span>
                    </button>

                    <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />

                    <button onClick={undoLast} disabled={historyRef.current.length === 0} style={{ ...btnStyle, opacity: historyRef.current.length ? 1 : 0.4 }}>
                        <i className="fas fa-undo" style={{ marginRight: 6 }} />Undo
                    </button>
                    <button onClick={deleteSelected} disabled={!selectedId && !selectedShapeId} style={{ ...btnStyle, opacity: selectedId || selectedShapeId ? 1 : 0.4, color: 'var(--danger)' }}>
                        <i className="fas fa-trash-alt" style={{ marginRight: 6 }} />Delete
                    </button>
                    <button onClick={clearAll} disabled={texts.length === 0 && shapes.length === 0} style={{ ...btnStyle, opacity: texts.length || shapes.length ? 1 : 0.4, color: 'var(--danger)' }}>
                        <i className="fas fa-eraser" style={{ marginRight: 6 }} />Clear all
                    </button>

                    <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 4px' }} />

                    <button onClick={() => setShowAnnotations(a => !a)} style={{ ...btnStyle, background: showAnnotations ? 'var(--teal-dim)' : 'var(--bg-surface)', color: showAnnotations ? 'var(--teal)' : 'var(--text)' }}>
                        <i className="fas fa-list-ul" style={{ marginRight: 6 }} />Annotations
                        <span style={{ marginLeft: 6, background: 'var(--bg-elevated)', borderRadius: 10, padding: '0 7px', fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--teal)' }}>{texts.length + shapes.length}</span>
                        <i className={`fas fa-chevron-${showAnnotations ? 'up' : 'down'}`} style={{ marginLeft: 6, fontSize: 9 }} />
                    </button>
                </div>

                {/* Annotations panel */}
                {showAnnotations && (
                    <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', maxHeight: 190, overflowY: 'auto', flexShrink: 0 }}>
                        {texts.length + shapes.length === 0 ? (
                            <div style={{ padding: '12px 16px', fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center' }}>No annotations yet — add text, lines, arrows or freehand.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 8px', gap: 4 }}>
                                {texts.map(t => (
                                    <div key={'t' + t.id} onClick={() => selectAnnotation('text', t.id)} style={{ ...annotRowStyle, borderLeft: selectedId === t.id ? '3px solid var(--amber)' : '3px solid transparent', background: selectedId === t.id ? 'var(--amber-dim)' : 'transparent' }}>
                                        <i className="fas fa-font" style={{ width: 18, textAlign: 'center', color: 'var(--teal)', fontSize: 12 }} />
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text)' }}>{t.text || '(empty)'}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{t.fontSize}px</span>
                                        <button onClick={(e) => { e.stopPropagation(); removeText(t.id); }} style={annotDeleteStyle}><i className="fas fa-times" /></button>
                                    </div>
                                ))}
                                {shapes.map(s => (
                                    <div key={'s' + s.id} onClick={() => selectAnnotation(s.type, s.id)} style={{ ...annotRowStyle, borderLeft: selectedShapeId === s.id ? '3px solid var(--amber)' : '3px solid transparent', background: selectedShapeId === s.id ? 'var(--amber-dim)' : 'transparent' }}>
                                        <span style={{ width: 18, textAlign: 'center', color: s.color, fontSize: 12 }}>
                                            <i className={s.type === 'line' ? 'fas fa-slash' : s.type === 'arrow' ? 'fas fa-long-arrow-alt-right' : 'fas fa-pen'} />
                                        </span>
                                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{s.type === 'line' ? 'Line' : s.type === 'arrow' ? 'Arrow' : 'Freehand'}</span>
                                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: 44, height: 16, marginRight: 8, flexShrink: 0 }}>
                                            {s.type === 'freehand'
                                                ? <path d={freehandPath(s.points)} stroke={s.color} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />
                                                : (
                                                    <>
                                                        <line x1={s.points[0].x} y1={s.points[0].y} x2={s.points[1].x} y2={s.points[1].y} stroke={s.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                                                        {s.type === 'arrow' && <path d={arrowHead(s.points, 5)} fill={s.color} stroke={s.color} strokeWidth={1} />}
                                                    </>
                                                )}
                                        </svg>
                                        <button onClick={(e) => { e.stopPropagation(); removeShape(s.id); }} style={annotDeleteStyle}><i className="fas fa-times" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Canvas */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', background: '#0b0f14', padding: 16 }}>
                    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#0d1117', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', cursor: drawActive ? 'crosshair' : 'default' }}>
                        <img
                            src={imageType === 'male' ? maleSilhouette : femaleSilhouette}
                            alt="body silhouette"
                            draggable={false}
                            onDragStart={e => e.preventDefault()}
                            onClick={handleImageClick}
                            style={{ display: 'block', maxWidth: '94vw', maxHeight: '70vh', userSelect: 'none' }}
                        />
                        <svg
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: drawActive ? 'all' : 'none', touchAction: 'none' }}
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            onPointerDown={startDraw}
                            onPointerMove={moveDraw}
                            onPointerUp={endDraw}
                        >
                            {shapes.map(renderShape)}
                            {drawing && drawing.type === 'freehand' && (
                                <path d={freehandPath(drawing.points)} stroke={drawing.color} strokeWidth={drawing.width} fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
                            )}
                            {drawing && drawing.type !== 'freehand' && drawing.points.length >= 2 && (() => {
                                const [a, b] = drawing.points;
                                return (
                                    <g pointerEvents="none">
                                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={drawing.color} strokeWidth={drawing.width} vectorEffect="non-scaling-stroke" />
                                        {drawing.type === 'arrow' && <path d={arrowHead([a, b])} fill={drawing.color} stroke={drawing.color} strokeWidth={1} />}
                                    </g>
                                );
                            })()}
                        </svg>
                        {texts.map(t => (
                            <div
                                key={t.id}
                                data-aid={t.id}
                                ref={editingId === t.id ? editRef : null}
                                contentEditable={editingId === t.id}
                                suppressContentEditableWarning
                                onClick={e => { e.stopPropagation(); setSelectedId(t.id); setSelectedShapeId(null); }}
                                onDoubleClick={e => { e.stopPropagation(); setSelectedId(t.id); setEditingId(t.id); }}
                                onPointerDown={e => startDrag(e, t.id)}
                                onPointerMove={e => moveDrag(e, t.id)}
                                onPointerUp={() => { dragRef.current = null; }}
                                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                                onBlur={e => { const txt = e.currentTarget.textContent || ''; updateText(t.id, { text: txt }); setEditingId(null); }}
                                style={{
                                    position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%,-50%)',
                                    fontSize: t.fontSize, lineHeight: 1, whiteSpace: 'nowrap',
                                    cursor: editingId === t.id ? 'text' : 'move',
                                    userSelect: editingId === t.id ? 'text' : 'none',
                                    pointerEvents: drawActive ? 'none' : 'auto',
                                    color: '#fff', textShadow: '0 0 3px #000, 0 0 3px #000',
                                    padding: '2px 4px', borderRadius: 4,
                                    outline: selectedId === t.id && editingId !== t.id ? '1px dashed var(--amber)' : 'none',
                                    background: selectedId === t.id && editingId !== t.id ? 'rgba(0,0,0,0.35)' : 'transparent',
                                }}
                            >{t.text}</div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                        <i className="fas fa-info-circle" style={{ marginRight: 6, color: 'var(--teal)' }} />
                        {tool === 'text' ? 'Click the image to drop text · drag to move · double-click to edit' :
                            drawActive ? `Drag on the image to draw a ${tool}` :
                            'Pick a tool: text, line, arrow or freehand. Click a shape to select, Del to remove, Ctrl+Z to undo.'}
                    </span>
                    <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
};

const btnStyle = {
    display: 'inline-flex', alignItems: 'center', background: 'var(--bg-surface)',
    border: '1px solid var(--border-accent)', color: 'var(--text)', borderRadius: 6,
    padding: '6px 12px', fontSize: 12, cursor: 'pointer',
};

const annotRowStyle = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
    cursor: 'pointer', minHeight: 28,
};

const annotDeleteStyle = {
    background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer',
    fontSize: 11, padding: '2px 4px', borderRadius: 4,
};

export default SurgicalDiagramModal;