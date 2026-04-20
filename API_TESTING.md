# NowBind API & MCP Testing Guide

## Setup

**Base URLs:**
- Local: `http://localhost:8080`
- Production: `https://api.nowbind.com` (your backend URL)

**API Key:** Replace `nb_xxxxx` with your actual key (starts with `nb_`).

```bash
export API_KEY="nb_your_key_here"
export BASE="http://localhost:8080"
```

Pass the API key via header or query param:
```bash
# Header (recommended)
-H "Authorization: Bearer $API_KEY"

# Query param
?api_key=$API_KEY
```

---

## Agent API Endpoints

All under `/api/v1/agent/` — require API key.

### List All Published Posts

```bash
curl -s "$BASE/api/v1/agent/posts" \
  -H "Authorization: Bearer $API_KEY" | jq
```

### Get a Single Post (Full Markdown)

```bash
curl -s "$BASE/api/v1/agent/posts/your-post-slug" \
  -H "Authorization: Bearer $API_KEY"
```

Returns raw markdown with title, author, keywords, and full content.

### Search Posts

```bash
curl -s "$BASE/api/v1/agent/search?q=nginx" \
  -H "Authorization: Bearer $API_KEY" | jq
```

### List Authors

```bash
curl -s "$BASE/api/v1/agent/authors" \
  -H "Authorization: Bearer $API_KEY" | jq
```

### List Tags

```bash
curl -s "$BASE/api/v1/agent/tags" \
  -H "Authorization: Bearer $API_KEY" | jq
```

---

## MCP Server

The MCP server is at **`/mcp/`** (NOT `/api/v1/mcp`). Uses Streamable HTTP transport with JSON-RPC 2.0. Requires API key.

### Test MCP with curl

**Initialize:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq
```

If you see `protocolVersion: "2024-11-05"` in the response, MCP is working.

**List Tools:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq
```

| Tool | Description |
|------|-------------|
| `search_posts` | Search posts by keyword |
| `get_post` | Get full post content by slug |
| `list_posts` | List recent posts, optionally filter by tag |
| `get_author` | Get author info by username |

**Call Tool — Search Posts:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_posts","arguments":{"query":"nginx"}}}' | jq
```

**Call Tool — Get Post:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_post","arguments":{"slug":"your-post-slug"}}}' | jq
```

**Call Tool — List Posts:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_posts","arguments":{"limit":5}}}' | jq
```

With tag filter:

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_posts","arguments":{"tag":"nginx","limit":10}}}' | jq
```

**Call Tool — Get Author:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_author","arguments":{"username":"nihesh"}}}' | jq
```

**List Resources:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":7,"method":"resources/list","params":{}}' | jq
```

| URI | Type | Description |
|-----|------|-------------|
| `nowbind://posts` | JSON | All published posts |
| `nowbind://posts/{slug}` | Markdown | Single post content |
| `nowbind://authors` | JSON | All authors |
| `nowbind://tags` | JSON | All tags |
| `nowbind://feed` | Text | Recent posts feed |

**Read a Resource:**

```bash
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":8,"method":"resources/read","params":{"uri":"nowbind://feed"}}' | jq
```

---

## Connecting NowBind MCP to AI Agents

NowBind's MCP server works with all major AI coding tools. Replace `YOUR_API_KEY` with your actual `nb_` key.

### Claude Code (CLI)

**Add via command:**

```bash
claude mcp add --transport http nowbind https://nowbind.com/mcp/ \
  --header "Authorization: Bearer YOUR_API_KEY"
```

Or with JSON:

```bash
claude mcp add-json nowbind '{"type":"http","url":"https://nowbind.com/mcp/","headers":{"Authorization":"Bearer YOUR_API_KEY"}}'
```

**Project-scoped config (`.mcp.json` in project root):**

```json
{
  "mcpServers": {
    "nowbind": {
      "type": "http",
      "url": "https://nowbind.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${NOWBIND_API_KEY}"
      }
    }
  }
}
```

Set the env var: `export NOWBIND_API_KEY="nb_xxxxx"`

---

### Claude Desktop

Claude Desktop does not support remote HTTP servers in the config file directly. Use the `mcp-remote` bridge:

