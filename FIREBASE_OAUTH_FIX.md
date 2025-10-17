# Firebase OAuth Error Investigation & Fix

## Issue Analysis

Based on the error logs showing `FirebaseError: internal`, the most likely cause was a **Firebase Functions region mismatch**.

### The Problem
- **Server-side**: Firebase Functions are deployed to `us-central1` region (as specified in functions/index.js)
- **Client-side**: The Firebase Functions client was not specifying a region, defaulting to `us-central1` but potentially causing connectivity issues

### Error Pattern
```
[GTA Auth] Token exchange failed: FirebaseError: internal
[GTA Auth] OAuth callback error: Error: An internal error occurred. Please try again or contact support.
```

This pattern typically indicates:
1. Firebase Functions region mismatch
2. Function deployment issues
3. Missing environment variables
4. Network connectivity problems

## Fixes Applied

### 1. Fixed Firebase Functions Region Configuration
**File**: `src/firebase.js`
```javascript
// Before
const functions = getFunctions(app);

// After  
const functions = getFunctions(app, 'us-central1');
```

### 2. Enhanced Error Handling
**File**: `src/services/gtaWorldAuth.js`
- Added specific handling for Firebase Functions errors (`functions/internal`, `functions/not-found`, etc.)
- Improved error messages with actionable suggestions
- Added detailed debugging information

### 3. Added Comprehensive Diagnostics
**File**: `src/services/firebaseDebug.js`
- Firebase Functions connectivity testing
- Configuration validation
- Environment checking
- Session storage testing

### 4. Enhanced Admin Dashboard
**File**: `src/components/Admin/AdminDashboard.js`
- Added Firebase Functions testing buttons
- Integrated diagnostic tools
- Real-time error reporting

## Testing the Fix

### Manual Testing
1. Open Admin Panel → Developer Tools section
2. Click "Test Firebase Functions" to check connectivity
3. Click "Run Full Diagnostics" for comprehensive testing
4. Check browser console for detailed logs

### Expected Results After Fix
- Firebase Functions test should return success or specific error codes
- OAuth login should work without "internal" errors
- Better error messages for any remaining issues

## Additional Diagnostics

### Environment Variables Check
Ensure these are set:
- `REACT_APP_GTAWORLD_CLIENT_ID`: Your GTA World OAuth client ID
- `REACT_APP_FIREBASE_PROJECT_ID`: Your Firebase project ID
- `REACT_APP_FIREBASE_API_KEY`: Your Firebase API key

### Firebase Functions Deployment
Verify the function is deployed:
```bash
cd functions
firebase deploy --only functions:exchangeAuthCodeForToken
```

### Function Logs
Check Firebase Functions logs:
```bash
firebase functions:log --only exchangeAuthCodeForToken
```

## Error Code Reference

The enhanced system now provides specific error codes:

- `functions/internal`: Server configuration or deployment issue
- `functions/not-found`: Function not deployed or wrong name
- `functions/unauthenticated`: Authentication required
- `functions/permission-denied`: Permission issues
- `functions/unavailable`: Service temporarily unavailable
- `invalid-argument`: Missing or invalid parameters
- `token-exchange-failed`: GTA World OAuth server issues
- `network-error`: Connectivity problems

## Next Steps

1. **Test the fix**: Try the OAuth login again
2. **Use diagnostics**: Run the diagnostic tools if issues persist
3. **Check logs**: Monitor both client and server logs
4. **Verify deployment**: Ensure Firebase Functions are properly deployed

## Prevention

To prevent similar issues in the future:
- Always specify Firebase Functions region explicitly
- Use the diagnostic tools before major deployments
- Monitor Firebase Functions logs regularly
- Keep error handling comprehensive and user-friendly