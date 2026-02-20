"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Type,
  ALargeSmall,
  Maximize,
  Minimize,
  ChevronUp,
} from "lucide-react";

type FontFamily = "default" | "sans" | "serif" | "mono";
type FontSize = "sm" | "md" | "lg";

const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
];

const LS_KEY = "nowbind-reading-prefs";

interface ReadingPrefs {
  fontFamily: FontFamily;
  fontSize: FontSize;
}

function loadPrefs(): ReadingPrefs {
  if (typeof window === "undefined") return { fontFamily: "default", fontSize: "md" };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        fontFamily: parsed.fontFamily || "default",
        fontSize: parsed.fontSize || "md",
      };
    }
  } catch {}
  return { fontFamily: "default", fontSize: "md" };
}

function savePrefs(prefs: ReadingPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {}
}

async function requestFullscreenMode() {
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) return;
  try {
    await root.requestFullscreen();
  } catch {}
}

async function exitFullscreenMode() {
  if (!document.fullscreenElement || !document.exitFullscreen) return;
  try {
    await document.exitFullscreen();
  } catch {}
}

export function ReadingToolbar() {
  const [prefs, setPrefs] = useState<ReadingPrefs>({ fontFamily: "default", fontSize: "md" });
  const [focusMode, setFocusMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Load saved preferences on mount
  useEffect(() => {
    setPrefs(loadPrefs());
    setMounted(true);
  }, []);

  // Apply preferences to content area
  useEffect(() => {
    if (!mounted) return;
    const content = document.querySelector(".markdown-content, .tiptap-content") as HTMLElement | null;
    if (!content) return;

    // Font family
    content.classList.remove("reading-font-default", "reading-font-sans", "reading-font-serif", "reading-font-mono");
    if (prefs.fontFamily !== "default") {
      content.classList.add(`reading-font-${prefs.fontFamily}`);
    }

    // Font size
    content.classList.remove("reading-size-sm", "reading-size-md", "reading-size-lg");
    content.classList.add(`reading-size-${prefs.fontSize}`);

    savePrefs(prefs);
  }, [prefs, mounted]);

  // Toggle focus mode on body
  useEffect(() => {
    if (!mounted) return;
    if (focusMode) {
      document.documentElement.setAttribute("data-focus-mode", "");
    } else {
      document.documentElement.removeAttribute("data-focus-mode");
    }
    return () => {
      document.documentElement.removeAttribute("data-focus-mode");
    };
  }, [focusMode, mounted]);

  // Escape key exits focus mode
  useEffect(() => {
    if (!focusMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocusMode(false);
        setOpen(false);
        void exitFullscreenMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

  // Keep focus mode state in sync if user exits browser fullscreen externally.
  useEffect(() => {
    if (!mounted) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFocusMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [mounted]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const updatePrefs = useCallback((patch: Partial<ReadingPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleFocusMode = useCallback(async () => {
    const next = !focusMode;
    setFocusMode(next);
    setOpen(false);

    if (next) {
      await requestFullscreenMode();
    } else {
      await exitFullscreenMode();
    }
  }, [focusMode]);

  if (!mounted) return null;

  return (
    <div ref={toolbarRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {open && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 rounded-xl border bg-background p-4 shadow-lg w-56">
          {/* Font family */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Type className="h-3 w-3" />
              Font
            </div>
            <div className="flex rounded-md border">
              {FONT_FAMILIES.map((f, i) => (
                <button
                  key={f.value}
                  onClick={() => updatePrefs({ fontFamily: f.value })}
                  className={`flex-1 px-1.5 py-1.5 text-xs transition-colors ${
                    prefs.fontFamily === f.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  } ${i === 0 ? "rounded-l-md" : ""} ${
                    i === FONT_FAMILIES.length - 1 ? "rounded-r-md" : ""
                  }`}
                  style={{
                    fontFamily:
                      f.value === "serif"
                        ? "Georgia, serif"
                        : f.value === "mono"
                          ? "'JetBrains Mono', monospace"
                          : "inherit",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ALargeSmall className="h-3 w-3" />
              Size
            </div>
            <div className="flex rounded-md border">
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updatePrefs({ fontSize: s.value })}
                  className={`flex-1 px-2 py-1.5 text-xs transition-colors ${
                    prefs.fontSize === s.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  } ${s.value === "sm" ? "rounded-l-md" : ""} ${
                    s.value === "lg" ? "rounded-r-md" : ""
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Focus mode */}
          <button
            onClick={() => void toggleFocusMode()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {focusMode ? (
              <Minimize className="h-3.5 w-3.5" />
            ) : (
              <Maximize className="h-3.5 w-3.5" />
            )}
            {focusMode ? "Exit Full Mode" : "Enter Full Mode"}
            <span className="ml-auto text-[10px] text-muted-foreground/60">Esc</span>
          </button>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md transition-colors hover:bg-accent ${
          focusMode ? "ring-2 ring-primary" : ""
        }`}
        aria-label="Reading preferences"
      >
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <Type className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
