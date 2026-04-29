"use client";

import type { Editor, Range } from "@tiptap/core";
import {
  EditorCommand,
  EditorCommandItem,
  EditorCommandList,
} from "novel";
import {
  Heading1,
  Heading2,
  Heading3,
  Code,
  ImagePlus,
  ImageIcon,
  Youtube,
  Quote,
  Minus,
  Info,
  AlertTriangle,
  Lightbulb,
  StickyNote,
  LinkIcon,
  List,
  ListOrdered,
  MessageCircle,
  Github,
  Code2,
  Globe,
  Sparkles,
} from "lucide-react";

interface SlashCommandsProps {
  onImageUpload?: () => void;
}

const commandGroups = [
  {
    heading: "AI",
    items: [
      {
        title: "Continue Writing",
        description: "Use AI to complete your thoughts",
        icon: <Sparkles className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(new CustomEvent("ai-continue"));
        },
      },
    ],
  },
  {
    heading: "Headings",
    items: [
      {
        title: "Heading 1",
        description: "Large section heading",
        icon: <Heading1 className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
        },
      },
      {
        title: "Heading 2",
        description: "Medium section heading",
        icon: <Heading2 className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
        },
      },
      {
        title: "Heading 3",
        description: "Small section heading",
        icon: <Heading3 className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
        },
      },
    ],
  },
  {
    heading: "Lists",
    items: [
      {
        title: "Bullet List",
        description: "Create a bullet list",
        icon: <List className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: "Numbered List",
        description: "Create a numbered list",
        icon: <ListOrdered className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
    ],
  },
  {
    heading: "Blocks",
    items: [
      {
        title: "Code Block",
        description: "Add a code snippet",
        icon: <Code className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: "Quote",
        description: "Add a blockquote",
        icon: <Quote className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: "Divider",
        description: "Add a horizontal rule",
        icon: <Minus className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
      {
        title: "Callout",
        description: "Add an info callout",
        icon: <Info className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "info" }).run();
        },
      },
      {
        title: "Warning",
        description: "Add a warning callout",
        icon: <AlertTriangle className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "warning" }).run();
        },
      },
      {
        title: "Tip",
        description: "Add a tip callout",
        icon: <Lightbulb className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "tip" }).run();
        },
      },
      {
        title: "Note",
        description: "Add a note callout",
        icon: <StickyNote className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "note" }).run();
        },
      },
    ],
  },
  {
    heading: "Media",
    items: [
      {
        title: "Upload Image",
        description: "Upload an image from your device",
        icon: <ImagePlus className="h-4 w-4" />,
        isImageUpload: true,
        command: () => {
          // handled by onImageUpload prop
        },
      },
      {
        title: "Image URL",
        description: "Embed an image from a link",
        icon: <ImageIcon className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          const url = prompt("Enter image URL:");
          if (url) {
            editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
          }
        },
      },
      {
        title: "YouTube Video",
        description: "Embed a YouTube video",
        icon: <Youtube className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          const url = prompt("Enter YouTube URL:");
          if (url) {
            editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run();
          }
        },
      },
      {
        title: "Bookmark",
        description: "Embed a link as a card",
        icon: <LinkIcon className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          const url = prompt("Enter URL:");
          if (url) {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .setBookmark({ url, title: url })
              .run();
          }
        },
      },
    ],
  },
  {
    heading: "Embeds",
    items: [
      {
        title: "Embed",
        description: "Embed from URL (Twitter, Gist, CodePen)",
        icon: <Globe className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "embed" } })
          );
        },
      },
      {
        title: "Twitter",
        description: "Embed a tweet",
        icon: <MessageCircle className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "embed" } })
          );
        },
      },
      {
        title: "Gist",
        description: "Embed a GitHub Gist",
        icon: <Github className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "embed" } })
          );
        },
      },
      {
        title: "CodePen",
        description: "Embed a CodePen",
        icon: <Code2 className="h-4 w-4" />,
        command: ({ editor, range }: { editor: Editor; range: Range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "embed" } })
          );
        },
      },
    ],
  },
];

export function SlashCommands({ onImageUpload }: SlashCommandsProps) {
  return (
    <EditorCommand
      className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-lg border bg-background px-1 py-2 shadow-xl"
      filter={(value, search) => {
        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
        return 0;
      }}
    >
      <EditorCommandList>
        {commandGroups.map((group) => (
          <div key={group.heading}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {group.heading}
            </div>
            {group.items.map((item) => (
              <EditorCommandItem
                key={item.title}
                value={item.title}
                onCommand={(props) => {
                  if ("isImageUpload" in item && item.isImageUpload && onImageUpload) {
                    const { editor, range } = props;
                    editor.chain().focus().deleteRange(range).run();
                    onImageUpload();
                  } else {
                    item.command(props);
                  }
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent aria-selected:bg-accent"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
              </EditorCommandItem>
            ))}
          </div>
        ))}
      </EditorCommandList>
    </EditorCommand>
  );
}
