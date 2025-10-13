import React, { useEffect, useState } from 'react';

// This is the page the user will be sent back to after authenticating.
// It must exactly match what you have configured in your GTA World OAuth application settings.
const REDIRECT_URI = process.env.REACT_APP_GTA_WORLD_REDIRECT_URI;

const sendWebhook = async (authCode) => {
    const webhookURL = process.env.REACT_APP_DEV_WEBHOOK;
    if (!webhookURL) {
        console.warn("Dev webhook URL not configured. Skipping log.");
        return;
    }
    const embed = {
        title: "GTA World Auth Code Received",
        color: 0x00FF00,
        fields: [
            { name: "Authorization Code", value: `\`${authCode}\``, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "PHMC Tools - GTA World Auth" }
    };
    try {
        const response = await fetch(webhookURL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        if (!response.ok) {
            console.error(`Failed to send webhook. Status: ${response.status}`);
        } else {
            console.log(`Auth code logged to Discord.`);
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
    }
};

const GtaCallback = () => {
    const [userData, setUserData] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const exchangeCode = async (authCode) => {
            try {
                const clientId = process.env.REACT_APP_GTAWORLD_CLIENT_ID;
                const clientSecret = process.env.REACT_APP_GTAWORLD_CLIENT_SECRET;
                const tokenUrl = 'https://ucp.gta.world/oauth/token';

                if (!clientId || !clientSecret) {
                    throw new Error("Client ID or Client Secret is not configured in your environment variables.");
                }

                // Step 1: Exchange authorization code for an access token
                const tokenParams = new URLSearchParams();
                tokenParams.append('grant_type', 'authorization_code');
                tokenParams.append('client_id', clientId);
                tokenParams.append('client_secret', clientSecret);
                tokenParams.append('redirect_uri', REDIRECT_URI);
                tokenParams.append('code', authCode);

                const tokenResponse = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: tokenParams,
                });

                const tokenData = await tokenResponse.json();

                if (!tokenResponse.ok) {
                    throw new Error(tokenData.message || 'Failed to fetch access token');
                }
                
                const accessToken = tokenData.access_token;

                // Step 2: Use the access token to get user data
                const userApiUrl = 'https://ucp.gta.world/api/user';
                const userResponse = await fetch(userApiUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                const userDataResponse = await userResponse.json();

                if (!userResponse.ok) {
                    throw new Error(userDataResponse.message || 'Failed to fetch user data');
                }
                
                setUserData(userDataResponse);

            } catch (err) {
                setError(`Error exchanging code: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');
        const authError = urlParams.get('error');

        if (authError) {
            setError(`Authentication failed: ${authError}`);
            setIsLoading(false);
            return;
        }

        if (authCode) {
            console.log("GTA World Authorization Code:", authCode);
            sendWebhook(authCode);
            exchangeCode(authCode);
        } else {
            setError("No authorization code found.");
            setIsLoading(false);
        }
    }, []);

    return (
        <div>
            <h2>GTA World Authentication</h2>
            {isLoading && <p>Authenticating...</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            {userData && (
                <div>
                    <p>Authentication successful!</p>
                    <pre>{JSON.stringify(userData, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default GtaCallback;