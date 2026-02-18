"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { API_URL } from "@/lib/constants";
import {
  Upload,
  FileArchive,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ImportResult {
  imported: number;
  skipped: number;
  errors?: string[];
}

export default function ImportPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".zip")) {
      toast.error("Please upload a ZIP file");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File must be under 50MB");
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/import/medium`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Import failed");
      }

      const data: ImportResult = await res.json();
      setResult(data);

      if (data.imported > 0) {
        toast.success(`Imported ${data.imported} post${data.imported > 1 ? "s" : ""}`);
      } else {
        toast.error("No posts were imported");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-8">
          <h1 className="mb-2 text-2xl font-bold">Import from Medium</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Upload your Medium export ZIP file to import your posts as drafts.
          </p>

          {/* Upload zone */}
          {!result && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`relative mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                    ? "border-muted-foreground/25 bg-muted/30"
                    : "border-muted-foreground/25 hover:border-primary hover:bg-primary/5"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />

              {file ? (
                <>
                  <FileArchive className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="mb-1 font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="mb-1 font-medium">
                    Drop your Medium export here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse (ZIP file, max 50MB)
                  </p>
                </>
              )}
            </div>
          )}

          {/* Import button */}
          {file && !result && (
            <Button
              onClick={handleImport}
              disabled={importing}
              className="mb-6 w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Posts
                </>
              )}
            </Button>
          )}

          {/* Results */}
          {result && (
            <div className="mb-6 space-y-4">
              {/* Success summary */}
              <div className="rounded-lg border p-6 text-center">
                {result.imported > 0 ? (
                  <>
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
                    <h2 className="mb-1 text-lg font-semibold">
                      Import Complete
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {result.imported} post{result.imported > 1 ? "s" : ""} imported as drafts
                      {result.skipped > 0 && (
                        <>, {result.skipped} skipped</>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="mx-auto mb-3 h-10 w-10 text-yellow-500" />
                    <h2 className="mb-1 text-lg font-semibold">
                      No Posts Imported
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {result.skipped} file{result.skipped > 1 ? "s" : ""} skipped
                    </p>
                  </>
                )}
              </div>

              {/* Error details */}
              {result.errors && result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <p className="mb-2 text-sm font-medium text-destructive">
                    {result.errors.length} error{result.errors.length > 1 ? "s" : ""}:
                  </p>
                  <ul className="space-y-1">
                    {result.errors.map((err, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted-foreground"
                      >
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button asChild className="flex-1">
                  <Link href="/dashboard">View Your Posts</Link>
                </Button>
                <Button variant="outline" onClick={reset} className="flex-1">
                  Import More
                </Button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-lg border">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex w-full items-center justify-between p-4 text-left text-sm font-medium hover:bg-accent/50"
            >
              How to export your data from Medium
              {showInstructions ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {showInstructions && (
              <div className="border-t px-4 pb-4 pt-3">
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    1. Go to{" "}
                    <span className="font-medium text-foreground">
                      medium.com
                    </span>{" "}
                    and sign in
                  </li>
                  <li>
                    2. Click your profile picture and go to{" "}
                    <span className="font-medium text-foreground">
                      Settings
                    </span>
                  </li>
                  <li>
                    3. Scroll down to{" "}
                    <span className="font-medium text-foreground">
                      Account
                    </span>{" "}
                    section
                  </li>
                  <li>
                    4. Click{" "}
                    <span className="font-medium text-foreground">
                      Download your information
                    </span>
                  </li>
                  <li>
                    5. Medium will email you a download link for a ZIP file
                  </li>
                  <li>
                    6. Download the ZIP and upload it here
                  </li>
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">
                  Your posts will be imported as drafts so you can review them
                  before publishing.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
