package handler

import (
	"encoding/json"
	"log"
	"net/http"
)

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "nowbind",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// WriteJSONPublic is an exported version of writeJSON for use by the router package
func WriteJSONPublic(w http.ResponseWriter, data interface{}) {
	json.NewEncoder(w).Encode(data)
}

// safePostError maps known service errors to user-friendly messages
// and returns a generic message for unexpected internal errors.
func safePostError(err error) string {
	msg := err.Error()
	switch msg {
	case "title is required", "post not found", "unauthorized",
		"slug already taken":
		return msg
	default:
		log.Printf("post handler: unexpected error: %v", err)
		return "failed to process post"
	}
}

// safeSocialError maps known social errors to user-friendly messages.
func safeSocialError(err error) string {
	msg := err.Error()
	switch msg {
	case "not following",
		"cannot follow yourself", "user not found",
		"already liked", "not liked",
		"already bookmarked", "not bookmarked":
		return msg
	default:
		log.Printf("social handler: unexpected error: %v", err)
		return "failed to process request"
	}
}
