package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/service"
)

type PasskeyHandler struct {
	passkey *service.PasskeyService
}

func NewPasskeyHandler(passkey *service.PasskeyService) *PasskeyHandler {
	return &PasskeyHandler{passkey: passkey}
}

type beginRegistrationRequest struct {
	Name string `json:"name"`
}

func (h *PasskeyHandler) BeginRegistration(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req beginRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Name == "" {
		req.Name = "Passkey"
	}

	options, err := h.passkey.BeginRegistration(r.Context(), userID, req.Name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to begin registration")
		return
	}

	writeJSON(w, http.StatusOK, options)
}

type finishRegistrationRequest struct {
	Name       string          `json:"name"`
	Credential json.RawMessage `json:"credential"`
}

func (h *PasskeyHandler) FinishRegistration(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req finishRegistrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	if req.Name == "" {
		req.Name = "Passkey"
	}

	if err := h.passkey.FinishRegistration(r.Context(), userID, req.Name, req.Credential); err != nil {
		writeError(w, http.StatusBadRequest, "failed to register passkey: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "passkey registered successfully"})
}

type beginLoginRequest struct {
	Email string `json:"email"`
}

func (h *PasskeyHandler) BeginLogin(w http.ResponseWriter, r *http.Request) {
	var req beginLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Email = ""
	}

	options, err := h.passkey.BeginLogin(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to begin login")
		return
	}

	writeJSON(w, http.StatusOK, options)
}

type finishLoginRequest struct {
	Assertion json.RawMessage `json:"assertion"`
}

func (h *PasskeyHandler) FinishLogin(w http.ResponseWriter, r *http.Request) {
	var req finishLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, session, accessToken, err := h.passkey.FinishLogin(r.Context(), req.Assertion)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication failed: "+err.Error())
		return
	}

	// Set auth cookies (reuse logic from AuthHandler)
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.URL.Scheme == "https",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   900,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    session.RefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   r.URL.Scheme == "https",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(session.ExpiresAt.Sub(session.CreatedAt).Seconds()),
	})

	writeJSON(w, http.StatusOK, user)
}

func (h *PasskeyHandler) ListCredentials(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	credentials, err := h.passkey.ListCredentials(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list credentials")
		return
	}

	writeJSON(w, http.StatusOK, credentials)
}

func (h *PasskeyHandler) DeleteCredential(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	credentialID := chi.URLParam(r, "id")
	if credentialID == "" {
		writeError(w, http.StatusBadRequest, "credential id required")
		return
	}

	if err := h.passkey.DeleteCredential(r.Context(), credentialID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete credential")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
