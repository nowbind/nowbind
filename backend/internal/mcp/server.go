package mcp

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/nowbind/nowbind/internal/repository"
)

// MCPServer implements a simplified MCP server using Streamable HTTP transport.
// This implements the core MCP protocol for resources and tools.
type MCPServer struct {
	posts       *repository.PostRepository
	tags        *repository.TagRepository
	users       *repository.UserRepository
	frontendURL string
	mu          sync.RWMutex
}

func NewMCPServer(posts *repository.PostRepository, tags *repository.TagRepository, users *repository.UserRepository, frontendURL string) *MCPServer {
	return &MCPServer{
		posts:       posts,
		tags:        tags,
		users:       users,
		frontendURL: frontendURL,
	}
}

// JSON-RPC types
type jsonrpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
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
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var req jsonrpcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeRPCError(w, nil, -32700, "Parse error")
		return
	}

	if req.JSONRPC != "2.0" {
		writeRPCError(w, req.ID, -32600, "Invalid Request")
		return
	}

	ctx := r.Context()
	var result interface{}
	var rpcErr *rpcError

	switch req.Method {
	case "initialize":
		result = s.handleInitialize()
	case "resources/list":
		result = s.handleResourcesList()
	case "resources/read":
		result, rpcErr = s.handleResourcesRead(ctx, req.Params)
	case "tools/list":
		result = s.handleToolsList()
	case "tools/call":
		result, rpcErr = s.handleToolsCall(ctx, req.Params)
	default:
		rpcErr = &rpcError{Code: -32601, Message: fmt.Sprintf("Method not found: %s", req.Method)}
	}

	resp := jsonrpcResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}
	if rpcErr != nil {
		resp.Error = rpcErr
	} else {
		resp.Result = result
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *MCPServer) handleInitialize() interface{} {
	return map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"capabilities": map[string]interface{}{
			"resources": map[string]bool{"listChanged": false},
			"tools":     map[string]interface{}{},
		},
		"serverInfo": map[string]string{
			"name":    "nowbind",
			"version": "1.0.0",
		},
	}
}

func writeRPCError(w http.ResponseWriter, id interface{}, code int, message string) {
	resp := jsonrpcResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &rpcError{Code: code, Message: message},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func init() {
	log.SetFlags(log.Ltime | log.Lshortfile)
}

func handleError(err error) *rpcError {
	return &rpcError{Code: -32603, Message: err.Error()}
}

// ensure MCPServer implements http.Handler
var _ http.Handler = (*MCPServer)(nil)
