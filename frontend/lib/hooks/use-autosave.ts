"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type AutosaveStatus = "idle" | "saving" | "saved" | "unsaved";

interface UseAutosaveOptions {
  /** Debounce interval in ms before autosave fires (default 30000) */
  interval?: number;
  /** Called to perform the actual save. Returns true on success. */
  onSave: () => Promise<boolean>;
}

export function useAutosave({ interval = 30_000, onSave }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [, tick] = useState(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Tick every 30s to update "Saved X min ago" text
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setStatus("unsaved");

    // Reset debounce timer
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!dirtyRef.current || savingRef.current) return;
      savingRef.current = true;
      setStatus("saving");
      try {
        const ok = await onSaveRef.current();
        if (ok) {
          dirtyRef.current = false;
          setLastSavedAt(new Date());
          setStatus("saved");
        } else {
          setStatus("unsaved");
        }
      } catch {
        setStatus("unsaved");
      } finally {
        savingRef.current = false;
      }
    }, interval);
  }, [interval]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    savingRef.current = true;
    setStatus("saving");
    try {
      const ok = await onSaveRef.current();
      if (ok) {
        dirtyRef.current = false;
        setLastSavedAt(new Date());
        setStatus("saved");
      } else {
        setStatus("unsaved");
      }
      return ok;
    } catch {
      setStatus("unsaved");
      return false;
    } finally {
      savingRef.current = false;
    }
  }, []);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setLastSavedAt(new Date());
    setStatus("saved");
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // beforeunload warning (tab close, refresh, external navigation)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Intercept browser back/forward button (popstate) for SPA navigation
  useEffect(() => {
    const handlePopState = () => {
      if (dirtyRef.current) {
        const leave = window.confirm(
          "You have unsaved changes. Are you sure you want to leave?"
        );
        if (!leave) {
          // Stay on page — re-push the guard entry
          window.history.pushState(null, "", window.location.href);
        }
      }
    };
    // Push initial guard entry
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Build display label
  let statusLabel = "";
  if (status === "saving") {
    statusLabel = "Saving...";
  } else if (status === "saved" && lastSavedAt) {
    const diff = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000);
    if (diff < 60) {
      statusLabel = "Saved just now";
    } else {
      const mins = Math.floor(diff / 60);
      statusLabel = `Saved ${mins} min ago`;
    }
  } else if (status === "unsaved") {
    statusLabel = "Unsaved changes";
  }

  return {
    status,
    statusLabel,
    markDirty,
    markClean,
    saveNow,
    isDirty: dirtyRef.current || status === "unsaved",
  };
}
