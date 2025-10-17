[Unified Callback] URL parameter extraction (comprehensive): 
Object { fullUrl: "https://gtaw-forms.github.io/forms/#/auth/gta/callback?code=def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5830d96aa4f9836f26ef370c33748f4b4d538881e29f65f59c3b1e157ba9b1b94b0cc5b8cf7e56ac55878f9fd0a442ff96b9f06a4958a1e8f27fc86db797eb5868e1eec4cef06d02a175f073f8a90de380b2b1912e416bbdd3431c26cff8636add250718d7c4569bb52a0f6be6650e542430fece34c8889a9f19571460fe37d595e08cb764d77d5a9ee8b6a31bcf043e4b73a369e1af3d63052ef51ba8fee7fec3caa3efb416ad8b01833529248cd2b0134772836d46306408f7caf6465e7ae6d53c6f2b12e2e96a036fcae03b555f6c24080f7b3c692741d9f7dec624118a997d60850dbf6722b0bbfbf01d149771ea543282d6d9b2448a94caa75cf2a7d083260135075092859d3e801e689692c89b94ff6907fa4df50e623395d8043b00b64120c5dd8a1afd1abe59709c1c146f1a74399581e0d49ba24e77b689e6d405dd16594b141f0db33cb759de33aafdec5bab1524e01033f31830bcb5c454b208c08fbad03e166a950c2363cb48d8280a48b6dcf36c19c4a21f61dbe2843&state=dvsxg59galaoqq60w6so0emgvg1t0m", locationSearch: "?code=def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5830d96aa4f9836f26ef370c33748f4b4d538881e29f65f59c3b1e157ba9b1b94b0cc5b8cf7e56ac55878f9fd0a442ff96b9f06a4958a1e8f27fc86db797eb5868e1eec4cef06d02a175f073f8a90de380b2b1912e416bbdd3431c26cff8636add250718d7c4569bb52a0f6be6650e542430fece34c8889a9f19571460fe37d595e08cb764d77d5a9ee8b6a31bcf043e4b73a369e1af3d63052ef51ba8fee7fec3caa3efb416ad8b01833529248cd2b0134772836d46306408f7caf6465e7ae6d53c6f2b12e2e96a036fcae03b555f6c24080f7b3c692741d9f7dec624118a997d60850dbf6722b0bbfbf01d149771ea543282d6d9b2448a94caa75cf2a7d083260135075092859d3e801e689692c89b94ff6907fa4df50e623395d8043b00b64120c5dd8a1afd1abe59709c1c146f1a74399581e0d49ba24e77b689e6d405dd16594b141f0db33cb759de33aafdec5bab1524e01033f31830bcb5c454b208c08fbad03e166a950c2363cb48d8280a48b6dcf36c19c4a21f61dbe2843&state=dvsxg59galaoqq60w6so0emgvg1t0m", locationHash: "", windowSearch: "", windowHash: "#/auth/gta/callback?code=def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5830d96aa4f9836f26ef370c33748f4b4d538881e29f65f59c3b1e157ba9b1b94b0cc5b8cf7e56ac55878f9fd0a442ff96b9f06a4958a1e8f27fc86db797eb5868e1eec4cef06d02a175f073f8a90de380b2b1912e416bbdd3431c26cff8636add250718d7c4569bb52a0f6be6650e542430fece34c8889a9f19571460fe37d595e08cb764d77d5a9ee8b6a31bcf043e4b73a369e1af3d63052ef51ba8fee7fec3caa3efb416ad8b01833529248cd2b0134772836d46306408f7caf6465e7ae6d53c6f2b12e2e96a036fcae03b555f6c24080f7b3c692741d9f7dec624118a997d60850dbf6722b0bbfbf01d149771ea543282d6d9b2448a94caa75cf2a7d083260135075092859d3e801e689692c89b94ff6907fa4df50e623395d8043b00b64120c5dd8a1afd1abe59709c1c146f1a74399581e0d49ba24e77b689e6d405dd16594b141f0db33cb759de33aafdec5bab1524e01033f31830bcb5c454b208c08fbad03e166a950c2363cb48d8280a48b6dcf36c19c4a21f61dbe2843&state=dvsxg59galaoqq60w6so0emgvg1t0m", searchParams: {…}, hashParams: {}, windowSearchParams: {}, windowHashParams: {…}, extractedCode: "def50200d8...", … }
console.ts:39:14
[Unified Callback] Processing OAuth code: def50200d8... console.ts:39:14
[GTA Auth] Processing OAuth callback console.ts:39:14
[GTA Auth] State validation details: 
Object { receivedState: "dvsxg59galaoqq60w6so0emgvg1t0m", storedState: undefined, storedOAuthData: {}, stateMatch: false, storedDataExists: false, receivedStateLength: 30, storedStateLength: undefined, sessionStorageRaw: null }
console.ts:39:14
[GTA Auth] OAuth state validation failed: 
Object { stored: undefined, received: "dvsxg59galaoqq60w6so0emgvg1t0m", storedDataFull: {} }
console.ts:39:14
[GTA Auth] STATE VALIDATION BYPASSED - This could be a race condition or development mode console.ts:39:14
[GTA Auth] Proceeding with authentication despite state mismatch... console.ts:39:14
[GTA Auth] OAuth state validated successfully console.ts:39:14
[GTA Auth] OAuth timing: 
Object { storedTimestamp: undefined, currentTimestamp: 1760741539890, timeDifferenceSeconds: NaN, codeAge: "NaNs" }
console.ts:39:14
[GTA Auth] Calling Firebase function for token exchange console.ts:39:14
[GTA Auth] Configuration: 
Object { functionName: "exchangeAuthCodeForToken", hasClientId: true, redirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback", codeLength: 810, functionsRegion: "us-central1", requestKey: "def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5..." }
console.ts:39:14
[GTA Auth] Calling Firebase function... console.ts:39:14
XHRPOST
https://us-central1-gtaw-forms.cloudfunctions.net/exchangeAuthCodeForToken
[HTTP/3 500  1715ms]

[Unified Callback] Full authentication result: 
Object { authResult: undefined, user: null, userType: "object", userKeys: "no user object", authResultType: "undefined", authResultKeys: "no auth result", timestamp: "2025-10-17T22:52:19.985Z" }
console.ts:39:14
[Unified Callback] Found fallback user data in sessionStorage: 
Object { id: 43132, username: "ItsMitch", confirmed: 1, role: null, character: (3) […], created_at: "2018-06-28T17:37:10.000000Z", faction: null, permissions: [], accessLevel: "none", factionInfo: null, … }
console.ts:39:14
[Unified Callback] Authentication successful, user data: 
Object { hasUser: true, userId: 43132, username: "ItsMitch", source: "sessionStorage" }
console.ts:39:14
[Unified Callback] State extraction debug: 
Object { fromSearchParams: "dvsxg59galaoqq60w6so0emgvg1t0m", fromHashParams: null, fromWindowSearch: null, fromWindowHash: "dvsxg59galaoqq60w6so0emgvg1t0m", finalState: "dvsxg59galaoqq60w6so0emgvg1t0m", stateLength: 30 }
console.ts:39:14
[Unified Callback] URL parameter extraction (comprehensive): 
Object { fullUrl: "https://gtaw-forms.github.io/forms/#/auth/gta/callback?code=def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5830d96aa4f9836f26ef370c33748f4b4d538881e29f65f59c3b1e157ba9b1b94b0cc5b8cf7e56ac55878f9fd0a442ff96b9f06a4958a1e8f27fc86db797eb5868e1eec4cef06d02a175f073f8a90de380b2b1912e416bbdd3431c26cff8636add250718d7c4569bb52a0f6be6650e542430fece34c8889a9f19571460fe37d595e08cb764d77d5a9ee8b6a31bcf043e4b73a369e1af3d63052ef51ba8fee7fec3caa3efb416ad8b01833529248cd2b0134772836d46306408f7caf6465e7ae6d53c6f2b12e2e96a036fcae03b555f6c24080f7b3c692741d9f7dec624118a997d60850dbf6722b0bbfbf01d149771ea543282d6d9b2448a94caa75cf2a7d083260135075092859d3e801e689692c89b94ff6907fa4df50e623395d8043b00b64120c5dd8a1afd1abe59709c1c146f1a74399581e0d49ba24e77b689e6d405dd16594b141f0db33cb759de33aafdec5bab1524e01033f31830bcb5c454b208c08fbad03e166a950c2363cb48d8280a48b6dcf36c19c4a21f61dbe2843&state=dvsxg59galaoqq60w6so0emgvg1t0m", locationSearch: "?code=def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5830d96aa4f9836f26ef370c33748f4b4d538881e29f65f59c3b1e157ba9b1b94b0cc5b8cf7e56ac55878f9fd0a442ff96b9f06a4958a1e8f27fc86db797eb5868e1eec4cef06d02a175f073f8a90de380b2b1912e416bbdd3431c26cff8636add250718d7c4569bb52a0f6be6650e542430fece34c8889a9f19571460fe37d595e08cb764d77d5a9ee8b6a31bcf043e4b73a369e1af3d63052ef51ba8fee7fec3caa3efb416ad8b01833529248cd2b0134772836d46306408f7caf6465e7ae6d53c6f2b12e2e96a036fcae03b555f6c24080f7b3c692741d9f7dec624118a997d60850dbf6722b0bbfbf01d149771ea543282d6d9b2448a94caa75cf2a7d083260135075092859d3e801e689692c89b94ff6907fa4df50e623395d8043b00b64120c5dd8a1afd1abe59709c1c146f1a74399581e0d49ba24e77b689e6d405dd16594b141f0db33cb759de33aafdec5bab1524e01033f31830bcb5c454b208c08fbad03e166a950c2363cb48d8280a48b6dcf36c19c4a21f61dbe2843&state=dvsxg59galaoqq60w6so0emgvg1t0m", locationHash: "", windowSearch: "", windowHash: "#/auth/gta/callback?code=def50200d8b37879ce88f459a13db8874d21eda71ee4871ec5830d96aa4f9836f26ef370c33748f4b4d538881e29f65f59c3b1e157ba9b1b94b0cc5b8cf7e56ac55878f9fd0a442ff96b9f06a4958a1e8f27fc86db797eb5868e1eec4cef06d02a175f073f8a90de380b2b1912e416bbdd3431c26cff8636add250718d7c4569bb52a0f6be6650e542430fece34c8889a9f19571460fe37d595e08cb764d77d5a9ee8b6a31bcf043e4b73a369e1af3d63052ef51ba8fee7fec3caa3efb416ad8b01833529248cd2b0134772836d46306408f7caf6465e7ae6d53c6f2b12e2e96a036fcae03b555f6c24080f7b3c692741d9f7dec624118a997d60850dbf6722b0bbfbf01d149771ea543282d6d9b2448a94caa75cf2a7d083260135075092859d3e801e689692c89b94ff6907fa4df50e623395d8043b00b64120c5dd8a1afd1abe59709c1c146f1a74399581e0d49ba24e77b689e6d405dd16594b141f0db33cb759de33aafdec5bab1524e01033f31830bcb5c454b208c08fbad03e166a950c2363cb48d8280a48b6dcf36c19c4a21f61dbe2843&state=dvsxg59galaoqq60w6so0emgvg1t0m", searchParams: {…}, hashParams: {}, windowSearchParams: {}, windowHashParams: {…}, extractedCode: "def50200d8...", … }
console.ts:39:14
[Unified Callback] Processing OAuth code: def50200d8... console.ts:39:14
[GTA Auth] Processing OAuth callback console.ts:39:14
[GTA Auth] Duplicate callback detected, ignoring... console.ts:39:14
[GTA Auth] Inner token exchange error: FirebaseError: An internal error occurred during authentication console.ts:39:14
[GTA Auth] Token exchange failed: FirebaseError: An internal error occurred during authentication console.ts:39:14
[GTA Auth] Error details: 
Object { code: "functions/internal", message: "An internal error occurred during authentication", details: undefined, stack: "" }
console.ts:39:14
[GTA Auth] Token exchange completed: 
Object { success: false, hasToken: false, hasUser: false, errorCode: "functions/internal", originalRedirectUri: "https://gtaw-forms.github.io/forms/#/auth/gta/callback" }
console.ts:39:14
[GTA Auth] OAuth callback error: Error: Server configuration error. Please check that Firebase Functions are properly deployed and configured.
    f gtaWorldAuth.js:333
    h useGtaWorldAuth.js:156
    h useGtaWorldAuth.js:154
    hn UnifiedGtaCallback.js:154
    hn UnifiedGtaCallback.js:252
    React 3