"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { EditorRoot, EditorContent, ImageResizer, type JSONContent } from "novel";
import { defaultExtensions } from "./extensions";
import { EditorBubbleMenu } from "./bubble-menu";
import { EditorToolbar } from "./editor-toolbar";
import type { Editor } from "@tiptap/core";
import MarkdownIt from "markdown-it";
import { getReadingTime } from "@/lib/utils";
import { detectProvider } from "./extensions/embed-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { aiService } from "@/lib/ai-service";

type UrlPromptType = "image" | "youtube" | "bookmark" | "link" | "embed";

const urlPromptConfig: Record<
  UrlPromptType,
  { title: string; description: string; placeholder: string }
> = {
  image: {
    title: "Insert Image",
    description: "Paste the URL of the image you want to embed.",
    placeholder: "https://example.com/photo.jpg",
  },
  youtube: {
    title: "Embed YouTube Video",
    description: "Paste a YouTube video URL to embed it in your post.",
    placeholder: "https://youtube.com/watch?v=...",
  },
  bookmark: {
    title: "Add Bookmark",
    description: "Paste a URL to embed it as a link card.",
    placeholder: "https://example.com/article",
  },
  link: {
    title: "Add Link",
    description: "Paste the URL to link the selected text.",
    placeholder: "https://example.com",
  },
  embed: {
    title: "Embed URL",
    description: "Paste a URL from Twitter/X, GitHub Gist, or CodePen.",
    placeholder: "https://twitter.com/user/status/...",
  },
};

const markdownPasteParser = new MarkdownIt({
  html: false,
  linkify: true,
});

const markdownPastePatterns = [
  /(^|\n)\s{0,3}#{1,6}\s+\S/,
  /(^|\n)\s*([-*+])\s+\S/,
  /(^|\n)\s*\d+\.\s+\S/,
  /(^|\n)\s*>\s+\S/,
  /(^|\n)\s{0,3}(```|~~~)/,
  /(^|\n)\s{0,3}(-{3,}|\*{3,}|_{3,})\s*(\n|$)/,
  /`[^`\n]+`/,
  /(\*\*[^*\n]+\*\*)|(__[^_\n]+__)/,
  /~~[^~\n]+~~/,
  /\[[^\]]+\]\([^)]+\)/,
  /!\[[^\]]*]\([^)]+\)/,
  /(^|\n).*\|.*\n\s*\|?\s*:?-{3,}:?\s*\|/,
];

function getClipboardMarkdown(clipboardData: DataTransfer): string | null {
  const markdown = clipboardData.getData("text/markdown")?.trim();
  if (markdown) {
    return markdown;
  }

  const plainText = clipboardData.getData("text/plain")?.trim();
  if (!plainText) {
    return null;
  }

  // Keep native rich-text paste except for GitHub code-view HTML, where
  // plain text contains the markdown source we actually want.
  const html = clipboardData.getData("text/html")?.trim();
  if (html) {
    const isGitHubCodeClipboard = /blob-code|js-file-line|highlight-source-|class=["'][^"']*pl-[^"']*["']/.test(
      html
    );
    if (!isGitHubCodeClipboard) {
      return null;
    }
  }

  const looksLikeMarkdown = markdownPastePatterns.some((pattern) =>
    pattern.test(plainText)
  );

  return looksLikeMarkdown ? plainText : null;
}

