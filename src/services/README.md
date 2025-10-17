# GTA World Authentication System

This directory contains the unified GTA World OAuth authentication system for the PHMC Forms application.

## Architecture

### Core Components

1. **`services/gtaWorldAuth.js`** - Main authentication service
   - Handles OAuth flow initiation
   - Processes callbacks and token exchange
   - Manages session state and tokens
   - Provides API request functionality

2. **`hooks/useGtaWorldAuth.js`** - React hook
   - Provides React components with authentication state
   - Handles authentication actions
   - Manages loading and error states

3. **`components/Auth/UnifiedGtaCallback.js`** - Unified callback handler
   - Handles all OAuth callback scenarios
   - Supports both admin login and token exchange testing
   - Provides user feedback during authentication

4. **`components/Auth/GtaWorldLoginButton.js`** - Reusable login button
   - Can be used anywhere in the app
   - Customizable appearance and behavior

## Usage

### Basic Login Button
```jsx
import GtaWorldLoginButton from './components/Auth/GtaWorldLoginButton';

<GtaWorldLoginButton 
    returnPath="#/admin"
    onError={(error) => console.error(error)}
/>
```

### Using the Authentication Hook
```jsx
import useGtaWorldAuth from './hooks/useGtaWorldAuth';

function MyComponent() {
    const { 
        user, 
        isAuthenticated, 
        login, 
        logout, 
        apiRequest 
    } = useGtaWorldAuth();

    if (isAuthenticated) {
        return <div>Welcome, {user.username}!</div>;
    }

    return <button onClick={() => login()}>Login</button>;
}
```

### Making Authenticated API Requests
```jsx
const { apiRequest } = useGtaWorldAuth();

const fetchUserData = async () => {
    try {
        const userData = await apiRequest('/user');
        console.log(userData);
    } catch (error) {
        console.error('API request failed:', error);
    }
};
```

## Configuration

The system uses the following environment variables:
- `REACT_APP_GTAWORLD_CLIENT_ID` - GTA World OAuth Client ID

## Security Features

- **CSRF Protection**: Uses state parameter to prevent CSRF attacks
- **Secure Token Storage**: Tokens stored in sessionStorage (cleared on browser close)
- **Error Handling**: Comprehensive error handling with Sentry integration  
- **Session Validation**: Automatic session validation and cleanup

## Migration from Old System

The new system replaces the following old components:
- `components/Auth/GtaCallback.js` → `components/Auth/UnifiedGtaCallback.js`
- `components/Auth/GtaWorldCallback.js` → Integrated into unified callback
- `components/Admin/OAuthTokenExchangeModal.js` → Still available for legacy testing
- Multiple scattered OAuth implementations → Single service

## Firebase Function

The system continues to use the existing Firebase function:
- `functions/index.js` - `exchangeAuthCodeForToken` function
- Handles server-side token exchange for security
- Returns both access tokens and user data

## Routing

Update your router to use the new callback:
```jsx
<Route path="/auth/gta/callback" element={<UnifiedGtaCallback />} />
```

## Error Handling

The system provides comprehensive error handling:
- Network errors
- OAuth errors (invalid_request, access_denied, etc.)
- Token exchange failures
- Session validation errors

All errors are logged to Sentry with appropriate context.