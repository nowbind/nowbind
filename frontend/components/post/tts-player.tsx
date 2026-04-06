"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TTSPlayer({
  contentId = "article-content",
}: {
  contentId?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showUI, setShowUI] = useState(false);
  const nodesRef = useRef<{ node: Node; text: string }[]>([]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      removeHighlights();
    };
  }, []);

  const removeHighlights = () => {
    window.getSelection()?.removeAllRanges();
  };

  const wrapTextInSpans = () => {
    const container = document.getElementById(contentId);
    if (!container) return "";

    nodesRef.current = [];
    let rawText = "";

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text inside scripts, styles, pre, code
        if (node.parentElement?.tagName.match(/^(SCRIPT|STYLE|PRE|CODE)$/i)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      if (node.textContent && node.textContent.trim().length > 0) {
        nodesRef.current.push({ node, text: node.textContent });
        rawText += node.textContent;
      }
      node = walker.nextNode();
    }

    return rawText;
  };

  const handleBoundary = (e: SpeechSynthesisEvent) => {
    if (e.name !== "word") return;

    let charCount = 0;
    for (const item of nodesRef.current) {
      const nodeLen = item.text.length;
      if (charCount + nodeLen > e.charIndex) {
        const offset = e.charIndex - charCount;
        let endOffset = offset;
        while (endOffset < nodeLen && /\S/.test(item.text[endOffset])) {
          endOffset++;
        }
        if (endOffset > offset) {
          try {
            const range = document.createRange();
            range.setStart(item.node, offset);
            range.setEnd(item.node, endOffset);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);

            // Scroll element into view smoothly if not visible
            const element = item.node.parentElement;
            if (element) {
              const rect = element.getBoundingClientRect();
              if (rect.top < 0 || rect.bottom > window.innerHeight) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }
          } catch (err) {
            // Ignore range errors
          }
        }
        break;
      }
      charCount += nodeLen;
    }
  };

  const handlePlay = () => {
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

    const textToSpeak = wrapTextInSpans();
    if (!textToSpeak.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      removeHighlights();
      setShowUI(false);
    };

    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);
    utterance.onboundary = handleBoundary;
    utterance.onerror = (e) => {
      // Don't log if user cancelled explicitly
      if (e.error !== "canceled" && e.error !== "interrupted") {
        // Ignore noise errors
      }
    };

    window.speechSynthesis.speak(utterance);
    setShowUI(true);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setShowUI(false);
    removeHighlights();
  };

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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-background/95 backdrop-blur shadow-lg border rounded-full px-6 py-3 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-10 w-10 shrink-0"
          onClick={handlePlay}
        >
          {isPlaying && !isPaused ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-1" />
          )}
        </Button>
        <div className="flex flex-col min-w-[120px]">
          <span className="text-sm font-medium leading-none">Audio Player</span>
          <span className="text-xs text-muted-foreground mt-1">
            {isPlaying && !isPaused ? "Playing..." : "Paused"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleStop}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
