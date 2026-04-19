"use client";

import { useState, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Type,
  ChevronDown,
  List,
  ListOrdered,
  Quote,
  CodeSquare,
  Minus,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const fontSizes = [
  { label: "Small", value: "0.875rem" },
  { label: "Normal", value: null },
  { label: "Large", value: "1.25rem" },
  { label: "Huge", value: "1.5rem" },
];

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
const mod = isMac ? "\u2318" : "Ctrl+";

function ToolbarButton({
  onClick,
  isActive,
  tooltip,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            isActive && "bg-accent text-foreground"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [, forceUpdate] = useState(0);

  // Re-render toolbar when editor selection/formatting changes
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

  const triggerImageUpload = useCallback(() => {
    window.dispatchEvent(new Event("trigger-image-upload"));
  }, []);

  const currentFontSize = editor.getAttributes("textStyle").fontSize;
  const currentLabel =
    fontSizes.find((s) => s.value === currentFontSize)?.label || "Normal";

  // Current heading level
  const activeHeading = [1, 2, 3].find((level) =>
    editor.isActive("heading", { level })
  );
  const headingLabel = activeHeading ? `H${activeHeading}` : "Paragraph";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1.5">
        {/* Undo / Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          tooltip={`Undo (${mod}Z)`}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          tooltip={`Redo (${mod}${isMac ? "\u21e7Z" : "Y"})`}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Heading dropdown */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowHeadingMenu(!showHeadingMenu)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                <span>{headingLabel}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Heading level
            </TooltipContent>
          </Tooltip>
          {showHeadingMenu && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border bg-background p-1 shadow-xl"
              onMouseLeave={() => setShowHeadingMenu(false)}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent",
                  !activeHeading && "bg-accent"
                )}
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setShowHeadingMenu(false);
                }}
              >
                <Type className="h-3.5 w-3.5" /> Paragraph
              </button>
              {[
                { level: 1 as const, icon: Heading1, shortcut: `${mod}${isMac ? "\u2325" : "Alt+"}1` },
                { level: 2 as const, icon: Heading2, shortcut: `${mod}${isMac ? "\u2325" : "Alt+"}2` },
                { level: 3 as const, icon: Heading3, shortcut: `${mod}${isMac ? "\u2325" : "Alt+"}3` },
              ].map(({ level, icon: Icon, shortcut }) => (
                <button
                  key={level}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent",
                    activeHeading === level && "bg-accent"
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level }).run();
                    setShowHeadingMenu(false);
                  }}
                >
                  <Icon className="h-3.5 w-3.5" /> Heading {level}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {shortcut}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Font size selector */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowFontMenu(!showFontMenu)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent"
              >
                <Type className="h-3.5 w-3.5" />
                <span>{currentLabel}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Font size
            </TooltipContent>
          </Tooltip>
          {showFontMenu && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-36 rounded-lg border bg-background p-1 shadow-xl"
              onMouseLeave={() => setShowFontMenu(false)}
            >
              {fontSizes.map((size) => (
                <button
                  key={size.label}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1 text-sm hover:bg-accent",
                    (size.value === currentFontSize ||
                      (!size.value && !currentFontSize)) &&
                      "bg-accent"
                  )}
                  onClick={() => {
                    if (size.value) {
                      (editor.chain().focus() as any)
                        .setFontSize(size.value)
                        .run();
                    } else {
                      (editor.chain().focus() as any).unsetFontSize().run();
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

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Inline formatting buttons */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          tooltip={`Bold (${mod}B)`}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          tooltip={`Italic (${mod}I)`}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          tooltip={`Underline (${mod}U)`}
        >
          <Underline className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          tooltip={`Strikethrough (${mod}${isMac ? "\u21e7" : "Shift+"}X)`}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          tooltip={`Inline Code (${mod}E)`}
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              window.dispatchEvent(
                new CustomEvent("editor-url-prompt", {
                  detail: { type: "link" },
                })
              );
            }
          }}
          isActive={editor.isActive("link")}
          tooltip={`Link (${mod}K)`}
        >
          <Link className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Block formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          tooltip={`Bullet List (${mod}${isMac ? "\u21e7" : "Shift+"}8)`}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          tooltip={`Ordered List (${mod}${isMac ? "\u21e7" : "Shift+"}7)`}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          tooltip={`Blockquote (${mod}${isMac ? "\u21e7" : "Shift+"}B)`}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
          tooltip={`Code Block (${mod}${isMac ? "\u2325" : "Alt+"}C)`}
        >
          <CodeSquare className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          tooltip="Horizontal Rule"
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={triggerImageUpload}
          tooltip="Upload Image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
    </TooltipProvider>
  );
}          