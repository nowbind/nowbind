"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { EditorRoot, EditorContent, ImageResizer, type JSONContent, type EditorInstance } from "novel";
import { defaultExtensions } from "./extensions";
import { EditorBubbleMenu } from "./bubble-menu";
import { EditorToolbar } from "./editor-toolbar";
import type { Editor } from "@tiptap/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UrlPromptType = "image" | "youtube" | "bookmark" | "link";

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
};

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

  // URL prompt modal state
  const [urlPrompt, setUrlPrompt] = useState<UrlPromptType | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [wordCount, setWordCount] = useState(0);

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

            const originalDestroy = editor.destroy.bind(editor);
            editor.destroy = () => {
              window.removeEventListener("insert-image", insertHandler);
              window.removeEventListener("trigger-image-upload", uploadHandler);
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
              const items = event.clipboardData?.items;
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
              return false;
            },
            attributes: {
              class: "ProseMirror focus:outline-none",
            },
          }}
        >
          <EditorBubbleMenu />
          <ImageResizer />
        </EditorContent>
      </EditorRoot>

      {/* Word count */}
      <div className="pointer-events-none sticky bottom-4 flex justify-end pr-2 pt-2">
        <span className="pointer-events-auto rounded-md bg-muted/80 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          {wordCount} {wordCount === 1 ? "word" : "words"} · {Math.max(1, Math.ceil(wordCount / 200))} min read
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
