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
  const savingRef = useRef(false);
  const queueSaveRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);

  onSaveRef.current = onSave;

  const clearScheduledSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) {
      return true;
    }

    if (savingRef.current) {
      queueSaveRef.current = true;
      return false;
    }

    savingRef.current = true;
    setStatus("saving");

    let ok = false;
    try {
      ok = await onSaveRef.current();
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

      // If edits happened while saving, queue exactly one follow-up save.
      if (queueSaveRef.current || dirtyRef.current) {
        queueSaveRef.current = false;
        clearScheduledSave();
        timerRef.current = setTimeout(() => {
          void runSave();
        }, 500);
      }
    }
  }, [clearScheduledSave]);

  // Tick every 30s to update "Saved X min ago" text
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setStatus("unsaved");

    if (savingRef.current) {
      queueSaveRef.current = true;
      return;
    }

    clearScheduledSave();
    timerRef.current = setTimeout(() => {
      void runSave();
    }, interval);
  }, [interval, clearScheduledSave, runSave]);

  const saveNow = useCallback(async () => {
    clearScheduledSave();
    return runSave();
  }, [clearScheduledSave, runSave]);

  const markClean = useCallback(() => {
    dirtyRef.current = false;
    queueSaveRef.current = false;
    clearScheduledSave();
    setLastSavedAt(new Date());
    setStatus("saved");
  }, [clearScheduledSave]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearScheduledSave();
    };
  }, [clearScheduledSave]);

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
