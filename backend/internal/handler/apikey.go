package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/nowbind/nowbind/internal/middleware"
	"github.com/nowbind/nowbind/internal/repository"
)

type ApiKeyHandler struct {
	apiKeys *repository.ApiKeyRepository
}

func NewApiKeyHandler(apiKeys *repository.ApiKeyRepository) *ApiKeyHandler {
	return &ApiKeyHandler{apiKeys: apiKeys}
}

func (h *ApiKeyHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var input struct {
		Scopes    []string `json:"scopes"`
		RateLimit int      `json:"rate_limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(input.Scopes) == 0 {
		input.Scopes = []string{"read"}
	}
	if input.RateLimit <= 0 {
		input.RateLimit = 100
	}

	fullKey, apiKey, err := h.apiKeys.Create(r.Context(), userID, input.Scopes, input.RateLimit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create api key")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"key":     fullKey, // Only returned once
		"api_key": apiKey,
	})
}

func (h *ApiKeyHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	keys, err := h.apiKeys.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list api keys")
		return
	}
	writeJSON(w, http.StatusOK, keys)
}

func (h *ApiKeyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	keyID := chi.URLParam(r, "id")

	if err := h.apiKeys.Delete(r.Context(), keyID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete api key")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