**Config:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "nowbind": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://nowbind.com/mcp/",
        "--header", "Authorization: Bearer YOUR_API_KEY"
      ]
    }
  }
}
```

Or add via **Settings > Connectors** in the Claude Desktop UI (Pro/Max/Team plans).

---

### GitHub Copilot (VS Code)

**Config:** `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "nowbind": {
      "type": "http",
      "url": "https://nowbind.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Or in VS Code `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "nowbind": {
        "type": "http",
        "url": "https://nowbind.com/mcp/",
        "headers": {
          "Authorization": "Bearer YOUR_API_KEY"
        }
      }
    }
  }
}
```

---

### OpenAI Codex CLI

**Config:** `~/.codex/config.toml`

```toml
[mcp_servers.nowbind]
url = "https://nowbind.com/mcp/"
http_headers = { "Authorization" = "Bearer YOUR_API_KEY" }
```

Or use env var:

```toml
[mcp_servers.nowbind]
url = "https://nowbind.com/mcp/"
bearer_token_env_var = "NOWBIND_API_KEY"
```

---

### Cursor

**Config:** `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "nowbind": {
      "url": "https://nowbind.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

---

### Windsurf

**Config:** `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "nowbind": {
      "serverUrl": "https://nowbind.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Note: Windsurf uses `serverUrl` instead of `url`.

---

### Continue.dev

**Config:** `~/.continue/config.yaml`

```yaml
mcpServers:
  - name: nowbind
    type: streamable-http
    url: "https://nowbind.com/mcp/"
    requestOptions:
      headers:
        Authorization: "Bearer YOUR_API_KEY"
```

Note: Headers go under `requestOptions.headers`.

---

### Cline (VS Code Extension)

**Config:** Accessible via Cline MCP Servers UI, or edit directly:

macOS: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "nowbind": {
      "url": "https://nowbind.com/mcp/",
      "type": "streamableHttp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Note: Cline uses camelCase `streamableHttp`.

---

### OpenCode

**Config:** `opencode.json` in project root:

```json
{
  "mcp": {
    "nowbind": {
      "type": "remote",
      "url": "https://nowbind.com/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Note: OpenCode uses `"type": "remote"` and the key is `mcp` not `mcpServers`.

---

## Quick Reference

| Tool | Config Key | Type Value | URL Field | Headers Field |
|------|-----------|------------|-----------|---------------|
| Claude Code | `mcpServers` | `"http"` | `url` | `headers` |
| Claude Desktop | N/A | Use `mcp-remote` bridge | N/A | N/A |
| GitHub Copilot | `servers` | `"http"` | `url` | `headers` |
| Codex CLI | `mcp_servers` | implicit | `url` | `http_headers` |
| Cursor | `mcpServers` | auto | `url` | `headers` |
| Windsurf | `mcpServers` | auto | `serverUrl` | `headers` |
| Continue.dev | `mcpServers` | `"streamable-http"` | `url` | `requestOptions.headers` |
| Cline | `mcpServers` | `"streamableHttp"` | `url` | `headers` |
| OpenCode | `mcp` | `"remote"` | `url` | `headers` |

---

## Quick Test Script

```bash
#!/bin/bash
API_KEY="YOUR_API_KEY"
BASE="http://localhost:8080"

echo "=== Agent: List Posts ==="
curl -s "$BASE/api/v1/agent/posts" -H "Authorization: Bearer $API_KEY" | jq '.[0]'

echo -e "\n=== Agent: Search ==="
curl -s "$BASE/api/v1/agent/search?q=linux" -H "Authorization: Bearer $API_KEY" | jq

echo -e "\n=== Agent: Authors ==="
curl -s "$BASE/api/v1/agent/authors" -H "Authorization: Bearer $API_KEY" | jq

echo -e "\n=== Agent: Tags ==="
curl -s "$BASE/api/v1/agent/tags" -H "Authorization: Bearer $API_KEY" | jq

echo -e "\n=== MCP: Initialize ==="
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | jq

echo -e "\n=== MCP: Tools List ==="
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq

echo -e "\n=== MCP: List Posts Tool ==="
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_posts","arguments":{"limit":3}}}' | jq

echo -e "\n=== MCP: Feed Resource ==="
curl -s -X POST "$BASE/mcp/" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"resources/read","params":{"uri":"nowbind://feed"}}' | jq
```

---

## AI Writing Assistant

The AI Writing Assistant is integrated into the editor and provides real-time writing support.

### Endpoints

**Generate AI Content:**
`POST /api/ai/generate`

**Payload:**
```json
{
  "prompt": "The text to process or the context for continuation",
  "option": "continue | improve | rewrite | summarize | fix-grammar | headline | shorten | lengthen",
  "tone": "professional | casual | persuasive | friendly",
  "context": "Optional additional context"
}
```

### Local Testing

1. **OpenAI:** Set `OPENAI_API_KEY` in `frontend/.env.local`.
2. **Ollama (Fallback):** 
   - Ensure Ollama is running (`ollama serve`).
   - Pull a model: `ollama pull llama2` (or your preferred model).
   - Set `OLLAMA_BASE_URL` in `frontend/.env.local` if different from `http://localhost:11434/api/generate`.

### UI Shortcuts

- **Ctrl+J / Cmd+J:** Trigger "Continue Writing" at the current cursor position.
- **Slash Command:** Type `/` and select "Continue Writing" or "Improve Writing".
- **Bubble Menu:** Select text to reveal the AI Assistant button with multiple refinement options.
