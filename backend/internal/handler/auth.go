package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/nowbind/nowbind/internal/config"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
	cfg  *config.Config
}

func NewAuthHandler(auth *service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{auth: auth, cfg: cfg}
}

type magicLinkRequest struct {
	Email string `json:"email"`
}

func (h *AuthHandler) SendMagicLink(w http.ResponseWriter, r *http.Request) {
	var req magicLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	token, err := h.auth.SendMagicLink(r.Context(), req.Email, h.cfg.FrontendURL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to send magic link")
		return
	}

	resp := map[string]string{"message": "magic link sent"}
	if h.cfg.Environment == "development" {
		resp["token"] = token // Only expose in dev for testing
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) VerifyMagicLink(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		writeError(w, http.StatusBadRequest, "token is required")
		return
	}

	user, session, accessToken, err := h.auth.VerifyMagicLink(r.Context(), token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired magic link")
		return
	}

	setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	writeJSON(w, http.StatusOK, user)
}

// --- Google OAuth ---

func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	if h.cfg.GoogleClientID == "" {
		writeError(w, http.StatusNotImplemented, "google login not configured")
		return
	}

	state, _ := generateOAuthState()
	// Store state in a short-lived cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   300, // 5 minutes
	})

	redirectURI := fmt.Sprintf("%s/api/v1/auth/oauth/google/callback", h.cfg.FrontendURL)
	authURL := fmt.Sprintf(
		"https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=openid%%20email%%20profile&state=%s&access_type=offline&prompt=consent",
		url.QueryEscape(h.cfg.GoogleClientID),
		url.QueryEscape(redirectURI),
		url.QueryEscape(state),
	)

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	// Verify state
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=invalid_state", http.StatusTemporaryRedirect)
		return
	}
	// Clear state cookie
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", MaxAge: -1})

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=no_code", http.StatusTemporaryRedirect)
		return
	}

	redirectURI := fmt.Sprintf("%s/api/v1/auth/oauth/google/callback", h.cfg.FrontendURL)
	user, session, accessToken, err := h.auth.HandleGoogleCallback(
		r.Context(), code, h.cfg.GoogleClientID, h.cfg.GoogleClientSecret, redirectURI,
	)
	if err != nil {
		log.Printf("Google OAuth callback error: %v", err)
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=oauth_failed", http.StatusTemporaryRedirect)
		return
	}

	_ = user
	setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	http.Redirect(w, r, h.cfg.FrontendURL+"/dashboard", http.StatusTemporaryRedirect)
}

// --- GitHub OAuth ---

func (h *AuthHandler) GitHubLogin(w http.ResponseWriter, r *http.Request) {
	if h.cfg.GitHubClientID == "" {
		writeError(w, http.StatusNotImplemented, "github login not configured")
		return
	}

	state, _ := generateOAuthState()
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   300,
	})

	authURL := fmt.Sprintf(
		"https://github.com/login/oauth/authorize?client_id=%s&scope=read:user%%20user:email&state=%s",
		url.QueryEscape(h.cfg.GitHubClientID),
		url.QueryEscape(state),
	)

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) GitHubCallback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=invalid_state", http.StatusTemporaryRedirect)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", Value: "", Path: "/", MaxAge: -1})

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=no_code", http.StatusTemporaryRedirect)
		return
	}

	user, session, accessToken, err := h.auth.HandleGitHubCallback(
		r.Context(), code, h.cfg.GitHubClientID, h.cfg.GitHubClientSecret,
	)
	if err != nil {
		log.Printf("GitHub OAuth callback error: %v", err)
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=oauth_failed", http.StatusTemporaryRedirect)
		return
	}

	_ = user
	setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	http.Redirect(w, r, h.cfg.FrontendURL+"/dashboard", http.StatusTemporaryRedirect)
}

// --- Common auth methods ---

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	refreshToken, err := r.Cookie("refresh_token")
	if err != nil {
		writeError(w, http.StatusUnauthorized, "no refresh token")
		return
	}

	user, session, accessToken, err := h.auth.Refresh(r.Context(), refreshToken.Value)
	if err != nil {
		clearAuthCookies(w)
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if refreshToken, err := r.Cookie("refresh_token"); err == nil {
		h.auth.Logout(r.Context(), refreshToken.Value)
	}
	clearAuthCookies(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := h.auth.GetUser(r.Context(), userID)
	if err != nil || user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func setAuthCookies(w http.ResponseWriter, accessToken, refreshToken string, refreshExpiry time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in production
		SameSite: http.SameSiteLaxMode,
		MaxAge:   900, // 15 minutes
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/api/v1/auth",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(time.Until(refreshExpiry).Seconds()),
	})
}

func clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:   "access_token",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:   "refresh_token",
		Value:  "",
		Path:   "/api/v1/auth",
		MaxAge: -1,
	})
}

func generateOAuthState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
