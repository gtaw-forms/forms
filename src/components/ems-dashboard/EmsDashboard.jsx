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
  const filteredProtocols = protocols    .map((cat) => ({
      ...cat,
      protocols: cat.protocols.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
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

    // Then, handle bullet points
    const lines = formattedText.split('\n');
    let inList = false;
    let resultHtml = [];

    lines.forEach(line => {
      if (line.trim().startsWith('- ')) {
        if (!inList) {
          resultHtml.push('<ul>');
          inList = true;
        }
        // Remove the bullet point marker and wrap in <li>
        resultHtml.push(`<li>${line.trim().substring(2)}</li>`);
      } else {
        if (inList) {
          resultHtml.push('</ul>');
          inList = false;
        }
        // Add non-list items as paragraphs or just text
        resultHtml.push(`<p>${line}</p>`);
      }
    });

    if (inList) {
      resultHtml.push('</ul>');
    }

    return resultHtml.join('');
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