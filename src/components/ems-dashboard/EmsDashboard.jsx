// EmsDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import styles from "./EmsDashboard.module.css";

import { KeywordHighlighter } from "../UI/KeywordHighlighter";
import PatientHelper from "../Modals/PatientHelper";
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { useWebhooks } from '../../hooks/useWebhooks';
import { useImageUpload } from '../../hooks/useImageUpload';
import EmsAmaModal from '../Modals/EmsAmaModal';
import EmsBingoModal from '../Modals/EmsBingoModal'; // New import
import BusinessCardModal from '../Modals/BusinessCardModal'; // New import
import MapModal from '../Modals/MapModal'; // New import
import { useData } from '../../contexts/DataContext.jsx'; // New import
import { useModal } from '../../contexts/ModalProvider.jsx'; // New import

import { useUserMetrics } from '../../hooks/useUserMetrics'; // NEW IMPORT
import { sendBingoNotification, sendPhraseRequestNotification } from '../UI/notificationService'; // New import
import { Button } from 'react-bootstrap';
import { useInactivityReload } from '../../hooks/useInactivityReload'; // NEW IMPORT


import EmployeeNewDetails from '../Modals/EmployeeNewDetails';

const EmsDashboard = () => {
  useInactivityReload(); // NEW HOOK CALL
  const { trackMetric } = useUserMetrics(); // NEW METRICS HOOK

  const { phmcListData, coronerListData: originalCoronerListData, lsccData, loading: dataContextLoading } = useData();
  const { showEmployeeModal, setShowEmployeeModal } = useModal();

  const [protocols, setProtocols] = useState([]);
  const [injuries, setInjuries] = useState({}); // { id: { name, words } }
  const [selectedInjury, setSelectedInjury] = useState(null); // full injury object
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [injurySearch, setInjurySearch] = useState("");
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [keywords, setKeywords] = useState({});
  const [patientNotes, setPatientNotes] = useState("");
  const navigate = useNavigate();

  const [showEmsAmaModal, setShowEmsAmaModal] = useState(false);
  const [commitInfo, setCommitInfo] = useState({ sha: 'N/A', date: null, error: null }); // Default commitInfo

  const { showNotification } = useNotification();
  const { sendDataRequestLog } = useWebhooks({}); // Pass empty object if no formData/commitInfo needed specifically for this hook's context here
  const { isUploading, handleImageUpload } = useImageUpload(showNotification, () => {}); // Placeholder setFormData

  const [showEmsBingoModal, setShowEmsBingoModal] = useState(false); // New state for Bingo Modal
  const [showBusinessCardModal, setShowBusinessCardModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false); // New state for Map Modal

  const currentPhmcEmployee = '';
  const isAdmin = false;

  // NEW: Track dashboard visit
  useEffect(() => {
    trackMetric('ems_dashboard', 'main_page');
  }, [trackMetric]);

  useEffect(() => {
    if (lsccData) {
      // Define desired protocol order
      const protocolOrder = [
        "Introduction",
        "Legalities",
        "Emergency Vehicle Protocols",
        "Radio Procedures + Encodes",
        "Miscellaneous Information + Tips"
      ];
      const protocolOrderMap = new Map(protocolOrder.map((name, index) => [name, index]));

      const normalizedProtocols = Array.isArray(lsccData.protocols)
        ? lsccData.protocols.map((cat) => {
            const sortedProtocols = Array.isArray(cat.protocols)
              ? [...cat.protocols].sort((pA, pB) => {
                  const nameA = pA.name;
                  const nameB = pB.name;

                  const indexA = protocolOrderMap.has(nameA) ? protocolOrderMap.get(nameA) : Infinity;
                  const indexB = protocolOrderMap.has(nameB) ? protocolOrderMap.get(nameB) : Infinity;

                  // Prioritize custom ordered protocols
                  if (indexA !== Infinity || indexB !== Infinity) {
                    if (indexA !== indexB) return indexA - indexB;
                  }

                  // Fallback: alphabetical by name for protocols within same category
                  return nameA.localeCompare(nameB);
                })
              : [];
            return {
              ...cat,
              protocols: sortedProtocols,
            };
          })
        : [];

      // Helper to extract ID from category string
      const extractId = (categoryString) => {
        const match = categoryString.match(/^\[(\d+)\]/);
        return match ? parseInt(match[1], 10) : Infinity;
      };

      normalizedProtocols.sort((a, b) => {
        const idA = extractId(a.category);
        const idB = extractId(b.category);

        const cleanCategoryA = a.category.replace(/^\[\d+\]\s*/, '');
        const cleanCategoryB = b.category.replace(/^\[\d+\]\s*/, '');

        if (idA !== idB) {
          return idA - idB;
        }
        return cleanCategoryA.localeCompare(cleanCategoryB);
      });

      setProtocols(normalizedProtocols);
      setKeywords(lsccData.keywords || {});
      setInjuries(lsccData.injuries || {});
    }
  }, [lsccData]);

  const employeeOptions = useMemo(() => {
      const validPhmcData = phmcListData.filter(emp => emp && emp.name && typeof emp.name === 'string');
      const validCoronerData = originalCoronerListData.filter(emp => emp && emp.name && typeof emp.name === 'string');

      const phmcOptions = validPhmcData.map(emp => ({
          label: emp.name,
          value: emp.name,
      }));
      const coronerOptions = validCoronerData.map(emp => ({
          label: emp.name,
          value: emp.name,
      }));
      
      return [
          { label: 'PHMC Staff', options: phmcOptions },
          { label: 'Coroner Staff', options: coronerOptions }
      ];
  }, [phmcListData, originalCoronerListData]);

  useEffect(() => {
    const savedNotesData = localStorage.getItem('patient notes free text');
    if (savedNotesData) {
      const { notes, timestamp } = JSON.parse(savedNotesData);
      const isExpired = (Date.now() - timestamp) > 24 * 60 * 60 * 1000;
      if (!isExpired) {
        setPatientNotes(notes);
      } else {
        localStorage.removeItem('patient notes free text');
      }
    }
  }, []);

  useEffect(() => {
    const dataToSave = {
      notes: patientNotes,
      timestamp: Date.now()
    };
    localStorage.setItem('patient notes free text', JSON.stringify(dataToSave));
  }, [patientNotes]);

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };



  // Filter protocols
  const filteredProtocols = protocols
    .map((cat) => {
      let filtered = cat.protocols.filter((p) => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(lowerCaseSearchTerm);
        const matchesUniqueWords = (p.uniqueWords || []).some(word =>
          word.toLowerCase().includes(lowerCaseSearchTerm)
        );
        if (!matchesName && !matchesUniqueWords) return false;
        if (!selectedInjury) return true;

        const content = (p.content || "").toLowerCase();
        const words = selectedInjury.words.toLowerCase().split(",").map(w => w.trim());
        return words.some(word => content.includes(word));
      });

      return { ...cat, protocols: filtered };
    })
    .filter((cat) => cat.protocols.length > 0);

  // Filter injuries for modal search
  const visibleInjuries = Object.entries(injuries)
    .filter(([_, injury]) =>
      injury.name.toLowerCase().includes(injurySearch.toLowerCase())
    )
    .sort((a, b) => a[1].name.localeCompare(b[1].name));

