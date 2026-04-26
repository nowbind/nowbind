"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, Square } from "lucide-react";

interface TTSPlayerProps {
    text: string;
    contentId?: string;
}

export function TTSPlayer({ text, contentId }: TTSPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const pauseOffsetRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);
    const currentRequestIdRef = useRef<number>(0); // For cancelling pending requests
    const abortControllerRef = useRef<AbortController | null>(null);

    // Clean up audio context on unmount
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Update progress during playback
    const updateProgress = useCallback(() => {
        if (!audioContextRef.current || !currentSourceRef.current || isPaused) {
            return;
        }

        const currentTime = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
        setCurrentTime(Math.max(0, Math.min(currentTime, duration)));

        animationFrameRef.current = requestAnimationFrame(updateProgress);
    }, [isPaused, duration]);

    // Stop playback and reset
    const stopPlayback = useCallback(() => {
        if (currentSourceRef.current) {
            try {
                currentSourceRef.current.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            currentSourceRef.current.disconnect();
            currentSourceRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
        pauseOffsetRef.current = 0;
        startTimeRef.current = 0;
    }, []);

    // Play audio from buffer
    const playAudio = useCallback(async (audioBuffer: AudioBuffer) => {
        try {
            // Close existing context if any
            if (audioContextRef.current) {
                await audioContextRef.current.close();
            }

            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;

            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);

            // Store duration
            setDuration(audioBuffer.duration);

            // Resume from pause offset if paused
            if (isPaused && pauseOffsetRef.current > 0) {
                startTimeRef.current = audioContext.currentTime;
                source.start(0, pauseOffsetRef.current);
            } else {
                // Fresh start
                pauseOffsetRef.current = 0;
                startTimeRef.current = audioContext.currentTime;
                source.start();
            }

            currentSourceRef.current = source;
            setIsPlaying(true);
            setIsPaused(false);
            setCurrentTime(pauseOffsetRef.current);

            // Important: This onended handler properly resets only on NATURAL end
            // Not when manually stopped
            source.onended = () => {
                // Check if this is a natural end (not manually paused or stopped)
                // If pauseOffset is 0 and we're not paused, it's natural end
                if (!isPaused && pauseOffsetRef.current === 0) {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }
            };

            // Start progress updates
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(updateProgress);

            await audioContext.resume();
        } catch (error) {
            console.error("Failed to play audio:", error);
            setIsPlaying(false);
            setIsPaused(false);
            setIsGenerating(false);
        }
    }, [isPaused, updateProgress]);

    // Generate speech from text
    const generateSpeech = useCallback(async (textToGenerate: string) => {
        const requestId = Date.now();
        currentRequestIdRef.current = requestId;

        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsGenerating(true);

        try {
            const response = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToGenerate }),
                signal: controller.signal,
            });

            // Check if this request is still valid (not cancelled by a newer request)
            if (currentRequestIdRef.current !== requestId) {
                return; // Request was superseded
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "TTS generation failed");
            }

            const data = await response.json();
            const audioBase64 = data.audio;

            if (!audioBase64) {
                throw new Error("No audio data received");
            }

            // Convert base64 to ArrayBuffer
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            // Decode audio
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            audioContext.close();

            audioBufferRef.current = audioBuffer;

            setIsGenerating(false);
            playAudio(audioBuffer);

        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                console.log("TTS request cancelled");
                return;
            }
            console.error("TTS error:", error);
            setIsGenerating(false);
            setIsPlaying(false);
            setIsPaused(false);
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, [playAudio]);

    // Handle play button click
    const handlePlay = useCallback(async () => {
        // If paused, resume
        if (isPaused && audioBufferRef.current && audioContextRef.current && pauseOffsetRef.current > 0) {
            try {
                await audioContextRef.current.resume();
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBufferRef.current;
                source.connect(audioContextRef.current.destination);
                source.start(0, pauseOffsetRef.current);

                currentSourceRef.current = source;
                setIsPlaying(true);
                setIsPaused(false);
                startTimeRef.current = audioContextRef.current.currentTime;

                source.onended = () => {
                    if (!isPaused && pauseOffsetRef.current === 0) {
                        setIsPlaying(false);
                        setCurrentTime(0);
                    }
                };

                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                animationFrameRef.current = requestAnimationFrame(updateProgress);
            } catch (error) {
                console.error("Resume failed:", error);
                // Fallback: regenerate
                generateSpeech(text);
            }
            return;
        }

        // Fresh playback
        if (audioBufferRef.current) {
            playAudio(audioBufferRef.current);
            return;
        }

        // Generate new audio
        await generateSpeech(text);
    }, [isPaused, text, generateSpeech, playAudio, updateProgress]);

    // Handle pause button click
    const handlePause = useCallback(() => {
        if (!isPlaying || !audioContextRef.current || !currentSourceRef.current) return;

        // Save current position
        const currentPos = audioContextRef.current.currentTime - startTimeRef.current + pauseOffsetRef.current;
        pauseOffsetRef.current = currentPos;

        // Stop the source without triggering onended
        const source = currentSourceRef.current;
        currentSourceRef.current = null;

        // Temporarily remove onended to prevent it from firing on manual stop
        const originalOnEnded = source.onended;
        source.onended = null;
        source.stop();
        source.onended = originalOnEnded;

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        setIsPlaying(false);
        setIsPaused(true);
    }, [isPlaying]);

    // Handle stop button click - cancels both playback and pending generation
    const handleStop = useCallback(() => {
        // Cancel any pending generation request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            currentRequestIdRef.current = 0;
        }

        // Stop current playback
        if (currentSourceRef.current) {
            try {
                currentSourceRef.current.stop();
            } catch (e) {
                // Ignore
            }
            currentSourceRef.current.disconnect();
            currentSourceRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        setIsPlaying(false);
        setIsPaused(false);
        setIsGenerating(false);
        setCurrentTime(0);
        pauseOffsetRef.current = 0;
        startTimeRef.current = 0;
    }, []);

    if (!text) return null;

    return (
        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
            {isGenerating ? (
                <div className="flex items-center gap-2 px-2 py-1">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-400">Generating...</span>
                </div>
            ) : (
                <>
                    {!isPlaying && !isPaused ? (
                        <button
                            onClick={handlePlay}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors"
                            title="Play"
                            disabled={isGenerating}
                        >
                            <Play className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handlePause}
                            className="p-1.5 rounded hover:bg-white/10 transition-colors"
                            title="Pause"
                        >
                            <Pause className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        onClick={handleStop}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors"
                        title="Stop"
                    >
                        <Square className="w-4 h-4" />
                    </button>
                </>
            )}

            {isPlaying && duration > 0 && (
                <div className="flex items-center gap-2 ml-2">
                    <div className="w-24 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-100"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-400">
                        {Math.floor(currentTime)}s / {Math.floor(duration)}s
                    </span>
                </div>
            )}
        </div>
    );
}