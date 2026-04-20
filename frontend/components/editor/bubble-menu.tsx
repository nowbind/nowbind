"use client";

import { useState, useEffect } from "react";
import { EditorBubble, useEditor } from "novel";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Type,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AISelector } from "./ai-selector";

const fontSizes = [
  { label: "Small", value: "0.875rem" },
  { label: "Normal", value: null },
  { label: "Large", value: "1.25rem" },
  { label: "Huge", value: "1.5rem" },
];

const youtubeSizes = [
  { label: "Small", value: "50%" },
  { label: "Medium", value: "75%" },
  { label: "Full", value: "100%" },
];

export function EditorBubbleMenu() {
  const { editor } = useEditor();
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const handler = () => forceUpdate((n) => n + 1);
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor]);

  if (!editor) return null;

  const isImage = editor.isActive("image");
  const isYoutube = editor.isActive("youtube");
  const isText = !isImage && !isYoutube;

  const textItems = [
    {
      name: "bold",
      icon: Bold,
      isActive: () => editor.isActive("bold"),
      command: () => editor.chain().focus().toggleBold().run(),
    },
    {
      name: "italic",
      icon: Italic,
      isActive: () => editor.isActive("italic"),
      command: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      name: "underline",
      icon: Underline,
      isActive: () => editor.isActive("underline"),
      command: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      name: "strikethrough",
      icon: Strikethrough,
      isActive: () => editor.isActive("strike"),
      command: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      name: "code",
      icon: Code,
      isActive: () => editor.isActive("code"),
      command: () => editor.chain().focus().toggleCode().run(),
    },
    {
      name: "link",
      icon: Link,
      isActive: () => editor.isActive("link"),
      command: () => {
        if (editor.isActive("link")) {
          editor.chain().focus().unsetLink().run();
        } else {
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "link" } })
          );
        }
      },
    },
  ];

  return (
    <EditorBubble
      updateDelay={0}
      shouldShow={({ editor, state }) => {
        // Show for image/youtube node selections
        if (editor.isActive("image") || editor.isActive("youtube")) return true;
        // Show for non-empty text selections (not in code blocks)
        const { empty } = state.selection;
        if (empty) return false;
        if (editor.isActive("codeBlock")) return false;
        return true;
      }}
      tippyOptions={{
        placement: "top",
        offset: [0, 8],
        onHide: () => setShowFontMenu(false),
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-xl">
        {/* AI Assistant */}
        {isText && (
          <>
            <AISelector />
            <div className="mx-0.5 h-5 w-px bg-border" />
          </>
        )}

        {/* --- Text formatting --- */}
        {isText && (
          <>
            {/* Font size dropdown */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowFontMenu(!showFontMenu)}
                className="flex items-center gap-0.5 rounded-md px-1.5 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                <Type className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </button>

              {showFontMenu && (
                <div
                  className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border bg-background p-1 shadow-xl"
                  onMouseLeave={() => setShowFontMenu(false)}
                >
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Size
                  </div>
                  {fontSizes.map((size) => (
                    <button
                      key={size.label}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        "flex w-full items-center rounded-md px-2 py-1 text-sm hover:bg-accent",
                        !size.value &&
                          !editor.getAttributes("textStyle").fontSize &&
                          "bg-accent",
                        size.value &&
                          editor.getAttributes("textStyle").fontSize ===
                            size.value &&
                          "bg-accent"
                      )}
                      onClick={() => {
                        if (size.value) {
                          (editor.chain().focus() as any)
                            .setFontSize(size.value)
                            .run();
                        } else {
                          (editor.chain().focus() as any)
                            .unsetFontSize()
                            .run();
                        }
                        setShowFontMenu(false);
                      }}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mx-0.5 h-5 w-px bg-border" />

            {/* Formatting buttons */}
            {textItems.map((item) => (
              <button
                key={item.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={item.command}
                className={cn(
                  "rounded-md p-1.5 transition-colors hover:bg-accent",
                  item.isActive() && "bg-accent text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
              </button>
            ))}
          </>
        )}

        {/* --- Image alignment --- */}
        {isImage && (
          <>
            <span className="px-1.5 text-xs text-muted-foreground">Align</span>
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  (editor.chain().focus() as any).setImageAlign(align).run()
                }
                className={cn(
                  "rounded-md p-1.5 transition-colors hover:bg-accent",
                  editor.getAttributes("image").dataAlign === align &&
                    "bg-accent text-accent-foreground"
                )}
              >
                {align === "left" && <AlignLeft className="h-4 w-4" />}
                {align === "center" && <AlignCenter className="h-4 w-4" />}
                {align === "right" && <AlignRight className="h-4 w-4" />}
              </button>
            ))}
          </>
        )}

        {/* --- YouTube resize --- */}
        {isYoutube && (
          <>
            <span className="px-1.5 text-xs text-muted-foreground">Size</span>
            {youtubeSizes.map((size) => (
              <button
                key={size.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  (editor.chain().focus() as any)
                    .setYoutubeWidth(size.value)
                    .run()
                }
                className={cn(
                  "rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-accent",
                  (editor.getAttributes("youtube").containerWidth ||
                    "100%") === size.value &&
                    "bg-accent text-accent-foreground"
                )}
              >
                {size.label}
              </button>
            ))}
          </>
        )}
      </div>
    </EditorBubble>
  );
}
