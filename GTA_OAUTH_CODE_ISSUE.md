# GTA World OAuth Authorization Code Issue

## Problem Identified

The issue is **NOT** with Firebase Functions or client ID validation. The error is coming from **GTA World's OAuth server**:

```
"Cannot decrypt the authorization code"
```

This is a **GTA World server-side error** that occurs when they can't validate/decrypt the authorization code being sent to their token endpoint.

## Root Causes

### 1. **Authorization Code Expiration**
- OAuth authorization codes typically expire in 60 seconds or less
- If there's any delay between redirect and token exchange, the code becomes invalid

### 2. **Redirect URI Mismatch** 
- GTA World validates that the `redirect_uri` in the token exchange **exactly matches** the one used in authorization
- Even small differences (like trailing slashes, http vs https, etc.) cause rejection

### 3. **URL Parameter Handling**
- GTA World might be sending parameters as query parameters (`?code=...`)
- But your hash-based routing might be expecting them in hash fragments (`#/callback?code=...`)

### 4. **Code Reuse**
- Authorization codes are single-use only
- If the code was already used (due to duplicate requests), it becomes invalid

## Enhanced Debugging Added

### Client-Side Logging
- ✅ URL parameter extraction from both search and hash
- ✅ OAuth timing information (code age tracking)
- ✅ Redirect URI validation logging
- ✅ Token exchange result details

### Server-Side Logging  
- ✅ Enhanced client ID comparison debugging
- ✅ Request parameter validation
- ✅ GTA World API response details

## Next Testing Steps

1. **Try OAuth flow again** with enhanced logging
2. **Check console for timing info** - look for "codeAge" in logs
3. **Verify URL parameters** - see if code is in search vs hash
4. **Monitor request speed** - ensure token exchange happens quickly after redirect

## Potential Solutions

### If Code Expiration:
- Optimize callback processing speed
- Add retry logic with exponential backoff

### If URL Parameter Issues:
- Update callback component to check both search and hash parameters ✅ (Done)
- Consider updating GTA World OAuth app redirect URI

### If Redirect URI Issues:
- Ensure exact match between authorization and token exchange
- Check for trailing slashes, protocol differences

## Test Commands

```javascript
// In browser console during callback:
console.log('URL Debug:', {
  href: window.location.href,
  search: window.location.search, 
  hash: window.location.hash,
  searchParams: Object.fromEntries(new URLSearchParams(window.location.search)),
  hashParams: Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || ''))
});
```

The enhanced logging should now show exactly where the issue is occurring!