// components/KeywordHighlighter.jsx — FINAL + BULLETPROOF + STATIC METHOD
// Highlights LSCC keywords in protocol content and opens a self-contained modal
// (portal'd to document.body — no BaseModal dependency) with the keyword info.
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { onValue, ref } from 'firebase/database';
import { database } from '../../firebase';
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

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showModal]);

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

  if (!isHTML) {
    content = renderMarkdown(content);
  }

  finalReplacements.forEach((html, index) => {
    const tokenRegex = new RegExp(`@@KWTOKEN_${index}@@`, 'g');
    content = content.replace(tokenRegex, html);
  });

  const handleClick = (e) => {
    const el = e.target && e.target.closest ? e.target.closest('.smart-keyword') : null;
    if (!el) return;
    const kwKey = el.getAttribute('data-kw');
    const kw = keywordList.find(k => k.keyword.toLowerCase() === kwKey);
    if (kw) {
      setActiveKeyword(kw);
      setShowModal(true);
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

      {showModal && activeKeyword && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(6,10,18,0.72)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#121A2C', border: '1px solid #324467', borderRadius: 14,
              maxWidth: 460, width: '100%', maxHeight: '85vh', display: 'flex',
              flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #25324D', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: '#33D6C0' }}>{activeKeyword.keyword}</h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid #25324D', background: '#182238', color: '#8B96AE', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '22px 20px', color: '#E7ECF5', fontSize: 13, lineHeight: 1.55, overflowY: 'auto' }}>
              <strong style={{ color: '#33D6C0', fontSize: '1.1em', display: 'block', marginBottom: 4 }}>CONSIDER</strong>
              <div
                style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(activeKeyword.definition || 'No definition provided.') }}
              />
              {activeKeyword.tip && (
                <div style={{ marginTop: 16 }}>
                  <strong style={{ color: '#33D6C0', fontSize: '1.1em', display: 'block', marginBottom: 4 }}>TIP</strong>
                  <div
                    style={{ margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(activeKeyword.tip) }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

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
