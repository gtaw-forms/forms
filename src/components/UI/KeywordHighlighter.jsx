// components/KeywordHighlighter.jsx — FINAL + BULLETPROOF + STATIC METHOD
import React, { useState, useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../../firebase';
import BaseModal from '../Modals/BaseModal';

// Helper: escape HTML characters for safe insertion into DOM
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Helper: escape regex characters
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    .sort((a, b) => b.keyword.length - a.keyword.length); // longest first

  if (keywordList.length === 0) {
    return <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>{children}</div>;
  }

  let content = children;
  const finalReplacements = []; // Store the HTML for final replacement

  keywordList.forEach(kw => {
    try {
      const escaped = escapeRegExp(kw.keyword);
      // Check if the keyword contains any non-word characters that are not hyphens,
      // as hyphens are often part of keywords and \b handles them correctly
      const containsSpecialChars = /[^\w\s-]/.test(kw.keyword); // Exclude letters, numbers, underscore, space, hyphen

      const regex = containsSpecialChars
        ? new RegExp(`(${escaped})`, 'gi') // Match exact string if special chars are present
        : new RegExp(`\\b(${escaped})\\b`, 'gi'); // Use word boundaries for regular words

      // Replace with a temporary token
      content = content.replace(regex, match => {
        const escapedKeywordForData = escapeHtml(kw.keyword.toLowerCase());
        const escapedMatchContent = escapeHtml(match);
        const replacementHtml = `<span class="smart-keyword" data-kw="${escapedKeywordForData}">${escapedMatchContent}</span>`;
        finalReplacements.push(replacementHtml);
        return `__KEYWORD_TOKEN_${finalReplacements.length - 1}__`; // Return a unique token
      });
    } catch (e) {
      console.warn('Keyword regex failed:', kw.keyword, e);
    }
  });

  // After all keywords are processed, replace tokens with actual HTML
  finalReplacements.forEach((html, index) => {
    // Need to use a regex to replace all occurrences of the same token
    const tokenRegex = new RegExp(`__KEYWORD_TOKEN_${index}__`, 'g');
    content = content.replace(tokenRegex, html);
  });

  const handleClick = (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains('smart-keyword')) {
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

      <BaseModal
        isOpen={showModal && !!activeKeyword}
        onClose={() => setShowModal(false)}
        title={activeKeyword?.keyword}
        modalSize="small"
        variant="info"
        footer={
          <button 
            className="keyword-modal-btn keyword-modal-btn-primary" 
            onClick={() => setShowModal(false)}
            style={{ 
              backgroundColor: '#0066cc', 
              color: 'white', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer' 
            }}
          >
            Close
          </button>
        }
      >
        {activeKeyword && (
          <>
            <div style={{ marginBottom: 16 }}>
              <strong style={{ color: '#0066cc', fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>CONSIDER</strong>
              <p style={{ margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {activeKeyword.definition || 'No definition provided.'}
              </p>
            </div>
            {activeKeyword.tip && (
              <div style={{ marginBottom: 16 }}>
                <strong style={{ color: '#0066cc', fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>TIP</strong>
                <p style={{ margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {activeKeyword.tip}
                </p>
              </div>
            )}
          </>
        )}
      </BaseModal>

      <style>{`
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
        }
        .smart-keyword:hover {
          background: #051d2eff;
          color: white;
          text-decoration: underline solid 2px #0066cc;
        }
      `}</style>
    </>
  );
};

export default KeywordHighlighter;
