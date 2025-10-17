# Firebase Function Updates for Unified GTA World Authentication

## Overview
The Firebase function `exchangeAuthCodeForToken` has been thoroughly reviewed and enhanced to work optimally with the new unified GTA World authentication system.

## Key Improvements Made

### 1. Enhanced Security
- **Redirect URI Validation**: Added strict validation against allowed redirect URIs
- **Client ID Verification**: Validates that provided client ID matches configured one
- **Origin Validation**: Enhanced CORS configuration with explicit allowed origins

### 2. Better Error Handling
- **Specific Error Types**: More granular error codes for different failure scenarios
- **User-Friendly Messages**: Clear, actionable error messages for end users
- **Enhanced Logging**: Detailed logging for debugging and monitoring

### 3. Improved Response Structure
- **Success Flag**: Clear indication of successful authentication
- **Enhanced Token Data**: Complete token information including expiry and type
- **Timestamp**: Authentication timestamp for session management
- **Flexible User Data**: Handles different GTA World API response formats

### 4. Modern Firebase v2 Features
- **Built-in CORS**: Removed external cors dependency, using Firebase v2 CORS
- **Secrets Management**: Proper handling of OAuth client credentials
- **Request Validation**: Enhanced request method and data validation

## Updated Error Codes

The function now returns specific error codes that the client can handle appropriately:

- `invalid-argument`: Missing required parameters
- `invalid-client`: Client ID mismatch or configuration error
- `invalid-redirect-uri`: Redirect URI not in allowed list
- `token-exchange-failed`: GTA World token exchange failed
- `user-profile-failed`: Failed to fetch user profile
- `network-error`: Connection issues with GTA World servers
- `timeout`: Request timeout
- `internal`: General server errors

## Response Format

### Success Response
```json
{
  "success": true,
  "token": {
    "access_token": "...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "...",
    "scope": "..."
  },
  "user": {
    "id": 12345,
    "username": "user123",
    // ... other user fields
  },
  "timestamp": "2025-10-17T12:34:56.789Z"
}
```

### Error Response
```json
{
  "error": "token-exchange-failed",
  "message": "Failed to exchange authorization code. The code may have expired.",
  "details": { /* GTA World error details */ }
}
```

## Security Enhancements

### Allowed Redirect URIs
The function now validates against these specific redirect URIs:
- `https://ancad-studios.github.io/phmc-forms/#/auth/gta/callback`
- `https://gtaw-forms.github.io/forms/#/auth/gta/callback`
- `http://localhost:3000/#/auth/gta/callback`
- `https://phmc-tools.gta.world/#/auth/gta/callback`

### CORS Configuration
Enhanced CORS settings allow requests from:
- `https://ancad-studios.github.io`
- `http://localhost:3000`
- `https://gtaw-forms.github.io`
- `https://phmc-tools.gta.world`

## Client-Side Integration

The unified authentication service (`gtaWorldAuth.js`) has been updated to:
- Handle the enhanced response format
- Provide user-friendly error messages
- Store additional token metadata
- Support enhanced session validation

## Environment Variables Required

Ensure these secrets are configured in Firebase Functions:
- `GTAWORLD_CLIENT_ID`: OAuth client ID from GTA World
- `GTAWORLD_CLIENT_SECRET`: OAuth client secret from GTA World

## Testing

The enhanced function supports both:
1. **Direct Authentication**: For actual user login
2. **Token Exchange Testing**: For admin OAuth modal testing

The function automatically detects the usage pattern and responds appropriately.

## Deployment

After updating the function:
1. Remove old cors dependency: `npm uninstall cors` (in functions directory)
2. Deploy the updated function: `firebase deploy --only functions`
3. Verify secrets are properly configured in Firebase Console

## Backward Compatibility

The function maintains backward compatibility with:
- Existing httpsCallable usage
- Direct HTTP POST requests
- Legacy response parsing (while providing enhanced data)

## Monitoring

Enhanced logging provides better visibility into:
- Authentication request patterns
- Error frequencies and types
- Performance metrics
- Security events

All logs use the `[OAuth]` prefix for easy filtering and monitoring.