import React from 'react';
import { Form, Button } from 'react-bootstrap';
import './FeatureRequestModal.css';
import * as Sentry from "@sentry/react";
import { useNotification } from './NotificationContext.jsx';
import { triggerWebhookProxy } from '../services/firebaseFunctions';

const FeatureRequestModal = ({
    show,
    onClose,
    featureRequest,
    setFeatureRequest,
    discordName,
    setDiscordName,
    isBbcodeRequest,
    setIsBbcodeRequest,
    bbcodeTitleRequest,
    setBbcodeTitleRequest,
    bbcodeRequestText,
    setBbcodeRequestText,
    bbCodeVersion,
    commitInfo,
    setShowFeatureRequestModal
}) => {
    const { showNotification } = useNotification();

    const handleFeatureRequestSubmit = async () => {
        // Validations
        if (!featureRequest.trim() && (!isBbcodeRequest || !bbcodeRequestText.trim())) {
            showNotification('Please enter your bug report/feature request or the BBCode details.', 'warning');
            return;
        }
        if (!discordName.trim()) {
            showNotification('Please enter your Discord name.', 'warning');
            return;
        }
        if (isBbcodeRequest && !bbcodeTitleRequest.trim()) {
            showNotification('Please enter a title for your BBCode format request.', 'warning');
            return;
        }
        if (isBbcodeRequest && !bbcodeRequestText.trim()) {
            showNotification('Please enter the BBCode for your new format request.', 'warning');
            return;
        }

        const debugInfo = {
            bbCodeVersion: bbCodeVersion,
            userAgent: navigator.userAgent,
        };

        const MAX_FIELD_LENGTH = 1000;
        const chunkText = (text) => {
            const chunks = [];
            let current = "";
            text.split('\n').forEach(line => {
                if (current.length + line.length + 1 > MAX_FIELD_LENGTH) {
                    chunks.push(current);
                    current = line;
                } else {
                    current += (current ? '\n' : '') + line;
                }
            });
            if (current) chunks.push(current);
            return chunks;
        };

        const requestChunks = chunkText(featureRequest || "No details provided.");

        // Build first-embed fields
        const buildFields = (partIndex) => {
            const fields = [
                { name: "Submitted By", value: discordName || "N/A", inline: true },
                { name: "Request Type", value: isBbcodeRequest ? "New BBCode Format" : "Bug/Feature", inline: true },
            ];

            if (isBbcodeRequest) {
                fields.push({ name: "Proposed BBCode Title", value: bbcodeTitleRequest || "N/A", inline: false });
            }

            // BBCode text as a code block (inlined instead of file attachment)
            if (isBbcodeRequest && bbcodeRequestText.trim()) {
                const bbcodeChunks = chunkText(bbcodeRequestText);
                const bbCodeParts = partIndex < bbcodeChunks.length
                    ? bbcodeChunks.slice(partIndex, partIndex + 1)
                    : [];
                if (bbCodeParts.length > 0) {
                    const label = bbcodeChunks.length > 1
                        ? `BBCode (Part ${partIndex + 1} of ${bbcodeChunks.length})`
                        : "BBCode";
                    fields.push({ name: label, value: "```\n" + bbCodeParts[0] + "\n```", inline: false });
                }
            }

            // Request details chunk
            const detailIndex = isBbcodeRequest && bbcodeRequestText.trim()
                ? Math.max(0, partIndex - Math.ceil(bbcodeRequestText.length / MAX_FIELD_LENGTH))
                : partIndex;
            if (detailIndex < requestChunks.length) {
                const label = requestChunks.length > 1
                    ? `Request Details (Part ${detailIndex + 1} of ${requestChunks.length})`
                    : "Request Details";
                fields.push({ name: label, value: requestChunks[detailIndex] || "No details provided.", inline: false });
            }

            // Debug info only on the first message
            if (partIndex === 0) {
                fields.push({ name: "Debug Info", value: "```\n" + JSON.stringify(debugInfo, null, 2) + "\n```", inline: false });
            }

            return fields;
        };

        // Calculate total parts needed
        const bbcodeChunks = isBbcodeRequest && bbcodeRequestText.trim()
            ? chunkText(bbcodeRequestText)
            : [];
        const totalParts = Math.max(requestChunks.length, bbcodeChunks.length);

        let allWebhooksSentSuccessfully = true;

        for (let i = 0; i < totalParts; i++) {
            const partLabel = totalParts > 1 ? ` (Part ${i + 1} of ${totalParts})` : "";
            const embed = {
                title: `📝 Bug Report / Feature Request${partLabel}`,
                color: 0x3498DB,
                fields: buildFields(i),
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Tools Tool - v${commitInfo.sha || 'N/A'}` }
            };

            try {
                await triggerWebhookProxy('dev', {
                    content: `Feedback / Bug Report${partLabel}`,
                    embeds: [embed]
                });
            } catch (error) {
                allWebhooksSentSuccessfully = false;
                console.error(`Failed to send feature request part ${i + 1}:`, error);
                Sentry.captureException(error, { extra: { context: `Feature Request Part ${i + 1}` } });
                break;
            }

            // Rate-limit between parts to avoid Discord throttling
            if (i < totalParts - 1) {
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        }

        if (allWebhooksSentSuccessfully) {
            showNotification('Thanks for your feedback! I will work on it soon', 'check-circle');
            setShowFeatureRequestModal(false);
            setFeatureRequest('');
            setDiscordName('');
            setIsBbcodeRequest(false);
            setBbcodeTitleRequest('');
            setBbcodeRequestText('');
        } else {
            showNotification('Partially submitted or failed. Please check console or try again.', 'exclamation-triangle');
        }
    };

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay feature-request-modal" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h5 className="modal-title">Bug / Feature / BBCode Request</h5>
                    <button type="button" className="close" onClick={onClose}>
                        <span>&times;</span>
                    </button>
                </div>
                <div className="modal-body">
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                id="isBbcodeRequestCheckbox"
                                label="Are you requesting a new BBCode Format to be added?"
                                checked={isBbcodeRequest}
                                onChange={(e) => setIsBbcodeRequest(e.target.checked)}
                            />
                        </Form.Group>
                        {isBbcodeRequest && (
                            <>
                                <Form.Group className="mb-3">
                                    <Form.Label>Proposed BBCode Format Title</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={bbcodeTitleRequest}
                                        onChange={(e) => setBbcodeTitleRequest(e.target.value)}
                                        placeholder="Enter a title for the new BBCode format"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>BBCode</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={6}
                                        value={bbcodeRequestText}
                                        onChange={(e) => setBbcodeRequestText(e.target.value)}
                                        placeholder="Paste or type the BBCode for the new format here..."
                                    />
                                </Form.Group>
                            </>
                        )}
                        <Form.Group className="mb-3">
                            <Form.Label>Request Details</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={isBbcodeRequest ? 3 : 8}
                                value={featureRequest}
                                onChange={(e) => setFeatureRequest(e.target.value)}
                                placeholder={isBbcodeRequest
                                    ? "Provide any additional context or explanation for your BBCode request here."
                                    : "If you have located a bug, please provide as much information as possible (Pictures are also very helpful!). If you are requesting a feature, please provide a detailed description of the feature you would like to see."
                                }
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Your Discord Name / ID</Form.Label>
                            <Form.Control
                                type="text"
                                name="discordName"
                                value={discordName}
                                onChange={(e) => setDiscordName(e.target.value)}
                                placeholder="Enter your Discord Name / ID"
                            />
                        </Form.Group>
                    </Form>
                </div>
                <div className="modal-footer">
                    <Button variant="primary" onClick={handleFeatureRequestSubmit}>
                        Submit
                    </Button>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FeatureRequestModal;