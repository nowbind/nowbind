"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Play, Pause, Square, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const PREFERRED_VOICE_KEYWORDS = [
  "google",
  "neural",
  "natural",
  "premium",
  "enhanced",
  "microsoft",
  "siri",
];

function pickBestVoice(voices: SpeechSynthesisVoice[], lang = "en"): SpeechSynthesisVoice | null {
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  const pool = langVoices.length > 0 ? langVoices : voices;
  const scored = pool.map((v) => {
    let score = 0;
    const name = v.name.toLowerCase();
    PREFERRED_VOICE_KEYWORDS.forEach((kw, i) => {
      if (name.includes(kw)) score += PREFERRED_VOICE_KEYWORDS.length - i;
    });
    if (!v.localService) score += 2;
    return { voice: v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? null;
}

export function TTSPlayer({ contentId = "article-content" }: { contentId?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showUI, setShowUI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [progress, setProgress] = useState(0);
  const [elapsedWords, setElapsedWords] = useState(0);
  const [totalWords, setTotalWords] = useState(0);

  // Refs so restart always uses latest values
  const rateRef = useRef(1.0);
  const pitchRef = useRef(1.0);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const nodesRef = useRef<{ node: Node; text: string }[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const totalCharsRef = useRef(0);
  const totalWordsRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { totalWordsRef.current = totalWords; }, [totalWords]);

  // Load voices
  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
        setSelectedVoice((prev) => {
          const best = prev ?? pickBestVoice(v);
          selectedVoiceRef.current = best;
          return best;
        });
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      removeHighlights();
    };
  }, []);

  const removeHighlights = () => window.getSelection()?.removeAllRanges();

  const collectText = useCallback(() => {
    const container = document.getElementById(contentId);
    if (!container) return "";
    nodesRef.current = [];
    let rawText = "";
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (node.parentElement?.tagName.match(/^(SCRIPT|STYLE|PRE|CODE)$/i))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node = walker.nextNode();
    while (node) {
      if (node.textContent?.trim()) {
        nodesRef.current.push({ node, text: node.textContent });
        rawText += node.textContent;
      }
      node = walker.nextNode();
    }
    totalCharsRef.current = rawText.length;
    const words = rawText.trim().split(/\s+/).length;
    setTotalWords(words);
    totalWordsRef.current = words;
    return rawText;
  }, [contentId]);

  const handleBoundary = useCallback((e: SpeechSynthesisEvent) => {
    if (e.name !== "word") return;
    const pct = totalCharsRef.current > 0
      ? Math.min(100, Math.round((e.charIndex / totalCharsRef.current) * 100))
      : 0;
    setProgress(pct);
    setElapsedWords(Math.round((pct / 100) * totalWordsRef.current));

    let charCount = 0;
    for (const item of nodesRef.current) {
      const nodeLen = item.text.length;
      if (charCount + nodeLen > e.charIndex) {
        const offset = e.charIndex - charCount;
        let endOffset = offset;
        while (endOffset < nodeLen && /\S/.test(item.text[endOffset])) endOffset++;
        if (endOffset > offset) {
          try {
            const range = document.createRange();
            range.setStart(item.node, offset);
            range.setEnd(item.node, endOffset);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            const el = item.node.parentElement;
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top < 0 || rect.bottom > window.innerHeight)
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch { /* ignore */ }
        }
        break;
      }
      charCount += nodeLen;
    }
  }, []);

  // Core speak function — always reads from refs so it has latest values
  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current;
    utterance.rate = rateRef.current;
    utterance.pitch = pitchRef.current;
    utterance.lang = selectedVoiceRef.current?.lang ?? "en-US";

    utterance.onstart = () => { setIsPlaying(true); isPlayingRef.current = true; setIsPaused(false); };
    utterance.onend = () => {
      setIsPlaying(false); isPlayingRef.current = false;
      setIsPaused(false); setProgress(100);
      removeHighlights(); setShowUI(false); setProgress(0); setElapsedWords(0);
    };
    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);
    utterance.onboundary = handleBoundary;
    utterance.onerror = (e) => {
      if (e.error !== "canceled" && e.error !== "interrupted") {
        console.warn("TTS error:", e.error);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [handleBoundary]);

  const handlePlay = useCallback(() => {
    if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }
    const text = collectText();
    if (!text.trim()) return;
    speak(text);
    setShowUI(true);
  }, [isPlaying, isPaused, collectText, speak]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false); isPlayingRef.current = false;
    setIsPaused(false); setShowUI(false);
    setProgress(0); setElapsedWords(0);
    removeHighlights();
  }, []);

  // Restart with new rate — reads latest text from DOM
  const handleRateChange = useCallback((v: number) => {
    setRate(v);
    rateRef.current = v;
    if (isPlayingRef.current) {
      const text = collectText();
      if (text.trim()) speak(text);
    }
  }, [collectText, speak]);

  // Restart with new pitch
  const handlePitchChange = useCallback((v: number) => {
    setPitch(v);
    pitchRef.current = v;
    if (isPlayingRef.current) {
      const text = collectText();
      if (text.trim()) speak(text);
    }
  }, [collectText, speak]);

  // Restart with new voice
  const handleVoiceChange = useCallback((name: string) => {
    const v = voices.find((v) => v.name === name) ?? null;
    setSelectedVoice(v);
    selectedVoiceRef.current = v;
    if (isPlayingRef.current) {
      const text = collectText();
      if (text.trim()) speak(text);
    }
  }, [voices, collectText, speak]);

  if (!showUI) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={handlePlay}
        title="Listen to article"
      >
        <Play className="h-4 w-4" />
        <span className="sr-only">Listen to article</span>
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 w-[min(480px,90vw)]">
      <div className="bg-background/95 backdrop-blur shadow-lg border rounded-2xl px-5 py-3 flex flex-col gap-3">

        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="icon"
            className="rounded-full h-10 w-10 shrink-0"
            onClick={handlePlay}
          >
            {isPlaying && !isPaused ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium leading-tight truncate">
              {selectedVoice?.name ?? "Default Voice"}
            </span>
            <span className="text-xs text-muted-foreground mt-0.5">
              {isPlaying && !isPaused
                ? `${elapsedWords} / ${totalWords} words`
                : isPaused ? "Paused" : "Ready"}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setShowSettings((s) => !s)}
            title="Voice settings"
          >
            {showSettings ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>

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

        {/* Settings panel */}
        {showSettings && (
          <div className="border-t pt-3 flex flex-col gap-3">

            {/* Voice selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Volume2 className="h-3 w-3" /> Voice
              </label>
              <select
                className="text-sm bg-muted border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedVoice?.name ?? ""}
                onChange={(e) => handleVoiceChange(e.target.value)}
              >
                {voices
                  .filter((v) => v.lang.startsWith("en"))
                  .map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
              </select>
            </div>

            {/* Speed */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-muted-foreground font-medium">Speed</label>
                <span className="text-xs text-muted-foreground">{rate.toFixed(1)}×</span>
              </div>
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={[rate]}
                onValueChange={([v]) => handleRateChange(v)}
                className="w-full"
              />
            </div>

            {/* Pitch */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-muted-foreground font-medium">Pitch</label>
                <span className="text-xs text-muted-foreground">{pitch.toFixed(1)}</span>
              </div>
              <Slider
                min={0.5}
                max={2}
                step={0.1}
                value={[pitch]}
                onValueChange={([v]) => handlePitchChange(v)}
                className="w-full"
              />
            </div>

            <p className="text-[10px] text-muted-foreground">
              Tip: Speed, pitch and voice changes apply instantly. Google/Microsoft voices sound most natural.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}