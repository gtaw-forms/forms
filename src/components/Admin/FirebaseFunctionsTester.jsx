import React, { useState } from 'react';
import { Button, Spinner, Alert, Form } from 'react-bootstrap';
import {
    triggerExchangeAuthCodeForToken,
    triggerGetTokenForSecrets,
    triggerGetManagedGtaWorldToken,
    triggerGetProfileWithManagedToken,
    triggerValidateGtaWorldToken,
    triggerGetCachedGtaWorldProfile,
    triggerGetGtaWorldProfile,
    triggerUploadFactionData,
    triggerBatchCheckFactionMembership,
    triggerCheckFactionMembership,
    triggerTestHealthAlert,
    triggerFetchExternalUrl,
    triggerManualMaintenance
} from '../../services/firebaseFunctions';

const FirebaseFunctionsTester = ({ showInAppNotification }) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [authCode, setAuthCode] = useState('');
    const [redirectUri, setRedirectUri] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [characterId, setCharacterId] = useState('');
    const [factionId, setFactionId] = useState('364'); // Default to PHMC faction
    const [factionData, setFactionData] = useState('');
    const [metadata, setMetadata] = useState('');
    const [characterIds, setCharacterIds] = useState('');
    const [externalUrl, setExternalUrl] = useState('https://phmc.gta.world/viewforum.php?f=265');
    const [cookie, setCookie] = useState('');

    const handleTriggerFunction = async (func, ...args) => {
        setLoading(true);
        setResult(null);
        try {
            const response = await func(...args);
            setResult(response);
            showInAppNotification('Function triggered successfully. Check console for details.', 'success');
        } catch (error) {
            setResult({ error: error.message });
            showInAppNotification(`Error triggering function: ${error.message}`, 'error');
        }
        setLoading(false);
    };

    return (
        <div className="card">
            <div className="card-header">
                <h6 className="mb-0">Firebase Functions Remote Trigger</h6>
            </div>
            <div className="card-body">
                <p className="text-muted small">Scheduled functions (dailyTaskHandler, weeklyDuplicateReportsCleanup) cannot be triggered directly from the client. Use Firebase Console or CLI for manual triggers.</p>
                
                <h4 className="mt-3">OAuth & Token Management</h4>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Form.Control type="text" placeholder="Auth Code" value={authCode} onChange={(e) => setAuthCode(e.target.value)} className="w-auto" />
                    <Form.Control type="text" placeholder="Redirect URI" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} className="w-auto" />
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerExchangeAuthCodeForToken, { code: authCode, redirectUri })} disabled={loading || !authCode || !redirectUri}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'exchangeAuthCodeForToken'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerGetTokenForSecrets, { code: authCode, redirectUri })} disabled={loading || !authCode || !redirectUri}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'getTokenForSecrets'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerGetManagedGtaWorldToken)} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'getManagedGtaWorldToken'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerGetProfileWithManagedToken)} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'getProfileWithManagedToken'}
                    </Button>
                </div>

                <h7 className="mt-3">Profile & Validation</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Form.Control type="text" placeholder="Access Token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="w-auto" />
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerValidateGtaWorldToken, { accessToken })} disabled={loading || !accessToken}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'validateGtaWorldToken'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerGetCachedGtaWorldProfile, { accessToken })} disabled={loading || !accessToken}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'getCachedGtaWorldProfile'}
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerGetGtaWorldProfile, { accessToken })} disabled={loading || !accessToken}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'getGtaWorldProfile'}
                    </Button>
                </div>

                <h7 className="mt-3">Faction Data Management</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Form.Control type="text" placeholder="Character ID (single)" value={characterId} onChange={(e) => setCharacterId(e.target.value)} className="w-auto" />
                    <Form.Control type="text" placeholder="Faction ID (default: 364)" value={factionId} onChange={(e) => setFactionId(e.target.value)} className="w-auto" />
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerCheckFactionMembership, { characterId: parseInt(characterId), factionId: parseInt(factionId), accessToken })} disabled={loading || !characterId || !factionId}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'checkFactionMembership'}
                    </Button>
                    <Form.Control type="text" placeholder="Character IDs (comma-separated)" value={characterIds} onChange={(e) => setCharacterIds(e.target.value)} className="w-auto" />
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerBatchCheckFactionMembership, { characterIds: characterIds.split(',').map(id => parseInt(id.trim())), factionId: parseInt(factionId), accessToken })} disabled={loading || !characterIds || !factionId}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'batchCheckFactionMembership'}
                    </Button>
                    <Form.Control type="text" placeholder="Faction Data (JSON array)" value={factionData} onChange={(e) => setFactionData(e.target.value)} className="w-auto" />
                    <Form.Control type="text" placeholder="Metadata (JSON object)" value={metadata} onChange={(e) => setMetadata(e.target.value)} className="w-auto" />
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerUploadFactionData, { factionData: JSON.parse(factionData), metadata: JSON.parse(metadata) })} disabled={loading || !factionData || !metadata}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'uploadFactionData'}
                    </Button>
                </div>

                <h7 className="mt-3">System Health Monitor</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Button variant="danger" size="sm" onClick={() => handleTriggerFunction(triggerTestHealthAlert)} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Trigger Test Health Alert'}
                    </Button>
                    <p className="text-muted small w-100">Dispatches a mock &quot;Critical Outage&quot; alert to verify Discord webhooks and User pings.</p>
                </div>

                <h7 className="mt-3">Maintenance Tasks</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Button variant="warning" size="sm" onClick={() => handleTriggerFunction(triggerManualMaintenance)} disabled={loading}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Trigger Manual Maintenance'}
                    </Button>
                    <p className="text-muted small w-100">Manually runs the daily maintenance task, which includes bingo board resets, report cleanup, and other routine jobs.</p>
                </div>

                <h7 className="mt-3">External Proxy Tester</h7>
                <div className="d-flex flex-wrap gap-2 mb-3">
                    <Form.Control type="text" placeholder="External URL" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} className="w-50" />
                    <Form.Control type="text" placeholder="Cookie (e.g., phpbb3_..._sid=...)" value={cookie} onChange={(e) => setCookie(e.target.value)} className="w-25" />
                    <Button variant="primary" size="sm" onClick={() => handleTriggerFunction(triggerFetchExternalUrl, { url: externalUrl, cookie })} disabled={loading || !externalUrl}>
                        {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Fetch URL'}
                    </Button>
                    <p className="text-muted small w-100">Fetches the raw content of the specified URL via Firebase Functions proxy. <strong>Note:</strong> Protected pages require a valid session cookie.</p>
                </div>

                {result && (
                    <Alert variant={result.error ? 'danger' : 'success'} className="mt-3">
                        <pre style={{ maxHeight: '300px', overflowY: 'scroll', fontSize: '0.8em' }}>{JSON.stringify(result, null, 2)}</pre>
                    </Alert>
                )}
            </div>
        </div>
    );
};

export default FirebaseFunctionsTester;