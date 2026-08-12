// EmsPanel.jsx — LS County EMS Protocols viewer embedded in the prototype.
// The protocol tree + search live in the prototype sidebar; this renders the
// selected protocol (keyword highlighting + embedded images) and the injury
// filter. Reuses the legacy EmsDashboard CSS module for rendering.
import React, { useState } from 'react';
import styles from '../ems-dashboard/EmsDashboard.module.css';
import { KeywordHighlighter } from '../UI/KeywordHighlighter';
import { Button } from 'react-bootstrap';
import BaseModal from '../Modals/BaseModal';

const EmsPanel = ({ protocol, injuries = {}, selectedInjury, onSelectInjury, onClearInjury }) => {
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [injurySearch, setInjurySearch] = useState('');

  const visibleInjuries = Object.entries(injuries)
    .filter(([_, injury]) => injury.name.toLowerCase().includes(injurySearch.toLowerCase()))
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

  const renderProtocolContent = (content = "", images = []) => {
    return content.split(/(\{image\d+\})/g).map((part, i) => {
      const imgMatch = part.match(/\{image(\d+)\}/);
      if (imgMatch) {
        const url = images[parseInt(imgMatch[1]) - 1];
        return url ? <div key={i} className={styles.imageWrapper}><img src={url} alt="Protocol" className={styles.protocolImage} /></div> : null;
      }
      return <KeywordHighlighter key={i}>{part}</KeywordHighlighter>;
    });
  };

  if (!protocol) {
    return (
      <div className={styles.container} style={{ minHeight: 0, background: 'transparent', padding: '0.5rem', flex: 1, overflowY: 'auto' }}>
        <div className={styles.emptyState} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          Select an EMS protocol from the sidebar to begin.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} style={{ minHeight: 0, background: 'transparent', padding: '0.5rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h1 className={styles.protocolTitle} style={{ marginBottom: 0 }}>{protocol.name}</h1>
        <Button onClick={() => setShowInjuryModal(true)} className={styles.filterButton} style={{ width: 'auto', margin: 0 }}>
          Filter: {selectedInjury?.name || "All"}
        </Button>
      </div>
      {selectedInjury && (
        <div className={styles.activeFilterBadge} style={{ marginBottom: 10 }}>
          {selectedInjury.name} <button onClick={onClearInjury}>×</button>
        </div>
      )}
      {renderProtocolContent(protocol.content, protocol.images)}

      <BaseModal isOpen={showInjuryModal} onClose={() => setShowInjuryModal(false)} title="Filter by Injury Type" variant="info"
        footer={<Button variant="secondary" onClick={() => { onClearInjury(); setShowInjuryModal(false); }}>Clear Filter</Button>}
      >
        <input type="text" placeholder="Search injuries..." className="form-control mb-3" value={injurySearch} onChange={e => setInjurySearch(e.target.value)} autoFocus style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {visibleInjuries.map(([id, injury]) => (
            <div key={id} onClick={() => { onSelectInjury(injury); setShowInjuryModal(false); }} style={{
              padding: '10px', cursor: 'pointer', borderBottom: '1px solid #30363d',
              backgroundColor: selectedInjury?.name === injury.name ? 'rgba(0, 102, 204, 0.2)' : 'transparent'
            }}>
              <strong>{injury.name}</strong>
              <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>Triggers: {injury.words}</div>
            </div>
          ))}
        </div>
      </BaseModal>
    </div>
  );
};

export default EmsPanel;
