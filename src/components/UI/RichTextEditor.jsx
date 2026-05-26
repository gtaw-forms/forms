import React, { useState, useRef, useEffect, useCallback } from 'react';
import { renderMarkdown } from '../../utils/textUtils';

const isHTML = (str) => /<[a-z][\s\S]*>/i.test(str || '');

function getTableCtx(node) {
  const td = node.closest('td, th');
  if (!td) return null;
  const tr = td.closest('tr');
  const table = td.closest('table');
  const tbody = table?.tBodies[0] || table;
  const rowIndex = tr ? Array.from(tbody.rows).indexOf(tr) : -1;
  const colIndex = tr ? Array.from(tr.cells).indexOf(td) : -1;
  return { td, tr, table, tbody, rowIndex, colIndex };
}

const RichTextEditor = ({ value, onChange, minHeight = 200 }) => {
  const editorRef = useRef(null);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableBg, setTableBg] = useState('#0d1117');
  const [contentLoaded, setContentLoaded] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [fmtState, setFmtState] = useState({ bold: false, italic: false, underline: false, bullet: false, numbered: false });

  useEffect(() => {
    if (editorRef.current && !contentLoaded && value) {
      editorRef.current.innerHTML = isHTML(value) ? value : renderMarkdown(value);
      setContentLoaded(true);
    }
  }, [value, contentLoaded]);

  const syncContent = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const exec = useCallback((command, val = null) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    syncContent();
  }, [syncContent]);

  /* ── table insertion ── */
  const handleInsertTable = useCallback(() => {
    const cells = [];
    for (let r = 0; r < tableRows; r++) {
      cells.push('<tr>' + Array.from({ length: tableCols }, (_, c) =>
        `<td style="border:1px solid #30363d;padding:8px;background:${tableBg};color:#e6edf3;text-align:left;vertical-align:top">Cell ${r + 1}-${c + 1}</td>`
      ).join('') + '</tr>');
    }
    const table = `<table style="width:100%;border-collapse:collapse;margin:8px 0;">${cells.join('')}</table><br>`;
    document.execCommand('insertHTML', false, table);
    setShowTableDialog(false);
    syncContent();
  }, [tableRows, tableCols, tableBg, syncContent]);

  /* ── table context menu actions ── */
  const tableAction = useCallback((fn) => {
    if (!ctxMenu) return;
    const ctx = getTableCtx(ctxMenu.target);
    if (!ctx) { setCtxMenu(null); return; }
    fn(ctx);
    syncContent();
    setCtxMenu(null);
    editorRef.current?.focus();
  }, [ctxMenu, syncContent]);

  const insertRow = useCallback((position) => tableAction((ctx) => {
    const newRow = document.createElement('tr');
    Array.from(ctx.tr.cells).forEach(() => {
      const td = document.createElement('td');
      td.style.cssText = ctx.tr.cells[0].style.cssText;
      td.innerHTML = '&nbsp;';
      newRow.appendChild(td);
    });
    if (position === 'above') ctx.tbody.insertBefore(newRow, ctx.tr);
    else ctx.tbody.insertBefore(newRow, ctx.tr.nextSibling);
  }), [tableAction]);

  const insertColumn = useCallback((position) => tableAction((ctx) => {
    const colIdx = position === 'left' ? ctx.colIndex : ctx.colIndex + 1;
    Array.from(ctx.tbody.rows).forEach((row) => {
      const refCell = position === 'left' ? row.cells[ctx.colIndex] : row.cells[ctx.colIndex]?.nextSibling || null;
      const td = document.createElement('td');
      td.style.cssText = row.cells[0]?.style.cssText || 'border:1px solid #30363d;padding:8px;';
      td.innerHTML = '&nbsp;';
      row.insertBefore(td, refCell);
    });
  }), [tableAction]);

  const deleteRow = useCallback(() => tableAction((ctx) => {
    if (ctx.tbody.rows.length <= 1) { ctx.table.remove(); return; }
    ctx.tr.remove();
  }), [tableAction]);

  const deleteColumn = useCallback(() => tableAction((ctx) => {
    ctx.td.remove();
  }), [tableAction]);

  const setCellBg = useCallback((color) => tableAction((ctx) => {
    ctx.td.style.background = color;
  }), [tableAction]);

  const deleteTable = useCallback(() => tableAction((ctx) => {
    ctx.table.remove();
  }), [tableAction]);

  /* ── clear / reset ── */
  const handleClear = useCallback(() => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    syncContent();
  }, [syncContent]);

  const handleResetContent = useCallback(() => {
    if (editorRef.current && value) {
      editorRef.current.innerHTML = isHTML(value) ? value : renderMarkdown(value);
    }
    syncContent();
  }, [value, syncContent]);

  /* ── track active formatting state ── */
  const updateFmtState = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current?.contains(sel.anchorNode)) return;
    setFmtState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      bullet: document.queryCommandState('insertUnorderedList'),
      numbered: document.queryCommandState('insertOrderedList'),
    });
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.addEventListener('mouseup', updateFmtState);
    el.addEventListener('keyup', updateFmtState);
    document.addEventListener('selectionchange', updateFmtState);
    return () => {
      el.removeEventListener('mouseup', updateFmtState);
      el.removeEventListener('keyup', updateFmtState);
      document.removeEventListener('selectionchange', updateFmtState);
    };
  }, [updateFmtState]);

  /* ── close context menu on click outside ── */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  return (
    <div style={{ border: '1px solid #30363d', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
      <style>{`
        .rte-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:28px; border:1px solid transparent; border-radius:4px; background:transparent; color:#8b949e; cursor:pointer; font-size:13px; transition:all .15s }
        .rte-btn:hover { background:#21262d; color:#e6edf3; border-color:#30363d }
        .rte-btn-active { background:#1f6feb33; color:#58a6ff; border-color:#1f6feb66 }
        .rte-btn-primary { width:auto; padding:0 12px; background:#238636; color:#fff; border-color:#238636 }
        .rte-btn-primary:hover { background:#2ea043; color:#fff }
        .rte-btn-danger:hover { color:#f85149; border-color:#f85149 }
        .rte-editor table td { min-width:40px }
        .rte-editor ul, .rte-editor ol { margin:4px 0; padding-left:24px }
        .rte-editor p { margin:4px 0 }
        .rte-ctx { position:fixed; z-index:9999; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:4px; min-width:180px; box-shadow:0 8px 24px rgba(0,0,0,.4) }
        .rte-ctx-item { display:flex; align-items:center; gap:8px; width:100%; padding:6px 10px; border:none; border-radius:4px; background:transparent; color:#c9d1d9; font-size:13px; cursor:pointer; text-align:left }
        .rte-ctx-item:hover { background:#21262d; color:#e6edf3 }
        .rte-ctx-divider { height:1px; background:#30363d; margin:4px 0 }
        .rte-ctx-danger:hover { color:#f85149 }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', background: '#0d1117', borderBottom: '1px solid #30363d', flexWrap: 'wrap' }}>
        <button type="button" className={`rte-btn${fmtState.bold ? ' rte-btn-active' : ''}`} onClick={() => exec('bold')} title="Bold"><i className="fas fa-bold"></i></button>
        <button type="button" className={`rte-btn${fmtState.italic ? ' rte-btn-active' : ''}`} onClick={() => exec('italic')} title="Italic"><i className="fas fa-italic"></i></button>
        <button type="button" className={`rte-btn${fmtState.underline ? ' rte-btn-active' : ''}`} onClick={() => exec('underline')} title="Underline"><i className="fas fa-underline"></i></button>
        <span style={{ width: 1, height: 22, background: '#30363d', margin: '0 4px' }} />
        <button type="button" className={`rte-btn${fmtState.bullet ? ' rte-btn-active' : ''}`} onClick={() => exec('insertUnorderedList')} title="Bullet List"><i className="fas fa-list-ul"></i></button>
        <button type="button" className={`rte-btn${fmtState.numbered ? ' rte-btn-active' : ''}`} onClick={() => exec('insertOrderedList')} title="Numbered List"><i className="fas fa-list-ol"></i></button>
        <span style={{ width: 1, height: 22, background: '#30363d', margin: '0 4px' }} />
        <button type="button" className="rte-btn" onClick={() => setShowTableDialog(!showTableDialog)} title="Insert Table">
          <i className="fas fa-table"></i>
        </button>
        {ctxMenu?.target?.closest('td, th') && (
          <button type="button" className="rte-btn" onClick={() => { setCtxMenu(null); editorRef.current?.focus(); }}
            title="Right-click tables for more options">
            <i className="fas fa-mouse-pointer"></i>
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="rte-btn rte-btn-danger" onClick={handleClear} title="Clear content">
          <i className="fas fa-trash-alt"></i>
        </button>
        <button type="button" className="rte-btn" onClick={handleResetContent} title="Revert to saved">
          <i className="fas fa-undo-alt"></i>
        </button>
      </div>

      {showTableDialog && (
        <div style={{ padding: '10px', background: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#8b949e', fontSize: 12 }}>Rows</label>
            <input type="number" min={1} max={20} value={tableRows} onChange={e => setTableRows(Number(e.target.value))}
              style={{ width: 50, padding: '4px 6px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e6edf3', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#8b949e', fontSize: 12 }}>Cols</label>
            <input type="number" min={1} max={20} value={tableCols} onChange={e => setTableCols(Number(e.target.value))}
              style={{ width: 50, padding: '4px 6px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4, color: '#e6edf3', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ color: '#8b949e', fontSize: 12 }}>BG Color</label>
            <input type="color" value={tableBg} onChange={e => setTableBg(e.target.value)}
              style={{ width: 32, height: 28, padding: 1, border: '1px solid #30363d', borderRadius: 4, background: '#0d1117', cursor: 'pointer' }} />
          </div>
          <button type="button" className="rte-btn rte-btn-primary" onClick={handleInsertTable}>Insert Table</button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncContent}
        onContextMenu={e => {
          const td = e.target.closest('td, th');
          if (td) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, target: td }); }
        }}
        style={{
          minHeight,
          padding: 12,
          background: '#161b22',
          color: '#e6edf3',
          outline: 'none',
          fontSize: '0.9em',
          lineHeight: 1.6,
          overflowY: 'auto',
        }}
      />

      {/* ── Context Menu ── */}
      {ctxMenu && (
        <div className="rte-ctx" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button className="rte-ctx-item" onClick={() => insertRow('above')}><i className="fas fa-arrow-up" style={{ width: 16 }} /> Insert Row Above</button>
          <button className="rte-ctx-item" onClick={() => insertRow('below')}><i className="fas fa-arrow-down" style={{ width: 16 }} /> Insert Row Below</button>
          <button className="rte-ctx-item" onClick={() => insertColumn('left')}><i className="fas fa-arrow-left" style={{ width: 16 }} /> Insert Column Left</button>
          <button className="rte-ctx-item" onClick={() => insertColumn('right')}><i className="fas fa-arrow-right" style={{ width: 16 }} /> Insert Column Right</button>
          <div className="rte-ctx-divider" />
          <button className="rte-ctx-item" onClick={deleteRow}><i className="fas fa-trash-alt" style={{ width: 16 }} /> Delete Row</button>
          <button className="rte-ctx-item" onClick={deleteColumn}><i className="fas fa-trash-alt" style={{ width: 16 }} /> Delete Cell</button>
          <div className="rte-ctx-divider" />
          <div className="rte-ctx-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default', padding: '8px 10px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <i className="fas fa-palette" style={{ width: 16 }} /> Cell BG
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
              {['#0d1117','#161b22','#21262d','#30363d','#484f58','#6e7681',
                '#8b949e','#c9d1d9','#e6edf3','#ffffff',
                '#ff7b72','#ffa657','#d29922','#3fb950','#58a6ff','#bc8cff',
                '#da3633','#f85149','#e3b341','#238636','#1f6feb','#6c63ff',
                '#ff80bf','#db6d28','#7ee787','#79c0ff','#a371f7','#f778ba'
              ].map(c => (
                <button key={c} type="button" onClick={() => setCellBg(c)}
                  style={{ width: 24, height: 24, background: c, border: c === '#ffffff' ? '1px solid #30363d' : 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
              ))}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#8b949e' }}>Custom:</span>
              <input type="color" defaultValue={ctxMenu.target.style.background || '#0d1117'}
                onChange={e => { e.stopPropagation(); setCellBg(e.target.value); }}
                style={{ width: 28, height: 22, padding: 1, border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer' }} />
            </div>
          </div>
          <div className="rte-ctx-divider" />
          <button className="rte-ctx-item rte-ctx-danger" onClick={deleteTable}><i className="fas fa-table" style={{ width: 16 }} /> Delete Table</button>
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
