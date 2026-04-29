package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"

	"github.com/nowbind/nowbind/internal/repository"
)

type mcpContextKey string

const rpcDetailKey mcpContextKey = "mcp_rpc_detail"

var supportedProtocolVersions = []string{
	"2025-11-25",
	"2025-06-18",
	"2025-03-26",
	"2024-11-05",
}

// RPCDetail is a mutable container stored in context for MCP request detail logging.
// The middleware places a pointer in context; the MCP handler writes to it.
type RPCDetail struct {
	Value string
}

// RPCDetailContextKey returns the context key used to store RPCDetail.
func RPCDetailContextKey() interface{} { return rpcDetailKey }

// MCPServer implements a simplified MCP server using Streamable HTTP transport.
// This implements the core MCP protocol for resources and tools.
type MCPServer struct {
	posts       *repository.PostRepository
	tags        *repository.TagRepository
	users       *repository.UserRepository
	analytics   *repository.AnalyticsRepository
	frontendURL string
	mu          sync.RWMutex
}

func NewMCPServer(posts *repository.PostRepository, tags *repository.TagRepository, users *repository.UserRepository, analytics *repository.AnalyticsRepository, frontendURL string) *MCPServer {
	return &MCPServer{
		posts:       posts,
		tags:        tags,
		users:       users,
		analytics:   analytics,
		frontendURL: frontendURL,
	}
}

// JSON-RPC types
type jsonrpcMessage struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   json.RawMessage `json:"error,omitempty"`
}

type jsonrpcResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id,omitempty"`
	Result  interface{} `json:"result,omitempty"`
	Error   *rpcError   `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (s *MCPServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleSSEGet(w)
	case http.MethodPost:
		s.handlePost(w, r)
	default:
		w.Header().Set("Allow", "GET, POST")
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func (s *MCPServer) handleSSEGet(w http.ResponseWriter) {
	// This server intentionally runs in JSON response mode only.
	w.Header().Set("Allow", "POST")
	http.Error(w, "SSE stream not supported on this endpoint", http.StatusMethodNotAllowed)
}

func (s *MCPServer) handlePost(w http.ResponseWriter, r *http.Request) {
	if err := validateProtocolVersion(r.Header.Get("MCP-Protocol-Version")); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var msg jsonrpcMessage
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		writeRPCErrorWithStatus(w, nil, http.StatusBadRequest, -32700, "Parse error")
		return
	}
	if msg.JSONRPC != "2.0" {
		writeRPCErrorWithStatus(w, msg.ID, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}
	if isResponseMessage(msg) {
		writeNotificationAccepted(w)
		return
	}
	if msg.Method == "" {
		writeRPCErrorWithStatus(w, msg.ID, http.StatusBadRequest, -32600, "Invalid Request")
		return
	}

	ctx := r.Context()
	detail := msg.Method
	result, rpcErr := s.dispatch(ctx, msg, &detail)
	writeRPCDetail(ctx, detail)

	if isNotification(msg) {
		if rpcErr != nil {
			writeRPCErrorWithStatus(w, nil, http.StatusBadRequest, rpcErr.Code, rpcErr.Message)
			return
		}
		writeNotificationAccepted(w)
		return
	}

	if version := responseProtocolVersion(msg.Method, msg.Params, r.Header.Get("MCP-Protocol-Version")); version != "" {
		w.Header().Set("MCP-Protocol-Version", version)
	}

	resp := jsonrpcResponse{
		JSONRPC: "2.0",
		ID:      msg.ID,
	}
	if rpcErr != nil {
		resp.Error = rpcErr
	} else {
		resp.Result = result
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *MCPServer) dispatch(ctx context.Context, msg jsonrpcMessage, detail *string) (interface{}, *rpcError) {
	switch msg.Method {
	case "initialize":
		return s.handleInitialize(msg.Params)
	case "ping":
		return map[string]interface{}{}, nil
	case "resources/list":
		return s.handleResourcesList(), nil
	case "resources/templates/list":
		return s.handleResourceTemplatesList(), nil
	case "resources/read":
		return s.handleResourcesRead(ctx, msg.Params)
	case "tools/list":
		return s.handleToolsList(), nil
	case "tools/call":
		result, rpcErr := s.handleToolsCall(ctx, msg.Params)
		var req struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(msg.Params, &req) == nil && req.Name != "" {
			*detail = "tools/call:" + req.Name
		}
		return result, rpcErr
	default:
		if strings.HasPrefix(msg.Method, "notifications/") {
			return nil, nil
		}
		return nil, &rpcError{Code: -32601, Message: fmt.Sprintf("Method not found: %s", msg.Method)}
	}
}

func (s *MCPServer) handleInitialize(params json.RawMessage) (interface{}, *rpcError) {
	var req struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if len(params) > 0 {
		if err := json.Unmarshal(params, &req); err != nil {
			return nil, &rpcError{Code: -32602, Message: "Invalid params"}
		}
	}

	return map[string]interface{}{
		"protocolVersion": negotiateProtocolVersion(req.ProtocolVersion),
		"capabilities": map[string]interface{}{
			"resources": map[string]bool{"listChanged": false},
			"tools":     map[string]bool{"listChanged": false},
		},
		"serverInfo": map[string]string{
			"name":    "nowbind",
			"version": "1.0.0",
		},
		"instructions": "Use list_posts or search_posts to discover content, get_post for full articles, and the author/tag tools for scoped navigation.",
	}, nil
}

func writeRPCError(w http.ResponseWriter, id interface{}, code int, message string) {
	writeRPCErrorWithStatus(w, id, http.StatusOK, code, message)
}

func writeRPCErrorWithStatus(w http.ResponseWriter, id interface{}, status int, code int, message string) {
	resp := jsonrpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: message},
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}

func writeNotificationAccepted(w http.ResponseWriter) {
	w.WriteHeader(http.StatusAccepted)
}

func init() {
	log.SetFlags(log.Ltime | log.Lshortfile)
}

func handleError(err error) *rpcError {
	log.Printf("mcp error: %v", err)
	return &rpcError{Code: -32603, Message: "internal server error"}
}

func validateProtocolVersion(version string) error {
	if version == "" || isSupportedProtocolVersion(version) {
		return nil
	}
	return fmt.Errorf("unsupported MCP protocol version: %s", version)
}

func negotiateProtocolVersion(requested string) string {
	if isSupportedProtocolVersion(requested) {
		return requested
	}
	return supportedProtocolVersions[0]
}

func isSupportedProtocolVersion(version string) bool {
	for _, supported := range supportedProtocolVersions {
		if version == supported {
			return true
		}
	}
	return false
}

func responseProtocolVersion(method string, params json.RawMessage, headerVersion string) string {
	if method == "initialize" {
		var req struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		if len(params) > 0 && json.Unmarshal(params, &req) == nil {
			return negotiateProtocolVersion(req.ProtocolVersion)
		}
		return supportedProtocolVersions[0]
	}
	if headerVersion != "" {
		return headerVersion
	}
	return supportedProtocolVersions[0]
}

func writeRPCDetail(ctx context.Context, detail string) {
	if rd, ok := ctx.Value(rpcDetailKey).(*RPCDetail); ok {
		rd.Value = detail
	}
}

func isNotification(msg jsonrpcMessage) bool {
	return msg.ID == nil
}

func isResponseMessage(msg jsonrpcMessage) bool {
	return msg.Method == "" && msg.ID != nil && (len(msg.Result) > 0 || len(msg.Error) > 0)
}

// ensure MCPServer implements http.Handler
var _ http.Handler = (*MCPServer)(nil)
