// components/KeywordHighlighter.jsx — FINAL + BULLETPROOF + STATIC METHOD
import React, { useState, useEffect } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../../firebase';
import BaseModal from '../Modals/BaseModal';
import { renderMarkdown, escapeHtml } from '../../utils/textUtils';

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

  const isHTML = /<[a-z][\s\S]*>/i.test(children);

  if (keywordList.length === 0) {
    return (
      <div 
        dangerouslySetInnerHTML={{ __html: isHTML ? children : renderMarkdown(children) }}
        style={{ wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }} 
      />
    );
  }

  let content = children;
  const finalReplacements = []; // Store the HTML for final replacement

  keywordList.forEach(kw => {
    try {
      const escaped = escapeRegExp(kw.keyword);
      const containsSpecialChars = /[^\w\s-]/.test(kw.keyword);
      const regex = containsSpecialChars
        ? new RegExp(`(${escaped})`, 'gi')
        : new RegExp(`\\b(${escaped})\\b`, 'gi');

      // Replace with a temporary token that won't conflict with Markdown (no __ or **)
      content = content.replace(regex, match => {
        const escapedKeywordForData = escapeHtml(kw.keyword.toLowerCase());
        const escapedMatchContent = escapeHtml(match);
        const replacementHtml = `<span class="smart-keyword" data-kw="${escapedKeywordForData}">${escapedMatchContent}</span>`;
        finalReplacements.push(replacementHtml);
        return `@@KWTOKEN_${finalReplacements.length - 1}@@`;
      });
    } catch (e) {
      console.warn('Keyword regex failed:', kw.keyword, e);
    }
  });

  // Apply Markdown to the text (which now contains tokens), but skip for HTML content
  if (!isHTML) {
    content = renderMarkdown(content);
  }

  // After all keywords and Markdown are processed, replace tokens with actual HTML
  finalReplacements.forEach((html, index) => {
    const tokenRegex = new RegExp(`@@KWTOKEN_${index}@@`, 'g');
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
              <div 
                style={{ margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(activeKeyword.definition || 'No definition provided.') }}
              />
            </div>
            {activeKeyword.tip && (
              <div style={{ marginBottom: 16 }}>
                <strong style={{ color: '#0066cc', fontSize: '1.1em', display: 'block', marginBottom: '4px' }}>TIP</strong>
                <div 
                  style={{ margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(activeKeyword.tip) }}
                />
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
