# Firebase Function Type Mismatch Fix

## Problem Identified

The `functions/invalid-argument` error was caused by **Firebase Function type mismatch**:

### Root Cause
- **Client-side**: Code was calling `httpsCallable()` which expects an `onCall` function
- **Server-side**: Function was using `onRequest` which expects HTTP request/response format
- **Result**: Parameter mismatch causing `invalid-argument` errors

### Evidence
```
[OAuth] Missing authorization code parameter
functions/invalid-argument: Authorization code is required
```

This indicated the function couldn't find the `code` parameter because it was looking in the wrong place.

## Fix Applied

### 1. Converted Firebase Function Type
**Before:**
```javascript
import { onRequest } from "firebase-functions/v2/https";

export const exchangeAuthCodeForToken = onRequest({ ... }, async (req, res) => {
    const data = req.body.data || req.body;
    // ... handle res.status().json() responses
});
```

**After:**
```javascript
import { onCall } from "firebase-functions/v2/https";
import * as functions from "firebase-functions";

export const exchangeAuthCodeForToken = onCall({ ... }, async (request) => {
    const data = request.data;
    // ... throw HttpsError exceptions and return data directly
});
```

### 2. Updated Error Handling
**Before:**
```javascript
res.status(400).json({ error: 'invalid-argument', message: '...' });
```

**After:**
```javascript
throw new functions.https.HttpsError('invalid-argument', '...');
```

### 3. Updated Response Format
**Before:**
```javascript
res.status(200).json({ success: true, ... });
```

**After:**
```javascript
return { success: true, ... };
```

## Function Type Comparison

| Aspect | onRequest | onCall |
|--------|-----------|--------|
| **Client Call** | `fetch()` or HTTP request | `httpsCallable()` |
| **Parameters** | `req.body` | `request.data` |
| **Response** | `res.status().json()` | `return` or `throw` |
| **Errors** | HTTP status codes | `HttpsError` exceptions |
| **Auth Context** | Manual from headers | `request.auth` |

## Expected Resolution

After this fix:
- ✅ `httpsCallable()` properly communicates with `onCall` function
- ✅ Parameters are passed correctly in `request.data`
- ✅ Errors are properly typed as Firebase Function errors
- ✅ Responses are returned directly (not wrapped in HTTP responses)

## Testing Steps

1. **Deploy the updated function** to Firebase
2. **Clear browser cache** to reload the application
3. **Try OAuth login** - should now pass parameter validation
4. **Check console logs** for successful token exchange

The `functions/invalid-argument` error should now be resolved with proper function type alignment!