const renderProtocolContent = (content = "", images = []) => {
  // First, let's replace the simple markdown BEFORE splitting by images
  const processMarkdown = (text) => {
    if (!text) return text;

    // First, apply inline formatting (bold, underline)
    let formattedText = text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')   // *bold*
      .replace(/_([^_]+)_/g, '<u>$1</u>');               // _underline_

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
  // Split by image placeholders while preserving them
  const parts = content.split(/(\{image\d+\})/g);
  return parts.map((part, i) => {
    if (part.match(/\{image(\d+)\}/)) {
      const idx = parseInt(part.match(/\{image(\d+)\}/)[1]) - 1;
      const url = images[idx];
      return url ? (
        <div key={i} className={styles.imageWrapper}>
          <img src={url} alt={`Image ${idx + 1}`} className={styles.protocolImage} />
        </div>
      ) : null;
    }
    return <KeywordHighlighter key={i}>{processMarkdown(part)}</KeywordHighlighter>;
  });
};
return (
    <div className={`${styles.container}`}>
      <div className={styles.header}>
        <h1>LS County EMS Protocols</h1>
      </div>
                <div className="floating-admin-button-container">
              <Button type="button" variant="primary" className="changelog-button" onClick={() => navigate('/')} title="Go to Home" > <i className="fas fa-home"></i>Home</Button>
              <Button type="button" variant="primary" className="changelog-button" onClick={() => { setShowEmsAmaModal(true); trackMetric('ems_dashboard', 'open_ama_modal'); }} title="Open EMS AMA Form" > <i className="fa-solid fa-truck-medical"></i> EMS AMA</Button>
              <Button type="button" variant="warning" className="changelog-button" onClick={() => { setShowEmsBingoModal(true); trackMetric('ems_dashboard', 'open_bingo_modal'); }} title="Open Bingo Night!" > <i className="fas fa-trophy"></i> Bingo Night!</Button>
              <Button type="button" variant="info" className="changelog-button" onClick={() => { setShowBusinessCardModal(true); trackMetric('ems_dashboard', 'open_business_card_modal'); }} title="Open Business Card Generator"> <i className="fas fa-id-card"></i> Business Card</Button>
              <Button type="button" variant="secondary" className="changelog-button" onClick={() => { setShowMapModal(true); trackMetric('ems_dashboard', 'open_map_modal'); }} title="Open PHMC Map"> <i className="fas fa-map-marked-alt"></i> PHMC Map</Button>
            </div>
      <div className={styles.mainLayout}>
        {/* Left Panel */}
        <div className={styles.leftPanel}>
          <div className={styles.controls}>
            <input
              type="text"
              placeholder="Search protocols..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* NEW: Filter by Injuries Button */}
            <button
              className={`${styles.filterButton} ${selectedInjury ? styles.activeFilter : ""}`}
              onClick={() => { setShowInjuryModal(true); trackMetric('ems_dashboard', 'open_injury_filter'); }}
            >
              Filter by Injuries {selectedInjury && " (" + selectedInjury.name + ")"}
            </button>

            {/* Active Filter Badge */}
            {selectedInjury && (
              <div className={styles.activeFilterBadge}>
                <span>{selectedInjury.name}</span>
                <button
                  onClick={() => setSelectedInjury(null)}
                  style={{ marginLeft: 8, fontSize: "1.2em" }}
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {dataContextLoading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>Spinning up the hamsters...</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredProtocols.map((category) => (
                <li key={category.category}>
                  <div
                    className={`${styles.categoryHeader} ${
                      collapsedCategories[category.category] ? styles.collapsed : ""
                    }`}
                    onClick={() => toggleCategory(category.category)}
                  >
                    {category.category} ({category.protocols.length})
                  </div>
                  {!collapsedCategories[category.category] && (
                    <ul className={styles.protocolList}>
                      {category.protocols.map((protocol) => (
                        <li
                          key={protocol.id}
                          className={`${styles.protocolItem} ${
                            selectedProtocol?.id === protocol.id ? styles.selected : ""
                          }`}
                          onClick={() => {
                            setSelectedProtocol(protocol);
                            trackMetric('ems_dashboard', `protocol_view_${protocol.name}`);
                          }}
                        >
                          {protocol.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Main Content */}
        <div className={styles.mainContent}>
          {selectedProtocol ? (
            <>
              <h1 className={styles.protocolTitle}>{selectedProtocol.name}</h1>
              {renderProtocolContent(selectedProtocol.content, selectedProtocol.images)}
            </>
          ) : (
            <div style={{ textAlign: "center", marginTop: "4rem", fontSize: "1.5rem", color: "#94a3b8" }}>
              
              Welcome to the PHMC EMS Dashboard.<br/> You can select a protocol from the left panel to view its details here. <br/><br/> Use the search bar or injury filter to quickly find relevant protocols. <br/><br/> You can also use the right panel for EMS tools and patient notes. <br/><br/> If you have any suggestions, please reach out to the Ellie Ohara on Discord!
            </div>
          )}
        </div>

        <div className={styles.rightPanel}>
          <h2>EMS Tools</h2>
          <textarea
            className={styles.notesTextarea}
            value={patientNotes}
            onChange={(e) => setPatientNotes(e.target.value)}
            placeholder="Enter patient notes here... (Saved for 24 hours)"
          />
          <PatientHelper />
        </div>
      </div>

      {/* INJURY FILTER MODAL */}
{showInjuryModal && (
  <div className="modal-overlay" onClick={() => setShowInjuryModal(false)}>
    <div
      className="cctv-modal-dialog"
      style={{ maxWidth: 620, borderRadius: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cctv-modal-header" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, background: "#1e293b", borderBottom: "1px solid #334155" }}>
        <h4 style={{ margin: 0, color: "#e2e8f0", fontWeight: 600 }}>
          Filter by Injury Type
        </h4>
        <button 
          className="modal-close-btn" 
          onClick={() => setShowInjuryModal(false)}
          style={{ color: "#94a3b8" }}
        >
          ×
        </button>
      </div>

      <div className="p-5" style={{ background: "#0f172a" }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search injuries..."
          className={styles.searchInput}
          style={{ 
            width: "100%", 
            marginBottom: 20,
            background: "#1e293b",
            border: "1px solid #334155",
            color: "#e2e8f0",
            padding: "12px 16px",
            borderRadius: 12,
            fontSize: "1rem"
          }}
          value={injurySearch}
          onChange={(e) => setInjurySearch(e.target.value)}
          autoFocus
        />

        {/* Injury List */}
        <div style={{ maxHeight: "58vh", overflowY: "auto", borderRadius: 12, background: "#1e293b" }}>
          {visibleInjuries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No injuries found</p>
            </div>
          ) : (
            visibleInjuries.map(([id, injury]) => {
              const isSelected = selectedInjury?.name === injury.name;
              return (
                <div
                  key={id}
                  className={`${styles.injuryOptionNew} ${isSelected ? styles.injurySelectedNew : ""}`}
                  onClick={() => {
                    setSelectedInjury(injury);
                    setShowInjuryModal(false);
                    setInjurySearch(""); // clear search
                    trackMetric('ems_dashboard', `select_injury_${injury.name}`);
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="font-semibold text-lg" style={{ color: isSelected ? "#60a5fa" : "#e2e8f0" }}>
                        {injury.name}
                      </div>
                      <div className="text-sm opacity-80 mt-1" style={{ color: isSelected ? "#93c5fd" : "#94a3b8" }}>
                        Triggers: {injury.words}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-2xl ml-4" style={{ color: "#60a5fa" }}>✓</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition font-medium"
            onClick={() => {
              setSelectedInjury(null);
              setShowInjuryModal(false);
              setInjurySearch("");
            }}
          >
            Clear Filter
          </button>
        </div>
      </div>
    </div>
  </div>
)}
<EmsBingoModal
  show={showEmsBingoModal}
  onHide={() => setShowEmsBingoModal(false)}
  allEmployeeGroupedOptions={employeeOptions} // Pass the entire grouped options array
  currentPhmcEmployee={currentPhmcEmployee}
  showNotification={showNotification}
  setShowEmployeeModal={setShowEmployeeModal}
  isAdmin={isAdmin}
  sendBingoWebhook={({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci }) => 
    sendBingoNotification({ scorer, bingoType, phrase, lineName, marked, commitInfo: ci || commitInfo })
  }
  sendPhraseRequestWebhook={({ requester, phrase, bingoType }) => 
    sendPhraseRequestNotification({ requester, phrase, bingoType, commitInfo })
  }
/>
<EmployeeNewDetails
  show={showEmployeeModal}
  onHide={() => setShowEmployeeModal(false)}
  showNotification={showNotification}
/>
<EmsAmaModal
  show={showEmsAmaModal}
  onHide={() => setShowEmsAmaModal(false)}
  showNotification={showNotification}
  commitInfo={commitInfo}
  handleImageUpload={handleImageUpload}
/>
<BusinessCardModal
  show={showBusinessCardModal}
  onHide={() => setShowBusinessCardModal(false)}
  showNotification={showNotification}
  commitInfo={commitInfo}
  handleImageUpload={handleImageUpload}
/>
<MapModal
  show={showMapModal}
  onHide={() => setShowMapModal(false)}
/>
    </div>
  );
};

export default EmsDashboard;