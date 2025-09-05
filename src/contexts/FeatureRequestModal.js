import React from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { H } from 'highlight.run';
import { useNotification } from './NotificationContext';

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
        const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;

        if (!webhookURL) {
            console.error('Discord webhook URL not configured for feature requests.');
            H.track('Discord webhook URL is missing for feature request submission.', {level: 'error'});
            showNotification('Configuration error: Unable to submit request. Please contact the administrator.', 'exclamation-triangle');
            return;
        }

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
        // If it's a BBCode request, the BBCode text itself is now also required for file attachment
        if (isBbcodeRequest && !bbcodeRequestText.trim()) {
            showNotification('Please enter the BBCode for your new format request.', 'warning');
            return;
        }

        const debugInfo = {
            bbCodeVersion: bbCodeVersion,
            userAgent: navigator.userAgent,
        };

        const MAX_FIELD_LENGTH = 1000;
        const requestChunks = [];
        let currentChunk = "";
        const mainRequestDetails = featureRequest || (isBbcodeRequest ? "See BBCode file for details." : "No details provided.");

        mainRequestDetails.split('\n').forEach(line => {
            if (currentChunk.length + line.length + 1 > MAX_FIELD_LENGTH) {
                requestChunks.push(currentChunk);
                currentChunk = line;
            } else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        });
        if (currentChunk) {
            requestChunks.push(currentChunk);
        }

        // Base fields for the embed
        const baseEmbedFields = [
            { name: "Submitted By", value: discordName || "N/A", inline: true },
            { name: "Request Type", value: isBbcodeRequest ? "New BBCode Format" : "Bug/Feature", inline: true },
        ];

        if (isBbcodeRequest) {
            baseEmbedFields.push({ name: "Proposed BBCode Title", value: bbcodeTitleRequest || "N/A", inline: false });
        }

        let firstMessageBody;
        let firstMessageHeaders = { 'Content-Type': 'application/json' }; // Default for JSON payload

        // --- MODIFICATION START ---
        const requestDetailsFieldName = `Request Details${requestChunks.length > 1 ? ` (Part 1 of ${requestChunks.length})` : ''}`;
        // --- MODIFICATION END ---

        if (isBbcodeRequest && bbcodeRequestText.trim()) {
            const bbcodeFile = new File([new Blob([bbcodeRequestText], { type: 'text/plain;charset=utf-8' })], 'requested_bbcode.txt');
            const formDataForFile = new FormData();

            const fieldsForFileEmbed = [
                ...baseEmbedFields,
                { name: "Requested BBCode", value: "See attached 'requested_bbcode.txt'", inline: false },
                { name: requestDetailsFieldName, value: requestChunks[0] || "No details provided.", inline: false },
                { name: "Debug Info", value: `\n${JSON.stringify(debugInfo, null, 2)}\n`, inline: false }
            ];

            const embedPayloadForFile = {
                title: "📝 Bug Report / Feature Request",
                color: 0x3498DB,
                fields: fieldsForFileEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };

            formDataForFile.append('payload_json', JSON.stringify({
                content: `Feedback / Bug Report (Part 1${requestChunks.length > 1 ? ` of ${requestChunks.length}` : ''})`,
                embeds: [embedPayloadForFile]
            }));
            formDataForFile.append('file1', bbcodeFile); // 'file1' is a common key for Discord attachments

            firstMessageBody = formDataForFile;
            firstMessageHeaders = {}; // Browser sets Content-Type for FormData, so remove explicit header
        } else {
            // Standard JSON payload (not a BBCode request, or BBCode text is empty)
            const fieldsForJsonEmbed = [
                ...baseEmbedFields,
                { name: requestDetailsFieldName, value: requestChunks[0] || "No details provided.", inline: false },
                { name: "Debug Info", value: `\n${JSON.stringify(debugInfo, null, 2)}\n`, inline: false }
            ];

            const firstEmbedData = {
                title: "📝 Bug Report / Feature Request",
                color: 0x3498DB,
                fields: fieldsForJsonEmbed,
                timestamp: new Date().toISOString(),
                footer: { text: `Submitted via PHMC Forms Tool - v${commitInfo.sha || 'N/A'}` }
            };
            firstMessageBody = JSON.stringify({
                content: `Feedback / Bug Report (Part 1${requestChunks.length > 1 ? ` of ${requestChunks.length}` : ''})`,
                embeds: [firstEmbedData]
            });
        }

        let allWebhooksSentSuccessfully = true;

        try {
            // Send the first message (either FormData with file or JSON)
            const firstResponse = await fetch(webhookURL, {
                method: 'POST',
                headers: firstMessageHeaders,
                body: firstMessageBody,
            });

            if (!firstResponse.ok) {
                allWebhooksSentSuccessfully = false;
                const errorText = await firstResponse.text();
                console.error(`Failed to send message (Part 1) to Discord webhook. Status: ${firstResponse.status} ${firstResponse.statusText}`, errorText);
                H.track(`Discord webhook failed for feature request (Part 1): ${firstResponse.status}`, {
                    level: 'error',
                    extra: { statusText: firstResponse.statusText, responseBody: errorText }
                });
            }

            // Send subsequent chunks for long "Request Details" (always JSON)
            if (allWebhooksSentSuccessfully && requestChunks.length > 1) {
                for (let i = 1; i < requestChunks.length; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1200)); // Delay

                    const subsequentEmbedData = {
                        title: `📝 Bug/Feature Request Details (Part ${i + 1} of ${requestChunks.length})`,
                        description: requestChunks[i],
                        color: 0x3498DB,
                        timestamp: new Date().toISOString(),
                        footer: {
                            text: `Submitted by: ${discordName || "N/A"} | PHMC Forms Tool - v${commitInfo.sha || 'N/A'}`
                        }
                    };
                    const subsequentResponse = await fetch(webhookURL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }, // Subsequent parts are always JSON
                        body: JSON.stringify({
                            content: `Feedback / Bug Report (Part ${i + 1} of ${requestChunks.length})`,
                            embeds: [subsequentEmbedData]
                        }),
                    });

                    if (!subsequentResponse.ok) {
                        allWebhooksSentSuccessfully = false;
                        const errorText = await subsequentResponse.text();
                        console.error(`Failed to send message (Part ${i + 1}) to Discord webhook. Status: ${subsequentResponse.status} ${subsequentResponse.statusText}`, errorText);
                        H.track(`Discord webhook failed for feature request (Part ${i + 1}): ${subsequentResponse.status}`, {
                            level: 'error',
                            extra: { statusText: subsequentResponse.statusText, responseBody: errorText }
                        });
                        break;
                    }
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
                showNotification(`Partially submitted or failed. Please check console or try again.`, 'exclamation-triangle');
            }

        } catch (error) {
            console.error('Error submitting feature request:', error);
            H.consumeError(error, { context: 'Feature Request Submission Fetch' });
            showNotification('A network error occurred. Please try again.', 'exclamation-triangle');
        }
    };

    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal">
                <Modal.Header>
                    <Modal.Title>Bug / Feature / BBCode Request</Modal.Title>
                    <Button variant="secondary" className="close" onClick={onClose}>
                        CLOSE
                    </Button>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Check
                                type="checkbox"
                                id="isBbcodeRequestCheckbox"
                                label="  Are you requesting a new BBCode Format to be added?"
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
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={handleFeatureRequestSubmit}>
                        Submit
                    </Button>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                </Modal.Footer>
            </div>
        </div>
    );
};

export default FeatureRequestModal;