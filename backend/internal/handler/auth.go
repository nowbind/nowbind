package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nowbind/nowbind/internal/config"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/model"
	"github.com/nowbind/nowbind/internal/repository"
	"github.com/nowbind/nowbind/internal/service"
)

type AuthHandler struct {
	auth     *service.AuthService
	cfg      *config.Config
	loginLog *repository.LoginLogRepository
	pool     *pgxpool.Pool
}

func NewAuthHandler(auth *service.AuthService, cfg *config.Config, loginLog *repository.LoginLogRepository, pool *pgxpool.Pool) *AuthHandler {
	return &AuthHandler{auth: auth, cfg: cfg, loginLog: loginLog, pool: pool}
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

	// Check if user is banned before sending email
	email := strings.ToLower(strings.TrimSpace(req.Email))
	var banned bool
	_ = h.pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM user_bans ub JOIN users u ON u.id = ub.user_id WHERE u.email = $1)`,
		email,
	).Scan(&banned)
	if banned {
		writeError(w, http.StatusForbidden, "account suspended")
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

	h.setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	h.logLogin(r, user.ID, "magic_link")
	writeJSON(w, http.StatusOK, user)
}

// --- Google OAuth ---

func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	if h.cfg.GoogleClientID == "" {
		writeError(w, http.StatusNotImplemented, "google login not configured")
		return
	}

	state, _ := generateOAuthState()
	secure := h.cfg.Environment == "production"
	// Store state in a short-lived cookie (on backend domain only, no Domain needed)
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   300, // 5 minutes
	})

	redirectURI := fmt.Sprintf("%s/api/v1/auth/oauth/google/callback", h.backendOrigin(r))
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

	redirectURI := fmt.Sprintf("%s/api/v1/auth/oauth/google/callback", h.backendOrigin(r))
	user, session, accessToken, err := h.auth.HandleGoogleCallback(
		r.Context(), code, h.cfg.GoogleClientID, h.cfg.GoogleClientSecret, redirectURI,
	)
	if err != nil {
		log.Printf("Google OAuth callback error: %v", err)
		http.Redirect(w, r, h.cfg.FrontendURL+"/login?error=oauth_failed", http.StatusTemporaryRedirect)
		return
	}

	h.setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	h.logLogin(r, user.ID, "google")
	http.Redirect(w, r, h.cfg.FrontendURL+"/dashboard", http.StatusTemporaryRedirect)
}

// --- GitHub OAuth ---

func (h *AuthHandler) GitHubLogin(w http.ResponseWriter, r *http.Request) {
	if h.cfg.GitHubClientID == "" {
		writeError(w, http.StatusNotImplemented, "github login not configured")
		return
	}

	state, _ := generateOAuthState()
	secure := h.cfg.Environment == "production"
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
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

	h.setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	h.logLogin(r, user.ID, "github")
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
		h.clearAuthCookies(w)
		writeError(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	h.setAuthCookies(w, accessToken, session.RefreshToken, session.ExpiresAt)
	h.logLogin(r, user.ID, "refresh")
	writeJSON(w, http.StatusOK, user)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if refreshToken, err := r.Cookie("refresh_token"); err == nil {
		h.auth.Logout(r.Context(), refreshToken.Value)
	}
	h.clearAuthCookies(w)
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

	// Include email only for the authenticated user's own profile
	resp := struct {
		*model.User
		Email string `json:"email"`
	}{User: user, Email: user.Email}

	writeJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) setAuthCookies(w http.ResponseWriter, accessToken, refreshToken string, refreshExpiry time.Time) {
	secure := h.cfg.Environment == "production"
	sameSite := http.SameSiteLaxMode
	if h.cfg.CookieDomain != "" {
		// Cross-subdomain: need SameSite=None with Secure
		sameSite = http.SameSiteNoneMode
		secure = true
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   900, // 15 minutes
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   int(time.Until(refreshExpiry).Seconds()),
	})
}

func (h *AuthHandler) clearAuthCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:   "access_token",
		Value:  "",
		Path:   "/",
		Domain: h.cfg.CookieDomain,
		MaxAge: -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:   "refresh_token",
		Value:  "",
		Path:   "/",
		Domain: h.cfg.CookieDomain,
		MaxAge: -1,
	})
}

func (h *AuthHandler) logLogin(r *http.Request, userID, method string) {
	ip := stripPort(r.RemoteAddr)
	if fwd := r.Header.Get("X-Real-Ip"); fwd != "" {
		ip = stripPort(fwd)
	}
	ua := r.Header.Get("User-Agent")
	go h.loginLog.Log(context.Background(), userID, ip, ua, method)
}

func stripPort(addr string) string {
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return host
	}
	return addr
}

func generateOAuthState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// backendOrigin returns the public origin of this backend server (e.g. "https://nowbindb.niheshr.com")
func (h *AuthHandler) backendOrigin(r *http.Request) string {
	scheme := "http"
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if h.cfg.Environment == "production" {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s", scheme, r.Host)
}
