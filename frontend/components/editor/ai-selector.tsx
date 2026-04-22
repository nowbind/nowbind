"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useEditor } from "novel";
import { 
  Sparkles, 
  RefreshCw, 
  FileText, 
  Check,
  Loader2,
  Trash2,
  ALargeSmall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { aiService } from "@/lib/ai-service";



const AI_OPTIONS = [
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

    const result = await aiService.generate({
      prompt: selectedText || editor.getText(),
      option,
      context: editor.getText().slice(0, 1000),
      tone,
    });

    if (!result.error) {
      setGeneratedText(result.text);
    }
    
    setIsLoading(false);
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
            className="h-8 w-8 p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
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
                    <opt.icon className="h-4 w-4 text-muted-foreground/70" />
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t bg-muted/10 p-2">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Tone
                </div>
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setTone(t.name)}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-left text-xs transition-all",
                        tone === t.name 
                          ? "bg-foreground text-background font-medium shadow-sm" 
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
        <div className="flex flex-col gap-3 p-3 min-w-[320px] max-w-[450px]">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
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
              className="h-8 px-3 text-xs"
              onClick={applyChange}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Replace Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