interface BlockEditorProps {
  initialContent?: JSONContent;
  onChange?: (json: JSONContent) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

export function BlockEditor({
  initialContent,
  onChange,
  onImageUpload,
}: BlockEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<any>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const contentAppliedRef = useRef(false);

  // URL prompt modal state
  const [urlPrompt, setUrlPrompt] = useState<UrlPromptType | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [isAILoading, setIsAILoading] = useState(false);

  // If initialContent arrives after the editor is already created (e.g. async
  // fetch completing after mount), push it into the editor imperatively.
  // TipTap only reads the `content` option during creation, so prop changes
  // after that are silently ignored by EditorProvider.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !initialContent || contentAppliedRef.current) return;
    // Only apply if the editor is currently empty (no user edits yet)
    const currentContent = editor.getJSON();
    const isEmpty =
      !currentContent.content ||
      currentContent.content.length === 0 ||
      (currentContent.content.length === 1 &&
        currentContent.content[0].type === "paragraph" &&
        (!currentContent.content[0].content ||
          currentContent.content[0].content.length === 0));
    if (isEmpty) {
      editor.commands.setContent(initialContent);
      contentAppliedRef.current = true;
    }
  }, [initialContent, editorInstance]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImageUpload) return;

      try {
        const url = await onImageUpload(file);
        const event = new CustomEvent("insert-image", { detail: { url } });
        window.dispatchEvent(event);
      } catch (err) {
        console.error("Failed to upload image:", err);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onImageUpload]
  );

  // Listen for URL prompt events from slash commands
  useEffect(() => {
    const handler = (e: Event) => {
      const type = (e as CustomEvent).detail?.type as UrlPromptType;
      if (type) {
        setUrlValue("");
        setUrlPrompt(type);
      }
    };
    window.addEventListener("editor-url-prompt", handler);
    return () => window.removeEventListener("editor-url-prompt", handler);
  }, []);

  const handleUrlSubmit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !urlValue.trim() || !urlPrompt) return;

    const url = urlValue.trim();

    switch (urlPrompt) {
      case "image":
        editor.chain().focus().setImage({ src: url }).run();
        break;
      case "youtube":
        editor.chain().focus().setYoutubeVideo({ src: url }).run();
        break;
      case "bookmark":
        editor.chain().focus().setBookmark({ url, title: url }).run();
        break;
      case "link":
        editor.chain().focus().setLink({ href: url }).run();
        break;
      case "embed": {
        const provider = detectProvider(url);
        if (provider === "youtube") {
          editor.chain().focus().setYoutubeVideo({ src: url }).run();
        } else if (provider) {
          editor.chain().focus().setEmbed({ provider, url }).run();
        } else {
          // Fallback to bookmark for unrecognized URLs
          editor.chain().focus().setBookmark({ url, title: url }).run();
        }
        break;
      }
    }

    setUrlPrompt(null);
    setUrlValue("");
  }, [urlPrompt, urlValue]);

  return (
    <div className="relative w-full">
      <EditorRoot>
        {editorInstance && <EditorToolbar editor={editorInstance} />}
        <div className="mt-4" />
        <EditorContent
          extensions={defaultExtensions as any}
          initialContent={initialContent}
          immediatelyRender={false}
          className="prose-editor min-h-[500px]"
          onUpdate={({ editor }) => {
            onChange?.(editor.getJSON());
            const text = editor.getText();
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            setWordCount(words);
          }}
          onCreate={({ editor }) => {
            editorRef.current = editor;
            setEditorInstance(editor as unknown as Editor);

            // Mark content as applied if editor was created with initial content
            if (initialContent) {
              contentAppliedRef.current = true;
            }

            // Listen for image insert events
            const insertHandler = (e: Event) => {
              const url = (e as CustomEvent).detail?.url;
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            };
            window.addEventListener("insert-image", insertHandler);

            // Listen for image upload trigger from slash commands
            const uploadHandler = () => handleImageUpload();
            window.addEventListener("trigger-image-upload", uploadHandler);

            // Listen for AI events
            const aiContinueHandler = async () => {
              const text = editor.getText();
              setIsAILoading(true);
              const result = await aiService.generate({
                prompt: text.slice(-1000), // Last 1000 chars as context
                option: "continue",
              });
              if (!result.error) {
                editor.chain().focus().insertContent(result.text).run();
              }
              setIsAILoading(false);
            };

            const aiImproveHandler = async () => {
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, "\n");
              if (!selectedText) return;

              setIsAILoading(true);
              const result = await aiService.generate({
                prompt: selectedText,
                option: "improve",
              });
              if (!result.error) {
                editor.chain().focus().insertContent(result.text).run();
              }
              setIsAILoading(false);
            };

            window.addEventListener("ai-continue", aiContinueHandler);
            window.addEventListener("ai-improve", aiImproveHandler);

            const originalDestroy = editor.destroy.bind(editor);
            editor.destroy = () => {
              window.removeEventListener("insert-image", insertHandler);
              window.removeEventListener("trigger-image-upload", uploadHandler);
              window.removeEventListener("ai-continue", aiContinueHandler);
              window.removeEventListener("ai-improve", aiImproveHandler);
              editorRef.current = null;
              originalDestroy();
            };
          }}
          editorProps={{
            handleDrop: (view, event, _slice, moved) => {
              if (!moved && event.dataTransfer?.files.length) {
                const file = event.dataTransfer.files[0];
                if (file.type.startsWith("image/") && onImageUpload) {
                  event.preventDefault();
                  onImageUpload(file).then((url) => {
                    const { schema } = view.state;
                    const node = schema.nodes.image.create({ src: url });
                    const pos = view.posAtCoords({
                      left: event.clientX,
                      top: event.clientY,
                    });
                    if (pos) {
                      const tr = view.state.tr.insert(pos.pos, node);
                      view.dispatch(tr);
                    }
                  });
                  return true;
                }
              }
              return false;
            },
            handlePaste: (view, event) => {
              const clipboardData = event.clipboardData;
              const items = clipboardData?.items;
              if (!items) return false;

              for (const item of items) {
                if (item.type.startsWith("image/") && onImageUpload) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (file) {
                    onImageUpload(file).then((url) => {
                      const { schema } = view.state;
                      const node = schema.nodes.image.create({ src: url });
                      const tr = view.state.tr.replaceSelectionWith(node);
                      view.dispatch(tr);
                    });
                  }
                  return true;
                }
              }

              const markdownText = clipboardData
                ? getClipboardMarkdown(clipboardData)
                : null;
              if (!markdownText || !editorRef.current) return false;

              const renderedHTML = markdownPasteParser.render(markdownText).trim();
              if (!renderedHTML) return false;

              event.preventDefault();
              editorRef.current.chain().focus().insertContent(renderedHTML).run();
              return true;
            },
            attributes: {
              class: "ProseMirror focus:outline-none",
            },
            handleKeyDown: (view, event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "j") {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent("ai-continue"));
                return true;
              }
              return false;
            },
          }}
        >
          <EditorBubbleMenu />
          <ImageResizer />
        </EditorContent>
      </EditorRoot>

      {/* Status Bar */}
      <div className="pointer-events-none sticky bottom-4 flex justify-end gap-2 pr-2 pt-2">
        {isAILoading && (
          <span className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs text-foreground shadow-lg backdrop-blur-md border">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating content...
          </span>
        )}
        <span className="pointer-events-auto rounded-md bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          {wordCount} {wordCount === 1 ? "word" : "words"} · {getReadingTime(wordCount)}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* URL input modal */}
      <Dialog
        open={urlPrompt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUrlPrompt(null);
            setUrlValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {urlPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>{urlPromptConfig[urlPrompt].title}</DialogTitle>
                <DialogDescription>
                  {urlPromptConfig[urlPrompt].description}
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUrlSubmit();
                }}
              >
                <Input
                  autoFocus
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder={urlPromptConfig[urlPrompt].placeholder}
                  className="mb-4"
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUrlPrompt(null);
                      setUrlValue("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!urlValue.trim()}>
                    Insert
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
