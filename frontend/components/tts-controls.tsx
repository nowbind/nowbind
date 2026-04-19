"use client";

import { useState, useEffect } from "react";
import { Play, Pause, StopCircle, Volume2 } from "lucide-react";

interface TTSControlsProps {
    text: string;
}

export function TTSControls({ text }: TTSControlsProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>("");
    const [rate, setRate] = useState(1);
    const [pitch, setPitch] = useState(1);
    const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

    // Load available voices
    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            setVoices(availableVoices);
            // Prefer natural sounding voice
            const naturalVoice = availableVoices.find(v => 
                v.name.includes("Google") || 
                v.name.includes("Natural") ||
                v.name.includes("Premium") ||
                v.lang === "en-US"
            );
            setSelectedVoice(naturalVoice?.voiceURI || availableVoices[0]?.voiceURI || "");
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    const speak = () => {
        if (!text) return;
        
        window.speechSynthesis.cancel();
        
        const newUtterance = new SpeechSynthesisUtterance(text);
        const voice = voices.find(v => v.voiceURI === selectedVoice);
        if (voice) newUtterance.voice = voice;
        newUtterance.rate = rate;
        newUtterance.pitch = pitch;
        
        newUtterance.onend = () => {
            setIsPlaying(false);
            setUtterance(null);
        };
        
        newUtterance.onerror = () => {
            setIsPlaying(false);
        };
        
        setUtterance(newUtterance);
        window.speechSynthesis.speak(newUtterance);
        setIsPlaying(true);
    };

    const pause = () => {
        window.speechSynthesis.pause();
        setIsPlaying(false);
    };

    const resume = () => {
        window.speechSynthesis.resume();
        setIsPlaying(true);
    };

    const stop = () => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setUtterance(null);
    };

    if (!text) return null;

    return (
        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg flex-wrap">
            {!isPlaying ? (
                <button onClick={speak} className="p-1.5 rounded hover:bg-white/10" title="Play">
                    <Play className="w-4 h-4" />
                </button>
            ) : (
                <>
                    <button onClick={pause} className="p-1.5 rounded hover:bg-white/10" title="Pause">
                        <Pause className="w-4 h-4" />
                    </button>
                    <button onClick={stop} className="p-1.5 rounded hover:bg-white/10" title="Stop">
                        <StopCircle className="w-4 h-4" />
                    </button>
                </>
            )}
            
            <Volume2 className="w-3 h-3 text-slate-400" />
            <select 
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs max-w-[150px]"
            >
                {voices.map((voice) => (
                    <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                    </option>
                ))}
            </select>
            
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Speed:</span>
                <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="w-16"
                />
                <span className="text-[10px] text-slate-400">{rate}x</span>
            </div>
            
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Pitch:</span>
                <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-16"
                />
                <span className="text-[10px] text-slate-400">{pitch}</span>
            </div>
        </div>
    );
}