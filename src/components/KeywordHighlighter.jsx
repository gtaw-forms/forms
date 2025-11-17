// components/KeywordHighlighter.jsx — FINAL + AAAAA-PROOF
import React, { useState, useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../firebase';
import ReactDOM from 'react-dom';

export const KeywordHighlighter = ({ children }) => {
  const [keywords, setKeywords] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [activeKeyword, setActiveKeyword] = useState(null);

  useEffect(() => {
    const kwRef = ref(database, 'lscc/keywords');
    const unsubscribe = onValue(kwRef, (snap) => {
      setKeywords(snap.val() || {});
    });
    return () => unsubscribe();
  }, []);

  if (!children || typeof children !== 'string') return <>{children}</>;

  const keywordList = Object.values(keywords)
    .filter(kw => kw && kw.keyword && typeof kw.keyword === 'string')
    .sort((a, b) => b.keyword.length - a.keyword.length);

  if (keywordList.length === 0) {
    return <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{children}</div>;
  }

  let content = children;
  keywordList.forEach(kw => {
    try {
      const escaped = kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
      content = content.replace(regex, match =>
        `<span class="smart-keyword" data-kw="${kw.keyword.toLowerCase()}">${match}</span>`
      );
    } catch (e) {}
  });

  const handleClick = (e) => {
    const target = e.target;
    if (target.classList.contains('smart-keyword')) {
      const kwKey = target.getAttribute('data-kw');
      const kw = keywordList.find(k => k.keyword.toLowerCase() === kwKey);
      if (kw) {
        setActiveKeyword(kw);
        setShowModal(true);
      }
    }
  };

  return (
    <>
      {/* MAIN CONTENT — NOW WITH WORD WRAP */}
      <div
        dangerouslySetInnerHTML={{ __html: content }}
        onClick={handleClick}
        style={{
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          lineHeight: '1.6'
        }}
      />

      {/* MODAL — NOW WITH MAX WIDTH + WORD WRAP */}
      {showModal && activeKeyword && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div 
                        className="keyword-modal-dialog"           >
            <div className="keyword-modal-header">
                                          <h4
                                            className="keyword-modal-title" 
              >
                {activeKeyword.keyword}
              </h4>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="keyword-modal-body">
              <div style={{ marginBottom: 16 }}>
                <strong>CONSIDER</strong>
                <p>          
                {activeKeyword.definition || 'No definition provided.'}
                </p>
              </div>

              {activeKeyword.tip && (
                <div style={{ marginBottom: 16 }}>
                  <strong>TIP</strong>
                  <p>
                    {activeKeyword.tip}
                  </p>
                </div>
              )}
            </div>

            <div className="keyword-modal-footer">
              <button className="keyword-modal-btn keyword-modal-btn-primary" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-root')
      )}

      <style jsx>{`
        .smart-keyword {
          color: #0066cc;
          text-decoration: underline dotted 2px #2b435cff;
          text-underline-offset: 3px;
          cursor: help;
          font-weight: 600;
          padding: 0 3px;
          border-radius: 3px;
          transition: all 0.2s ease;
          display: inline-block;
          max-width: 100%;
          overflow-wrap: break-word;
        }
        .smart-keyword:hover {
          background: #051d2eff;
          text-decoration: underline solid 2px #0066cc;
        }
      `}</style>
    </>
  );
};

export default KeywordHighlighter;