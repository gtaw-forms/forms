// EmsDashboard.jsx
import React, { useState, useEffect } from "react";
import styles from "./EmsDashboard.module.css";
import { database as db } from "../../firebase";
import { ref, onValue } from "firebase/database";
import { KeywordHighlighter } from "../KeywordHighlighter";
import PatientHelper from "../PatientHelper";
const EmsDashboard = () => {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [uniqueWordFilterTerm, setUniqueWordFilterTerm] = useState("");
  const [showUniqueWordFilter, setShowUniqueWordFilter] = useState(false);
const [keywords, setKeywords] = useState({});
const [showKeywordModal, setShowKeywordModal] = useState(false);
const [editingKeyword, setEditingKeyword] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

const normalizeProtocols = (data) => {
  if (!Array.isArray(data)) return [];
  return data.map(cat => ({
    ...cat,
    protocols: Array.isArray(cat.protocols) ? cat.protocols : []
  }));
};
useEffect(() => {
  const kwRef = ref(db, 'lscc/keywords');
  onValue(kwRef, (snap) => {
    setKeywords(snap.val() || {});
  });
}, []);
  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  useEffect(() => {
    const protocolsRef = ref(db, "lscc/protocols");
    const unsubscribe = onValue(protocolsRef, (snapshot) => {
const data = normalizeProtocols(snapshot.val() || []);
setProtocols(data);
      setProtocols(data || []);
      setLoading(false);
    });

    return unsubscribe;
  }, []);
  const filteredProtocols = protocols
    .map((cat) => ({
      ...cat,
      protocols: cat.protocols.filter((p) => {
        const matchesSearchTerm = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesUniqueWord = uniqueWordFilterTerm
          ? (p.uniqueWords || []).some(word =>
              word.toLowerCase().includes(uniqueWordFilterTerm.toLowerCase())
            )
          : true; // If no unique word filter term, it always matches

        return matchesSearchTerm && matchesUniqueWord;
      }),
    }))
    .filter((cat) => cat.protocols.length > 0);

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
            <button
              className={styles.filterButton} // You'll need to define this style
              onClick={() => setShowUniqueWordFilter(!showUniqueWordFilter)}
            >
              {showUniqueWordFilter ? "Hide Unique Word Filter" : "Filter by Unique Words"}
            </button>
            {showUniqueWordFilter && (
              <input
                type="text"
                placeholder="Filter by unique words..."
                className={styles.searchInput} // Reusing style for now
                value={uniqueWordFilterTerm}
                onChange={(e) => setUniqueWordFilterTerm(e.target.value)}
              />
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              Loading protocols...
            </div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredProtocols.map((category) => (
                <li key={category.category}>
                  <div
                    className={`${styles.categoryHeader} ${
                      collapsedCategories[category.category]
                        ? styles.collapsed
                        : ""
                    } ${
                      category.protocols.some(
                        (p) => p.id === selectedProtocol?.id
                      )
                        ? styles.hasSelectedItem
                        : ""
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
                            selectedProtocol?.id === protocol.id
                              ? styles.selected
                              : ""
                          }`}
                          onClick={() => setSelectedProtocol(protocol)}
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
              <h1 className={styles.protocolTitle}>
                {selectedProtocol.name}
              </h1>
              {renderProtocolContent(
                selectedProtocol.content,
                selectedProtocol.images
              )}
            </>
          ) : (
            <div
              style={{
                textAlign: "center",
                marginTop: "4rem",
                fontSize: "1.5rem",
                color: "#94a3b8",
              }}
            >
              Select a protocol to view details
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className={styles.rightPanel}>
          <h2>Patient Helper 1.0 (Alpha)</h2>
          <p style={{ color: "#94a3b8" }}>
            Coming soon: Quick vitals calculator, drug dosage helper, and
            scene timer.
            <PatientHelper />
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmsDashboard;