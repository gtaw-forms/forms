Navigated to https://ucp.gta.world/oauth/authorize?response_type=code&client_id=82&redirect_uri=https%3A%2F%2Fgtaw-forms.github.io%2Fforms%2F%23%2Fauth%2Fgta%2Fcallback&state=n74v7jf3is68bl00bmfo6mhzet2k3&scope=
🧭 [GTAW Login] Redirect Path Analysis: 
Object { currentPath: "#/", fullUrl: "https://gtaw-forms.github.io/forms/", pathname: "/forms/", search: "", hash: "", isOnHomepage: true, isOnAdminPage: false, isOnFormPage: false, isOnAuthPage: false, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0", … }
vendor-URVEFS8n.js:44:2928
[GTA Auth] No complete session data found for restoration vendor-URVEFS8n.js:44:2928
[GTA Auth] Initiating OAuth flow vendor-URVEFS8n.js:44:2928
[GTA Auth] Stored OAuth state: 
Object { state: "n74v7jf3is68bl00bmfo6mhzet2k3", returnPath: "#/", redirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback" }
vendor-URVEFS8n.js:44:2928
[GTA Auth] Authorization URL details: 
Object { baseUrl: "https://ucp.gta.world/oauth/authorize", redirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback", clientId: "82", state: "n74v7jf3is68bl00bmfo6mhzet2k3", fullAuthUrl: "https://ucp.gta.world/oauth/authorize?response_type=code&client_id=82&redirect_uri=https%3A%2F%2Fgtaw-forms.github.io%2Fforms%2F%23%2Fauth%2Fgta%2Fcallback&state=n74v7jf3is68bl00bmfo6mhzet2k3&scope=" }
vendor-URVEFS8n.js:44:2928
[GTA Auth] Redirecting to: https://ucp.gta.world/oauth/authorize?response_type=code&client_id=82&redirect_uri=https%3A%2F%2Fgtaw-forms.github.io%2Fforms%2F%23%2Fauth%2Fgta%2Fcallback&state=n74v7jf3is68bl00bmfo6mhzet2k3&scope= vendor-URVEFS8n.js:44:2928
Sentry has been initialized. console.js:36:14
[DataContext] coronerListData: Both faction and legacy data empty console.js:36:14
[DataContext] phmcListData: Both faction and legacy data empty console.js:36:14
[DataContext] phmcGroupedOptions: Empty - phmcListData has 0 items console.js:36:14
[DataContext] coronerListData: Both faction and legacy data empty console.js:36:14
[DataContext] phmcListData: Both faction and legacy data empty console.js:36:14
[DataContext] phmcGroupedOptions: Empty - phmcListData has 0 items console.js:36:14
[GTA Auth] No complete session data found for restoration console.js:36:14
🎯 [UnifiedGtaCallback] Starting processCallback with: 
Object { code: "def50200f5...", state: "n74v7jf3is68bl00bmfo6mhzet2k3" }
console.js:36:14
[GTA Auth] Processing OAuth callback console.js:36:14
[Perf] OAuth session started [1763158126005-2juxr] console.js:36:14
[Perf] validation: 0.00ms console.js:36:14
[GTA Auth] State validation details: 
Object { receivedState: "n74v7jf3is68bl00bmfo6mhzet2k3", storedState: "n74v7jf3is68bl00bmfo6mhzet2k3", storedOAuthData: {…}, stateMatch: true, storedDataExists: true, receivedStateLength: 29, storedStateLength: 29, sessionStorageRaw: '{"state":"n74v7jf3is68bl00bmfo6mhzet2k3","returnPath":"#/","redirectUri":"https://gtaw-forms.github.io/forms/#/auth/gta/callback","timestamp":1763158096947,"clientId":"82"}' }
console.js:36:14
[GTA Auth] OAuth state validated successfully console.js:36:14
[GTA Auth] OAuth timing: 
Object { storedTimestamp: 1763158096947, currentTimestamp: 1763158126006, timeDifferenceSeconds: 29, codeAge: "29s" }
console.js:36:14
[GTA Auth] Calling Firebase function for token exchange console.js:36:14
[GTA Auth] Configuration: 
Object { functionName: "exchangeAuthCodeForToken", hasClientId: true, redirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback", codeLength: 810, functionsRegion: "us-central1", requestKey: "def50200f580b538e62463400d396b1b6035c9ef3c2fff1450..." }
console.js:36:14
🔥 [GTA Auth] Calling Firebase function [1763158126006-ic65j]: 
Object { function: "exchangeAuthCodeForToken", callId: "1763158126006-ic65j", codeLength: 810, redirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback", clientId: "present", timestamp: 1763158126006 }
    ataContext] phmcGroupedOptions created: 60 groups console.js:36:14
XHRPOST
https://us-central1-gtaw-forms.cloudfunctions.net/exchangeAuthCodeForToken
[HTTP/2 504  20074ms]

XHRHEAD
https://o4509126124765184.ingest.de.sentry.io/api/4509126125813840/envelope/
[HTTP/2 404  123ms]

Sentry connectivity check successful. Discord reports will show Sentry as 'Active'. console.js:36:14
Cookie “_ga_2309FC6WKM” has been rejected for invalid domain. forms
The value of the attribute “expires” for the cookie “_ga_2309FC6WKM” has been overwritten. forms
Cookie “_ga_2309FC6WKM” has been rejected for invalid domain. forms
Cookie “_ga” has been rejected for invalid domain. forms
❌ [GTA Auth] Firebase function error [1763158126006-ic65j]: 
Object { error: "Firebase function call timed out after 20 seconds", code: undefined, duration: 20011, function: "exchangeAuthCodeForToken" }
console.js:36:14
[GTA Auth] Inner token exchange error: Error: Firebase function call timed out after 20 seconds
    s gtaWorldAuth.js:909
    r helpers.js:93
    setTimeout handler*zd/< browserapierrors.js:96
    u gtaWorldAuth.js:909
    s gtaWorldAuth.js:908
    F0 gtaWorldAuth.js:993
    Bf gtaWorldAuth.js:388
    _ useGtaWorldAuth.js:217
    _ useGtaWorldAuth.js:214
    G0 UnifiedGtaCallback.jsx:34
    G0 UnifiedGtaCallback.jsx:109
    React 3
    Ge scheduler.production.min.js:13
    ut scheduler.production.min.js:14
    Cc scheduler.production.min.js:14
    Cc scheduler.production.min.js:19
    _c index.js:4
    React 3
console.js:36:14
[GTA Auth] Token exchange failed: Error: Firebase function call timed out after 20 seconds
    s gtaWorldAuth.js:909
    r helpers.js:93
    setTimeout handler*zd/< browserapierrors.js:96
    u gtaWorldAuth.js:909
    s gtaWorldAuth.js:908
    F0 gtaWorldAuth.js:993
    Bf gtaWorldAuth.js:388
    _ useGtaWorldAuth.js:217
    _ useGtaWorldAuth.js:214
    G0 UnifiedGtaCallback.jsx:34
    G0 UnifiedGtaCallback.jsx:109
    React 3
    Ge scheduler.production.min.js:13
    ut scheduler.production.min.js:14
    Cc scheduler.production.min.js:14
    Cc scheduler.production.min.js:19
    _c index.js:4
    React 3
console.js:36:14
[GTA Auth] Error details: 
Object { code: undefined, message: "Firebase function call timed out after 20 seconds", details: undefined, stack: "F0/u</s<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:13983\nr@https://gtaw-forms.github.io/forms/assets/vendor-URVEFS8n.js:514:5804\nsetTimeout handler*zd/<@https://gtaw-forms.github.io/forms/assets/vendor-URVEFS8n.js:517:24112\nF0/u<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:13976\nF0/s<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:13947\nF0@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:15849\nBf@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:4520\ngs/_</<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:27951\ngs/_<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:27910\nG0/</<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:33636\nG0/<@https://gtaw-forms.github.io/forms/assets/index-Df2IKoK5.js:3250:35558\nal@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:32:24320\nLn@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:32:42502\nxc/sc/<@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:32:40799\nGe@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:17:1630\nut@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:17:2016\nEventHandlerNonNull*Cc/<@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:17:2195\nCc@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:17:3978\n_c@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:17:4036\nxc@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:25:59\nzc@https://gtaw-forms.github.io/forms/assets/react-7MU6i0XA.js:32:57834\n@https://gtaw-forms.github.io/forms/assets/bootstrap-BmKVvN9Q.js:9:767\n" }
console.js:36:14
[Perf] token_exchange: 20014.00ms console.js:36:14
[GTA Auth] Token exchange completed: 
Object { success: false, hasToken: false, hasUser: false, errorCode: "unknown", originalRedirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback" }
console.js:36:14
[GTA Auth] OAuth callback error: Error: Firebase function call timed out after 20 seconds
    Bf gtaWorldAuth.js:773
    _ useGtaWorldAuth.js:217
    _ useGtaWorldAuth.js:214
    G0 UnifiedGtaCallback.jsx:34
    G0 UnifiedGtaCallback.jsx:109
    React 3
    Ge scheduler.production.min.js:13
    ut scheduler.production.min.js:14
    Cc scheduler.production.min.js:14
    Cc scheduler.production.min.js:19
    _c index.js:4
    React 3
console.js:36:14
[Perf] OAuth failed [1763158126005-2juxr]: 
Object { totalDuration: "20015.00ms", phases: {…}, error: "Firebase function call timed out after 20 seconds" }
console.js:36:14
[Perf Summary] Last 2 OAuth attempts: avg 19522ms, 0% success console.js:36:14
[Perf Alert] Slow OAuth detected: 20015ms - investigate bottlenecks console.js:36:14
❌ [useGtaWorldAuth] handleOAuthCallback onError called: 
Object { duration: 20021, errorMessage: "Something went wrong during authentication. Please notify the Maintainer in the PHMC Discord" }
console.js:36:14
❌ [UnifiedGtaCallback] processCallback failed: Error: Something went wrong during authentication. Please notify the Maintainer in the PHMC Discord
    _ useGtaWorldAuth.js:240
    Bf gtaWorldAuth.js:853
    _ useGtaWorldAuth.js:217
    _ useGtaWorldAuth.js:214
    G0 UnifiedGtaCallback.jsx:34
    G0 UnifiedGtaCallback.jsx:109
    React 3
    Ge scheduler.production.min.js:13
    ut scheduler.production.min.js:14
    Cc scheduler.production.min.js:14
    Cc scheduler.production.min.js:19
    _c index.js:4

    Firebase Logs
2025-11-14 22:08:46.499
OPTIONS
204
265 B
5 ms
Firefox 145.0
https://us-central1-gtaw-forms.cloudfunctions.net/exchangeAuthCodeForToken
2025-11-14 22:08:46.641
POST
504
339 B
19.946 s
Firefox 145.0
https://us-central1-gtaw-forms.cloudfunctions.net/exchangeAuthCodeForToken
2025-11-14 22:08:46.649
Callable request verification passed
2025-11-14 22:08:46.649
[OAuth] Received token exchange request 
2025-11-14 22:08:46.650
[OAuth] Request auth: authenticated 
2025-11-14 22:08:46.650
[OAuth] Has code: true 
2025-11-14 22:08:46.650
[OAuth] Has redirectUri: true 
2025-11-14 22:08:46.651
[OAuth] Client ID comparison debug: {   hasProvidedClientId: true,   hasServerClientId: true,   providedLength: 2,   serverLength: 2,   providedPrefix: '82...',   serverPrefix: '82...',   exactMatch: true,   trimmedMatch: true } 
2025-11-14 22:08:46.651
[OAuth] Starting token exchange with GTA World 
2025-11-14 22:08:46.652
[OAuth] Token exchange parameters: {   hasCode: true,   codeLength: 810,   codePrefix: 'def50200f580b538e624...',   redirectUri: 'https://gtaw-forms.github.io/forms/#/auth/gta/callback',   redirectUriEncoded: 'https%3A%2F%2Fgtaw-forms.github.io%2Fforms%2F%23%2Fauth%2Fgta%2Fcallback',   clientId: '82...',   tokenUrl: 'https://ucp.gta.world/oauth/token' } 
2025-11-14 22:08:46.653
[OAuth] Token request body parameters: {   grant_type: 'authorization_code',   client_id: '82...',   client_secret: 'SET',   redirect_uri: 'https://gtaw-forms.github.io/forms/#/auth/gta/callback',   code: 'def50200f580b538e62463400d396b...',   bodyString: 'grant_type=authorization_code&client_id=82&client_secret=YATn7y9ZhBkwnBoco4QrgQswGFDzIs9ndTjiHud1&redirect_uri=https%3A%2F%2Fgtaw-forms.github.io%2Fforms%2F%23%2Fauth%2Fgta%2Fcallback&code=def50200f58...' } 
2025-11-14 22:08:56.575
[OAuth] Token response status: 200 
2025-11-14 22:08:56.576
[OAuth] Token response headers: {   'alt-svc': 'h3=":443"; ma=86400',   'cache-control': 'no-store, private',   'cf-cache-status': 'DYNAMIC',   'cf-ray': '99e9d453dcfcd7f1-ORD',   connection: 'keep-alive',   'content-encoding': 'br',   'content-type': 'application/json; charset=UTF-8',   date: 'Fri, 14 Nov 2025 22:08:56 GMT',   nel: '{"report_to":"cf-nel","success_fraction":0.0,"max_age":604800}',   pragma: 'no-cache',   'report-to': '{"group":"cf-nel","max_age":604800,"endpoints":[{"url":"https://a.nel.cloudflare.com/report/v4?s=eD1dnaupKGVEoj1X%2FFwiXEMSmYWprtO05dz5ppiwLloRpOXoaoU79vv2AGPuDE78ciiX7w1CEV2SAbeUAqB6DZXqVptGtHC2K1KY5Pw%3D"}]}',   server: 'cloudflare',   'transfer-encoding': 'chunked',   vary: 'Origin',   'x-ratelimit-limit': '60',   'x-ratelimit-remaining': '59' } 
2025-11-14 22:08:56.587
[OAuth] Raw token response: {   status: 200,   statusText: 'OK',   contentType: 'application/json; charset=UTF-8',   textLength: 1857,   startsWithHTML: false,   firstChars: '{"token_type":"Bearer","expires_in":31536000,"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI4MiIsImp0aSI6IjdmZWNjYzU1MzI5OWVhOGQ3MDg0ODc0YjhhOTExNDY0Y2YxZmY4M2FjNTRhMmVlNDMzNzU2YmJkNz' } 
2025-11-14 22:08:56.587
[OAuth] Token exchange successful, fetching user profile 
2025-11-14 22:08:56.587
[OAuth] User profile request details: {   url: 'https://ucp.gta.world/api/user',   hasAccessToken: true,   tokenType: 'Bearer',   tokenPrefix: 'eyJ0eXAiOiJKV1QiLCJh...' } 
2025-11-14 22:09:06.589
[OAuth] Unexpected error during token exchange: DOMException [AbortError]: This operation was aborted     at node:internal/deps/undici/undici:13510:13     at process.processTicksAndRejections (node:internal/process/task_queues:95:5)     at async file:///workspace/index.js:817:30     at async /workspace/node_modules/firebase-functions/lib/common/providers/https.js:467:26 
2025-11-14 22:09:06.589
[OAuth] Error stack: AbortError: This operation was aborted     at node:internal/deps/undici/undici:13510:13     at process.processTicksAndRejections (node:internal/process/task_queues:95:5)     at async file:///workspace/index.js:817:30     at async /workspace/node_modules/firebase-functions/lib/common/providers/https.js:467:26 
