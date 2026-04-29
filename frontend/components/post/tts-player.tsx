"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

// Abort controller for cancelling pending requests
let currentRequestId = 0;
let abortController: AbortController | null = null;

async function generateSpeech(text: string, requestId: number): Promise<AudioBuffer | null> {
  // Cancel any pending request
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  const controller = new AbortController();
  abortController = controller;

  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: controller.signal,
  });

  // Check if this request was superseded
  if (currentRequestId !== requestId) {
    return null;
  }

  if (!response.ok) throw new Error("TTS generation failed");

  const { audio } = await response.json();
  if (!audio) throw new Error("No audio data returned");

  // Decode base64 PCM 16bit 24kHz mono
  const binary = atob(audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pcm = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768;

  const audioCtx = new AudioContext({ sampleRate: 24000 });
  const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
  audioBuffer.copyToChannel(float32, 0);
  await audioCtx.close();
  return audioBuffer;
}

export function TTSPlayer({ contentId = "article-content" }: { contentId?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUI, setShowUI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const pauseOffsetRef = useRef(0);
  const startTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const collectText = useCallback(() => {
    const container = document.getElementById(contentId);
    if (!container) return "";
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (node.parentElement?.tagName.match(/^(SCRIPT|STYLE|PRE|CODE)$/i))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let text = "";
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) text += node.textContent;
      node = walker.nextNode();
    }
    return text.trim();
  }, [contentId]);

  const playBuffer = useCallback((buffer: AudioBuffer, offset = 0) => {
    const ctx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime - offset;
    sourceRef.current = source;

    source.onended = () => {
      // Only reset if not paused (natural end)
      if (pauseOffsetRef.current === 0) {
        setIsPlaying(false);
        setIsPaused(false);
        setShowUI(false);
        audioBufferRef.current = null;
      }
      pauseOffsetRef.current = 0;
    };
  }, []);

  const handlePlay = useCallback(async () => {
    // Resume if paused
    if (isPaused && audioBufferRef.current && pauseOffsetRef.current > 0) {
      playBuffer(audioBufferRef.current, pauseOffsetRef.current);
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Pause if playing
    if (isPlaying && audioCtxRef.current && sourceRef.current) {
      const offset = audioCtxRef.current.currentTime - startTimeRef.current;
      pauseOffsetRef.current = offset;
      // Nullify onended before stopping to prevent it firing
      if (sourceRef.current) sourceRef.current.onended = null;
      sourceRef.current.stop();
      await audioCtxRef.current.close();
      audioCtxRef.current = null;
      sourceRef.current = null;
      setIsPaused(true);
      setIsPlaying(false);
      return;
    }

    // Fresh start
    const text = collectText();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setShowUI(true);
    pauseOffsetRef.current = 0;

    const requestId = ++currentRequestId;
    
    try {
      const buffer = await generateSpeech(text, requestId);
      if (buffer && requestId === currentRequestId) {
        audioBufferRef.current = buffer;
        playBuffer(buffer, 0);
        setIsPlaying(true);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error("TTS error:", err);
        setError("Failed to generate speech. Please try again.");
        setShowUI(false);
      }
    } finally {
      if (requestId === currentRequestId) {
        setIsLoading(false);
      }
    }
  }, [isPlaying, isPaused, collectText, playBuffer]);

  const handleStop = useCallback(async () => {
    // Cancel pending generation
    if (abortController) {
      abortController.abort();
      abortController = null;
      currentRequestId++;
    }
    
    // Stop playback
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      await audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setShowUI(false);
    pauseOffsetRef.current = 0;
    audioBufferRef.current = null;
    setIsLoading(false);
  }, []);

  if (!showUI) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={handlePlay}
          disabled={isLoading}
          title="Listen to article"
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          <span className="sr-only">Listen to article</span>
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-background/95 backdrop-blur shadow-lg border rounded-full px-6 py-3 flex items-center gap-4">
        <Button
          variant="default"
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
          onClick={handlePlay}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isPlaying && !isPaused ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        <span className="text-sm text-muted-foreground min-w-[80px]">
          {isLoading ? "Generating..." : isPlaying && !isPaused ? "Playing..." : "Paused"}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={handleStop}
          title="Stop"
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}