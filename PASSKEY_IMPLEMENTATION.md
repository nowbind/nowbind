# Passkey Authentication Implementation

## Overview

This document describes the complete implementation of passkey (WebAuthn/FIDO2) authentication for NowBind.

## What Was Implemented

### Backend (Go)

1. **Database Migration** (`014_passkeys.sql`)
   - `passkey_credentials` table: stores user credentials (credential ID, public key, sign count, device name)
   - `passkey_challenges` table: temporary storage for registration/authentication challenges

2. **Models** (`internal/model/models.go`)
   - `PasskeyCredential`: represents a stored passkey
   - `PasskeyChallenge`: represents a temporary challenge

3. **Repository** (`internal/repository/passkey.go`)
   - CRUD operations for credentials and challenges
   - Automatic cleanup of expired challenges

4. **Service** (`internal/service/passkey.go`)
   - WebAuthn initialization with configurable RP ID, name, and origin
   - Registration flow: begin → finish
   - Authentication flow: begin → finish
   - Credential management (list, delete)

5. **Handler** (`internal/handler/passkey.go`)
   - HTTP endpoints for all passkey operations
   - Proper error handling and response formatting

6. **Router Integration** (`internal/router/router.go`)
   - Registered all passkey endpoints
   - Applied appropriate middleware (auth for registration, public for login)

7. **Configuration** (`internal/config/config.go`)
   - Added `PASSKEY_RP_ID`, `PASSKEY_RP_NAME`, `PASSKEY_RP_ORIGIN` environment variables

### Frontend (Next.js/React)

1. **Utility Functions** (`lib/passkey.ts`)
   - Browser WebAuthn API support detection
   - Base64URL encoding/decoding for credential data
   - Credential/assertion serialization

2. **API Client** (`lib/api.ts`)
   - Added `passkeyApi` methods for all backend endpoints

3. **React Hook** (`lib/hooks/use-passkey.ts`)
   - `usePasskey()` hook with `register()` and `login()` methods
   - Loading states and error handling
   - Browser compatibility checks

4. **Components**
   - `PasskeyLoginButton`: reusable button for login page
   - Settings page integration: manage passkeys (add, list, delete)

5. **Login Page** (`app/(auth)/login/page.tsx`)
   - Added passkey login button alongside OAuth options

## API Endpoints

### Registration (Authenticated)
- `POST /api/v1/auth/passkey/register/begin` - Start registration, get challenge
- `POST /api/v1/auth/passkey/register/finish` - Complete registration with credential

### Authentication (Public)
- `POST /api/v1/auth/passkey/login/begin` - Start login, get challenge
- `POST /api/v1/auth/passkey/login/finish` - Complete login with assertion

### Management (Authenticated)
- `GET /api/v1/auth/passkey/credentials` - List user's passkeys
- `DELETE /api/v1/auth/passkey/credentials/{id}` - Remove a passkey

## User Flows

### First-Time Registration
1. User logs in with existing method (OAuth, magic link)
2. Goes to Settings page
3. Clicks "Add Passkey"
4. Enters device name (e.g., "iPhone 15")
5. Browser prompts for biometric/PIN
6. Passkey is registered and listed

### Login with Passkey
1. User visits login page
2. Clicks "Sign in with Passkey"
3. Browser shows passkey selector (if multiple)
4. User authenticates with biometric/PIN
5. Logged in with JWT tokens

## Security Features

✅ **Phishing-resistant**: Credentials are domain-bound
✅ **No password storage**: Biometric data never leaves device
✅ **FIDO2 certified**: Uses standard WebAuthn protocol
✅ **Challenge-response**: Prevents replay attacks
✅ **Sign counter**: Detects cloned authenticators
✅ **HTTPS required**: Enforced in production

## Configuration

### Backend `.env`
```env
PASSKEY_RP_ID=localhost                    # Your domain (production: yourdomain.com)
PASSKEY_RP_NAME=NowBind                    # Display name
PASSKEY_RP_ORIGIN=http://localhost:3000    # Full origin URL (production: https://yourdomain.com)
```

### Production Deployment
For production, update:
- `PASSKEY_RP_ID=yourdomain.com`
- `PASSKEY_RP_ORIGIN=https://yourdomain.com`

## Browser Support

- ✅ Chrome/Edge 67+
- ✅ Firefox 60+
- ✅ Safari 13+
- ✅ iOS Safari 14+
- ✅ Android Chrome 70+

## Testing

1. **Local Development**
   ```bash
   cd backend
   go mod tidy
   go run cmd/server/main.go -migrate
   go run cmd/server/main.go
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Test Flow**
   - Register with magic link or OAuth
   - Go to Settings → Add Passkey
   - Logout
   - Login with passkey

## Files Created/Modified

### Backend
- ✅ `internal/database/migrations/014_passkeys.sql`
- ✅ `internal/model/models.go` (modified)
- ✅ `internal/repository/passkey.go`
- ✅ `internal/service/passkey.go`
- ✅ `internal/handler/passkey.go`
- ✅ `internal/config/config.go` (modified)
- ✅ `internal/router/router.go` (modified)
- ✅ `go.mod` (modified)
- ✅ `.env.example` (modified)

### Frontend
- ✅ `lib/passkey.ts`
- ✅ `lib/api.ts` (modified)
- ✅ `lib/hooks/use-passkey.ts`
- ✅ `components/auth/passkey-login-button.tsx`
- ✅ `app/(auth)/login/page.tsx` (modified)
- ✅ `app/(dashboard)/settings/page.tsx` (modified)

### Documentation
- ✅ `README.md` (modified)
- ✅ `PASSKEY_IMPLEMENTATION.md` (this file)

## Next Steps

1. Run migrations: `go run cmd/server/main.go -migrate`
2. Start backend: `go run cmd/server/main.go`
3. Start frontend: `npm run dev`
4. Test passkey registration and login
5. Deploy to production with proper HTTPS and domain configuration

## Troubleshooting

**Issue**: "Passkeys not supported"
- **Solution**: Ensure HTTPS in production, use modern browser

**Issue**: "Registration failed"
- **Solution**: Check browser console, verify RP ID matches domain

**Issue**: "Challenge expired"
- **Solution**: Challenges expire after 5 minutes, try again

**Issue**: "Credential not found"
- **Solution**: User may have deleted passkey from device settings

## Additional Resources

- [WebAuthn Guide](https://webauthn.guide/)
- [FIDO Alliance](https://fidoalliance.org/)
- [go-webauthn Documentation](https://github.com/go-webauthn/webauthn)
- [Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
