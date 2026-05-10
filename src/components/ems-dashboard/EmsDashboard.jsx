// EmsDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import styles from "./EmsDashboard.module.css";
import { KeywordHighlighter } from "../UI/KeywordHighlighter";
import PatientHelper from "../Modals/PatientHelper";
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { useImageUpload } from '../../hooks/useImageUpload';
import EmsAmaModal from '../Modals/EmsAmaModal';
import { useData } from '../../contexts/DataContext.jsx';
import { useModal } from '../../contexts/ModalProvider.jsx';
import { useUserMetrics } from '../../hooks/useUserMetrics';
import { Button, Spinner } from 'react-bootstrap';
import { useInactivityReload } from '../../hooks/useInactivityReload';
import BaseModal from '../Modals/BaseModal';
import SidebarNav from '../UI/SidebarNav';

const EmsDashboard = () => {
  useInactivityReload();
  const { trackMetric } = useUserMetrics();
  const { phmcListData, coronerListData: originalCoronerListData, lsccData, loading: dataContextLoading } = useData();
  const { showEmployeeModal, setShowEmployeeModal } = useModal();

  const [protocols, setProtocols] = useState([]);
  const [injuries, setInjuries] = useState({});
  const [selectedInjury, setSelectedInjury] = useState(null);
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [injurySearch, setInjurySearch] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [patientNotes, setPatientNotes] = useState("");

  const [showEmsAmaModal, setShowEmsAmaModal] = useState(false);

  const { showNotification } = useNotification();
  const { handleImageUpload } = useImageUpload(showNotification, () => {});

  useEffect(() => {
    trackMetric('ems_dashboard', 'main_page');
  }, [trackMetric]);

  useEffect(() => {
    if (lsccData) {
      const protocolOrder = ["Introduction", "Legalities", "Emergency Vehicle Protocols", "Radio Procedures + Encodes", "Miscellaneous Information + Tips"];
      const protocolOrderMap = new Map(protocolOrder.map((name, index) => [name, index]));

      const normalizedProtocols = Array.isArray(lsccData.protocols)
        ? lsccData.protocols.map((cat) => {
            const sorted = [...(cat.protocols || [])].sort((pA, pB) => {
              const idxA = protocolOrderMap.get(pA.name) ?? Infinity;
              const idxB = protocolOrderMap.get(pB.name) ?? Infinity;
              if (idxA !== idxB) return idxA - idxB;
              return pA.name.localeCompare(pB.name);
            });
            return { ...cat, protocols: sorted };
          })
        : [];

      normalizedProtocols.sort((a, b) => {
        const idA = parseInt(a.category.match(/^\[(\d+)\]/)?.[1] || Infinity);
        const idB = parseInt(b.category.match(/^\[(\d+)\]/)?.[1] || Infinity);
        if (idA !== idB) return idA - idB;
        return a.category.localeCompare(b.category);
      });

      setProtocols(normalizedProtocols);
      setInjuries(lsccData.injuries || {});
    }
  }, [lsccData]);

  const employeeOptions = useMemo(() => {
      const phmcOptions = phmcListData.filter(emp => emp?.name).map(emp => ({ label: emp.name, value: emp.name }));
      const coronerOptions = originalCoronerListData.filter(emp => emp?.name).map(emp => ({ label: emp.name, value: emp.name }));
      return [{ label: 'PHMC Staff', options: phmcOptions }, { label: 'Coroner Staff', options: coronerOptions }];
  }, [phmcListData, originalCoronerListData]);

  useEffect(() => {
    const saved = localStorage.getItem('patient notes free text');
    if (saved) {
      const { notes, timestamp } = JSON.parse(saved);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) setPatientNotes(notes);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('patient notes free text', JSON.stringify({ notes: patientNotes, timestamp: Date.now() }));
  }, [patientNotes]);

  const filteredProtocols = protocols.map(cat => ({
    ...cat,
    protocols: (cat.protocols || []).filter(p => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(search) || (p.uniqueWords || []).some(w => w.toLowerCase().includes(search));
      if (!matchesSearch) return false;
      if (!selectedInjury) return true;
      const content = p.content.toLowerCase();
      return selectedInjury.words.toLowerCase().split(",").some(w => content.includes(w.trim()));
    })
  })).filter(cat => cat.protocols.length > 0);

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

  return (
    <div className={styles.container}>
      <SidebarNav 
        showEmsAma={true} 
        onShowEmsAma={() => setShowEmsAmaModal(true)} 
      />

      <div className={styles.header}><h1>LS County EMS Protocols</h1></div>

      <div className={styles.mainLayout}>
        <div className={styles.leftPanel}>
          <div className={styles.controls}>
            <input type="text" placeholder="Search..." className={styles.searchInput} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Button onClick={() => setShowInjuryModal(true)} className={styles.filterButton}>Filter: {selectedInjury?.name || "All"}</Button>
            {selectedInjury && <div className={styles.activeFilterBadge}>{selectedInjury.name} <button onClick={() => setSelectedInjury(null)}>×</button></div>}
          </div>
          <div className={styles.protocolSidebar}>
            {dataContextLoading ? <Spinner animation="border" /> : (
              filteredProtocols.map(cat => (
                <div key={cat.category}>
                  <div className={styles.categoryHeader} onClick={() => setCollapsedCategories(prev => ({ ...prev, [cat.category]: !prev[cat.category] }))}>
                    {cat.category} ({cat.protocols.length})
                  </div>
                  {!collapsedCategories[cat.category] && (
                    <ul className={styles.protocolList}>
                      {cat.protocols.map(p => (
                        <li key={p.id} className={`${styles.protocolItem} ${selectedProtocol?.id === p.id ? styles.selected : ''}`} onClick={() => setSelectedProtocol(p)}>
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.mainContent}>
          {selectedProtocol ? (
            <>
              <h1 className={styles.protocolTitle}>{selectedProtocol.name}</h1>
              {renderProtocolContent(selectedProtocol.content, selectedProtocol.images)}
            </>
          ) : (
            <div className={styles.emptyState}>Select a protocol to begin.</div>
          )}
        </div>

        <div className={styles.rightPanel}>
          <h2>EMS Tools</h2>
          <textarea className={styles.notesTextarea} value={patientNotes} onChange={e => setPatientNotes(e.target.value)} placeholder="Patient notes..." />
          <PatientHelper />
        </div>
      </div>

      {/* MODALS */}
      <BaseModal isOpen={showInjuryModal} onClose={() => setShowInjuryModal(false)} title="Filter by Injury Type" variant="info"
        footer={<Button variant="secondary" onClick={() => { setSelectedInjury(null); setShowInjuryModal(false); }}>Clear Filter</Button>}
      >
        <input type="text" placeholder="Search injuries..." className="form-control mb-3" value={injurySearch} onChange={e => setInjurySearch(e.target.value)} autoFocus style={{ backgroundColor: '#161b22', color: '#e6edf3', borderColor: '#30363d' }} />
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {visibleInjuries.map(([id, injury]) => (
            <div key={id} onClick={() => { setSelectedInjury(injury); setShowInjuryModal(false); }} style={{ 
              padding: '10px', cursor: 'pointer', borderBottom: '1px solid #30363d',
              backgroundColor: selectedInjury?.name === injury.name ? 'rgba(0, 102, 204, 0.2)' : 'transparent'
            }}>
              <strong>{injury.name}</strong>
              <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>Triggers: {injury.words}</div>
            </div>
          ))}
        </div>
      </BaseModal>

      <EmsAmaModal show={showEmsAmaModal} onHide={() => setShowEmsAmaModal(false)} showNotification={showNotification} handleImageUpload={handleImageUpload} />
    </div>
  );
};

export default EmsDashboard;
