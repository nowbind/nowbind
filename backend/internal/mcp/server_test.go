package mcp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServeHTTPInitializedNotificationReturnsAccepted(t *testing.T) {
	server := NewMCPServer(nil, nil, nil, nil, "https://nowbind.com")

	req := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(`{"jsonrpc":"2.0","method":"notifications/initialized"}`))
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected %d, got %d", http.StatusAccepted, rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Fatalf("expected empty response body, got %q", rec.Body.String())
	}
}

func TestServeHTTPInitializeNegotiatesProtocolVersion(t *testing.T) {
	server := NewMCPServer(nil, nil, nil, nil, "https://nowbind.com")

	req := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25"}}`))
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}

	var resp struct {
		Result struct {
			ProtocolVersion string `json:"protocolVersion"`
		} `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Result.ProtocolVersion != "2025-11-25" {
		t.Fatalf("expected negotiated version 2025-11-25, got %q", resp.Result.ProtocolVersion)
	}
	if got := rec.Header().Get("MCP-Protocol-Version"); got != "2025-11-25" {
		t.Fatalf("expected response header MCP-Protocol-Version=2025-11-25, got %q", got)
	}
}

func TestServeHTTPGetReturnsMethodNotAllowedWithoutSSE(t *testing.T) {
	server := NewMCPServer(nil, nil, nil, nil, "https://nowbind.com")

	req := httptest.NewRequest(http.MethodGet, "/mcp", nil)
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected %d, got %d", http.StatusMethodNotAllowed, rec.Code)
	}
}

func TestServeHTTPListsResourceTemplates(t *testing.T) {
	server := NewMCPServer(nil, nil, nil, nil, "https://nowbind.com")

	req := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"resources/templates/list"}`))
	rec := httptest.NewRecorder()

	server.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d", http.StatusOK, rec.Code)
	}

	var resp struct {
		Result struct {
			ResourceTemplates []struct {
				URITemplate string `json:"uriTemplate"`
			} `json:"resourceTemplates"`
		} `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Result.ResourceTemplates) != 3 {
		t.Fatalf("expected 3 resource templates, got %d", len(resp.Result.ResourceTemplates))
	}
	expected := map[string]bool{
		"nowbind://posts/{slug}":       true,
		"nowbind://authors/{username}": true,
		"nowbind://tags/{slug}":        true,
	}
	for _, tpl := range resp.Result.ResourceTemplates {
		delete(expected, tpl.URITemplate)
	}
	if len(expected) != 0 {
		t.Fatalf("missing expected templates: %#v", expected)
	}
}
