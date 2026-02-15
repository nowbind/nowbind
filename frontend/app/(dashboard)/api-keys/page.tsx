"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { ApiKey } from "@/lib/types";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<ApiKey[]>("/api-keys")
      .then((k) => setKeys(k || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const createKey = async () => {
    setCreating(true);
    try {
      const result = await api.post<{ key: string; api_key: ApiKey }>(
        "/api-keys",
        { scopes: ["read"], rate_limit: 100 }
      );
      setNewKey(result.key);
      setKeys([result.api_key, ...keys]);
    } catch (err) {
      console.error("Failed to create:", err);
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key?")) return;
    await api.delete(`/api-keys/${id}`);
    setKeys(keys.filter((k) => k.id !== id));
  };

  const copyKey = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">API Keys</h1>
            <Button size="sm" onClick={createKey} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </div>

          <p className="mb-6 text-sm text-muted-foreground">
            Use API keys to access the NowBind Agent API and MCP server.
            Keys are shown only once when created.{" "}
            <a href="/docs" className="underline hover:text-foreground">
              View API docs
            </a>
          </p>

          {newKey && (
            <div className="mb-6 rounded-lg border border-green-500/20 bg-green-50 p-4 dark:bg-green-950/20">
              <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
                New API key created. Copy it now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background p-2 font-mono text-xs">
                  {newKey}
                </code>
                <Button variant="outline" size="icon" onClick={copyKey}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              <Key className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No API keys yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <code className="text-sm font-medium">{key.key_prefix}</code>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at &&
                        ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
