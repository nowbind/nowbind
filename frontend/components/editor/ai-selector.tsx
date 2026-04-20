"use client";

import { useState } from "react";
import { useEditor } from "novel";
import { 
  Sparkles, 
  RefreshCw, 
  TextQuote, 
  FileText, 
  Check, 
  ChevronDown,
  Loader2,
  Trash2,
  ALargeSmall,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AISelectorProps {
  onSelect?: (text: string) => void;
}

const AI_OPTIONS = [
  {
    name: "improve",
    label: "Improve writing",
    icon: Sparkles,
    description: "Fix grammar and improve clarity"
  },
  {
    name: "rewrite",
    label: "Rewrite",
    icon: RefreshCw,
    description: "Make it more engaging"
  },
  {
    name: "shorten",
    label: "Shorten",
    icon: ALargeSmall,
    description: "Make it more concise"
  },
  {
    name: "summarize",
    label: "Summarize",
    icon: FileText,
    description: "Create a brief summary"
  }
];

const TONE_OPTIONS = [
  { name: "professional", label: "Professional" },
  { name: "casual", label: "Casual" },
  { name: "persuasive", label: "Persuasive" },
  { name: "friendly", label: "Friendly" }
];

export function AISelector() {
  const { editor } = useEditor();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [tone, setTone] = useState("professional");

  if (!editor) return null;

  const handleAIAction = async (option: string) => {
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n"
    );

    if (!selectedText && option !== "continue") {
      toast.error("Please select some text first");
      return;
    }

    setIsLoading(true);
    setIsOpen(false);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedText || editor.getText(),
          option,
          context: editor.getText().slice(0, 1000), // Recent context
          tone,
        }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.text);
      } else {
        setGeneratedText(data.text);
      }
    } catch (err) {
      toast.error("Failed to generate text. Is the AI server running?");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyChange = () => {
    if (!generatedText) return;
    editor.chain().focus().insertContent(generatedText).run();
    setGeneratedText("");
  };

  const discardChange = () => {
    setGeneratedText("");
  };

  return (
    <div className="relative">
      {!generatedText ? (
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 pl-2 pr-1 text-xs font-medium text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            AI Assistant
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>

          {isOpen && (
            <div className="absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border bg-background shadow-xl">
              <div className="p-1">
                {AI_OPTIONS.map((opt) => (
                  <button
                    key={opt.name}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => handleAIAction(opt.name)}
                  >
                    <opt.icon className="h-4 w-4 text-purple-500" />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t bg-muted/20 p-2">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tone
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setTone(t.name)}
                      className={cn(
                        "rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent",
                        tone === t.name && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-2 min-w-[300px] max-w-[400px]">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-purple-500">
            <Sparkles className="h-3 w-3" />
            AI Suggestion
          </div>
          <p className="text-sm text-foreground/80 italic leading-relaxed">
            {generatedText}
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={discardChange}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Discard
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              onClick={applyChange}
            >
              <Check className="mr-1 h-3 w-3" />
              Replace Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
