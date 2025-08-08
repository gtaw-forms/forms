import React, { useState, useCallback } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { copyToClipboard } from './notificationService';

// --- Styles --- (Basic, you can expand on these)
const modalOverlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
    justifyContent: 'center', alignItems: 'center', zIndex: 1050,
};
const modalContentStyle = {
    backgroundColor: '#0d1117', color: '#c9d1d9', padding: '20px',
    borderRadius: '8px', width: '90%', maxWidth: '900px',
    maxHeight: '80vh', overflow: 'auto', position: 'relative',
    border: '1px solid #30363d',
};
const modalHeaderStyle = {
    fontSize: '1.3em', fontWeight: 'bold', marginBottom: '15px',
    borderBottom: '1px solid #30363d', paddingBottom: '10px',
    color: '#c9d1d9', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center'
};
const modalTitleStyle = { margin: 0 };
const closeButtonStyle = {
    background: 'none', border: 'none', color: '#c9d1d9',
    fontSize: '24px', cursor: 'pointer', lineHeight: '1', padding: '0 5px',
};
const modalBodyStyle = {
    display: 'flex',
    gap: '20px',
    overflow: 'auto',
    paddingTop: '10px',
};
const previewContainerStyle = {
    flex: '2', // Increased flex for preview
    border: '1px solid #30363d',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#161b22',
    overflowWrap: 'break-word',
    wordWrap: 'break-word',
    hyphens: 'auto',
    minHeight: '200px',
};
const bbCodeContainerStyle = {
    flex: '2', // Increased flex for BBCode
    border: '1px solid #30363d',
    padding: '10px',
    borderRadius: '5px',
    backgroundColor: '#161b22',
    color: '#98c379', // Example BBCode color
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
    minHeight: '200px',
};
const modalFooterStyle = {
    borderTop: '1px solid #30363d', paddingTop: '15px', marginTop: '20px',
    display: 'flex', justifyContent: 'flex-end', gap: '10px',
};
const inputContainerStyle = { // New style for input container
    flex: '1', // Reduced flex for input
    minWidth: '250px', // Minimum width to prevent too much shrinking
};

const MarkdownBBCodeModal = ({ show, onHide, showNotification }) => {
    const [markdown, setMarkdown] = useState('');
    const [bbcode, setBbcode] = useState('');

    const convertMarkdownToBBCode = useCallback((mdText) => {
        let bbcodeText = mdText;

        // Basic conversions (expand as needed)
        bbcodeText = bbcodeText.replace(/\*\*(.*?)\*\*/g, '[b]$1[/b]');     // Bold
        bbcodeText = bbcodeText.replace(/\*(.*?)\*/g, '[i]$1[/i]');           // Italics
        bbcodeText = bbcodeText.replace(/~~(.*?)\~\~/g, '[s]$1[/s]');         // Strikethrough
        bbcodeText = bbcodeText.replace(/`(.*?)`/g, '[code]$1[/code]');       // Code
        bbcodeText = bbcodeText.replace(/### (.*?)/g, '[size=150]$1[/size]'); // Heading 3
        bbcodeText = bbcodeText.replace(/## (.*?)/g, '[size=175]$1[/size]');  // Heading 2
        bbcodeText = bbcodeText.replace(/# (.*?)/g, '[size=200]$1[/size]');   // Heading 1
        bbcodeText = bbcodeText.replace(/\[(.*?)\]\((.*?)\)/g, '[url=$2]$1[/url]');  // Links
        bbcodeText = bbcodeText.replace(/<\/a>/g, '');                          // Remove HTML
        bbcodeText = bbcodeText.replace(/&lt;/g, '<');                          // Remove HTML
        bbcodeText = bbcodeText.replace(/&gt;/g, '>');                          // Remove HTML
        bbcodeText = bbcodeText.replace(/<br \/>/g, '\n');                          // Remove HTML
        bbcodeText = bbcodeText.replace(/<br>/g, '\n');                          // Remove HTML
        // Lists

        return bbcodeText;
    }, []);

    const handleMarkdownChange = useCallback((e) => {
        const newMarkdown = e.target.value;
        setMarkdown(newMarkdown);
        setBbcode(convertMarkdownToBBCode(newMarkdown));
    }, [convertMarkdownToBBCode]);
    const handleCopyToClipboard = async () => {
        await copyToClipboard(bbcode, showNotification, 'BBCode copied to clipboard!');
    };

    if (!show) return null;

    return (
        <div style={modalOverlayStyle} onClick={onHide}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <div style={modalHeaderStyle}>
                    <h5 style={modalTitleStyle}>Markdown to BBCode Converter</h5>
                    <button onClick={onHide} style={closeButtonStyle} aria-label="Close modal">
                        &times;
                    </button>
                </div>
                <div style={modalBodyStyle}>
                <div style={inputContainerStyle}> {/* New container for input */}
                <Form.Label>Markdown Input</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={10}
                        placeholder="Type Markdown here..."
                        value={markdown}
                        onChange={handleMarkdownChange}
                        style={{ backgroundColor: '#161b22', color: '#c9d1d9', borderColor: '#30363d' }}
                    />
                </div>
                    <div style={previewContainerStyle}>
                    <Form.Label>Markdown Conversion</Form.Label>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} children={markdown} />
                    </div>
                    <div style={bbCodeContainerStyle}>
                    <Form.Label>BBCode Output</Form.Label>
                        {bbcode}
                    </div>
                </div>
                <div style={modalFooterStyle}>
                    <Button variant="secondary" onClick={onHide}>Cancel</Button>
                     <Button variant="success" onClick={handleCopyToClipboard}>Copy BBCode</Button>

                </div>
            </div>
        </div>
    );
};

export default MarkdownBBCodeModal;
