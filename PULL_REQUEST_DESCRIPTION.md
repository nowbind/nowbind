# Add Passkey (WebAuthn/FIDO2) Authentication

## 🎯 Overview

This PR implements complete passkey authentication support for NowBind, enabling users to sign in securely using biometrics (Face ID, Touch ID, Windows Hello) or hardware security keys.

## ✨ Features

### Backend
- ✅ WebAuthn/FIDO2 protocol implementation using `go-webauthn/webauthn`
- ✅ Passkey registration and authentication flows
- ✅ Credential management (list, delete)
- ✅ Challenge-based security with 5-minute expiration
- ✅ Sign counter tracking to detect cloned authenticators
- ✅ Database migrations for credential storage

### Frontend
- ✅ Browser WebAuthn API integration
- ✅ Passkey login button on login page
- ✅ Passkey management UI in settings
- ✅ React hook for easy passkey operations
- ✅ Browser compatibility detection
- ✅ Loading states and error handling

## 🔐 Security

- **Phishing-resistant**: Credentials are domain-bound
- **No password storage**: Biometric data never leaves the device
- **FIDO2 certified**: Uses standard WebAuthn protocol
- **Challenge-response**: Prevents replay attacks
- **HTTPS enforced**: Required in production

## 📋 API Endpoints

### Registration (Authenticated)
- `POST /api/v1/auth/passkey/register/begin` - Start registration
- `POST /api/v1/auth/passkey/register/finish` - Complete registration

### Authentication (Public)
- `POST /api/v1/auth/passkey/login/begin` - Start login
- `POST /api/v1/auth/passkey/login/finish` - Complete login

### Management (Authenticated)
- `GET /api/v1/auth/passkey/credentials` - List user's passkeys
- `DELETE /api/v1/auth/passkey/credentials/{id}` - Remove passkey

## 🗄️ Database Changes

**Migration**: `014_passkeys.sql`

### Tables
- `passkey_credentials` - Stores user credentials (credential ID, public key, sign count, device name, transports)
- `passkey_challenges` - Temporary challenge storage with automatic expiration

## 🔧 Configuration

### Backend `.env`
```env
PASSKEY_RP_ID=localhost                    # Domain (production: yourdomain.com)
PASSKEY_RP_NAME=NowBind                    # Display name
PASSKEY_RP_ORIGIN=http://localhost:3000    # Origin URL (production: https://yourdomain.com)
```

## 📦 Dependencies

### Backend
- `github.com/go-webauthn/webauthn v0.11.2` - WebAuthn library
- `github.com/lib/pq v1.10.9` - PostgreSQL array support

### Frontend
- Uses native browser WebAuthn API (no additional dependencies)

## 🎨 UI/UX

### Login Page
- Passkey button appears at the top of auth options
- Only shown if browser supports WebAuthn
- One-click authentication flow

### Settings Page
- New "Passkeys" section
- Add passkey with custom device name
- List all registered passkeys with creation/last used dates
- Delete individual passkeys

## 🧪 Testing

### Manual Testing Steps
1. Start backend: `go run cmd/server/main.go -migrate && go run cmd/server/main.go`
2. Start frontend: `npm run dev`
3. Register with existing method (OAuth/magic link)
4. Go to Settings → Add Passkey
5. Enter device name and authenticate
6. Logout and sign in with passkey

### Browser Support
- ✅ Chrome/Edge 67+
- ✅ Firefox 60+
- ✅ Safari 13+
- ✅ iOS Safari 14+
- ✅ Android Chrome 70+

## 📁 Files Changed

### Backend
- `internal/database/migrations/014_passkeys.sql` ⭐ NEW
- `internal/model/models.go` ✏️ MODIFIED
- `internal/repository/passkey.go` ⭐ NEW
- `internal/service/passkey.go` ⭐ NEW
- `internal/handler/passkey.go` ⭐ NEW
- `internal/config/config.go` ✏️ MODIFIED
- `internal/router/router.go` ✏️ MODIFIED
- `go.mod` ✏️ MODIFIED
- `.env.example` ✏️ MODIFIED

### Frontend
- `lib/passkey.ts` ⭐ NEW
- `lib/api.ts` ✏️ MODIFIED
- `lib/hooks/use-passkey.ts` ⭐ NEW
- `components/auth/passkey-login-button.tsx` ⭐ NEW
- `app/(auth)/login/page.tsx` ✏️ MODIFIED
- `app/(dashboard)/settings/page.tsx` ✏️ MODIFIED

### Documentation
- `README.md` ✏️ MODIFIED
- `PASSKEY_IMPLEMENTATION.md` ⭐ NEW

### Bug Fixes
- `app/(main)/search/page.tsx` ✏️ MODIFIED - Fixed skeleton height issue

## 🚀 Deployment Notes

### Production Checklist
- [ ] Set `PASSKEY_RP_ID` to your domain (e.g., `nowbind.com`)
- [ ] Set `PASSKEY_RP_ORIGIN` to your HTTPS URL (e.g., `https://nowbind.com`)
- [ ] Ensure HTTPS is enabled (required for WebAuthn)
- [ ] Run database migration: `go run cmd/server/main.go -migrate`

## 📸 Screenshots

### Login Page
Passkey button appears at the top of authentication options.

### Settings Page
Users can manage their passkeys with device names and usage information.

## 🔄 Migration Path

Existing users can:
1. Continue using current auth methods (OAuth, magic links)
2. Add passkeys from Settings page
3. Use passkeys for future logins

No breaking changes to existing authentication flows.

## 📚 Additional Resources

- [WebAuthn Guide](https://webauthn.guide/)
- [FIDO Alliance](https://fidoalliance.org/)
- [go-webauthn Documentation](https://github.com/go-webauthn/webauthn)
- [Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)

## ✅ Checklist

- [x] Backend implementation complete
- [x] Frontend implementation complete
- [x] Database migrations created
- [x] Configuration documented
- [x] README updated
- [x] Implementation guide created
- [x] Manual testing completed
- [x] Browser compatibility verified
- [x] Security best practices followed
- [x] No breaking changes

## 🎉 Result

Users can now sign in to NowBind using modern, secure passkey authentication with biometrics or security keys, providing a passwordless experience that's both more secure and more convenient than traditional passwords.

---

**Closes**: #[issue-number] (if applicable)
**Type**: Feature
**Breaking Changes**: None
