"use client";

import { useState, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, ghcolors } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  children: string;
  language?: string;
}

export function CodeBlock({ children, language = "text" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border [&_pre]:bg-transparent!">
      <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
        <span className="text-xs text-muted-foreground">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleCopy}
          aria-label={copied ? "Copied code" : "Copy code"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {mounted ? (
        <SyntaxHighlighter
          language={language}
          style={resolvedTheme === "dark" ? vscDarkPlus : ghcolors}
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.875rem",
            border: "none"
          }}
        >
          {children}
        </SyntaxHighlighter>
      ) : (
        <pre className="m-0 p-4 overflow-auto bg-transparent text-sm">
          <code>{children}</code>
        </pre>
      )}
    </div>
  );
}
