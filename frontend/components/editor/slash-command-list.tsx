"use client";

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
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
} from "lucide-react";

export interface CommandItemDef {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: any; range: any }) => void;
}

interface CommandGroup {
  heading: string;
  items: CommandItemDef[];
}

export const commandGroups: CommandGroup[] = [
  {
    heading: "Headings",
    items: [
      {
        title: "Heading 1",
        description: "Large section heading",
        icon: <Heading1 className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
        },
      },
      {
        title: "Heading 2",
        description: "Medium section heading",
        icon: <Heading2 className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
        },
      },
      {
        title: "Heading 3",
        description: "Small section heading",
        icon: <Heading3 className="h-4 w-4" />,
        command: ({ editor, range }) => {
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
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: "Numbered List",
        description: "Create a numbered list",
        icon: <ListOrdered className="h-4 w-4" />,
        command: ({ editor, range }) => {
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
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: "Quote",
        description: "Add a blockquote",
        icon: <Quote className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: "Divider",
        description: "Add a horizontal rule",
        icon: <Minus className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
      {
        title: "Callout",
        description: "Add an info callout",
        icon: <Info className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "info" }).run();
        },
      },
      {
        title: "Warning",
        description: "Add a warning callout",
        icon: <AlertTriangle className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "warning" }).run();
        },
      },
      {
        title: "Tip",
        description: "Add a tip callout",
        icon: <Lightbulb className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setCallout({ type: "tip" }).run();
        },
      },
      {
        title: "Note",
        description: "Add a note callout",
        icon: <StickyNote className="h-4 w-4" />,
        command: ({ editor, range }) => {
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
        description: "Upload from your device",
        icon: <ImagePlus className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(new CustomEvent("trigger-image-upload"));
        },
      },
      {
        title: "Image URL",
        description: "Embed an image from a link",
        icon: <ImageIcon className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "image" } })
          );
        },
      },
      {
        title: "YouTube Video",
        description: "Embed a YouTube video",
        icon: <Youtube className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "youtube" } })
          );
        },
      },
      {
        title: "Bookmark",
        description: "Embed a link as a card",
        icon: <LinkIcon className="h-4 w-4" />,
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "bookmark" } })
          );
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
        command: ({ editor, range }) => {
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
        command: ({ editor, range }) => {
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
        command: ({ editor, range }) => {
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
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).run();
          window.dispatchEvent(
            new CustomEvent("editor-url-prompt", { detail: { type: "embed" } })
          );
        },
      },
    ],
  },
];

interface SlashCommandListProps {
  editor: any;
  range: any;
  query: string;
  command: (item: { command: (props: { editor: any; range: any }) => void }) => void;
}

export function SlashCommandList({ query, command }: SlashCommandListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredGroups = commandGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  const allItems = filteredGroups.flatMap((g) => g.items);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selected = container.querySelector("[data-selected=true]");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
        return true;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % allItems.length);
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = allItems[selectedIndex];
        if (item) {
          command(item);
        }
        return true;
      }
      return false;
    },
    [allItems, selectedIndex, command]
  );

  useEffect(() => {
    (window as any).__slashCommandKeyDown = onKeyDown;
    return () => {
      delete (window as any).__slashCommandKeyDown;
    };
  }, [onKeyDown]);

  if (allItems.length === 0) {
    return (
      <div className="w-72 rounded-lg border bg-background px-2 py-3 text-center text-sm text-muted-foreground shadow-xl">
        No results
      </div>
    );
  }

  let itemIndex = 0;

  return (
    <div
      ref={containerRef}
      className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-lg border bg-background px-1 py-2 shadow-xl"
    >
      {filteredGroups.map((group) => (
        <div key={group.heading}>
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {group.heading}
          </div>
          {group.items.map((item) => {
            const currentIndex = itemIndex++;
            const isSelected = currentIndex === selectedIndex;
            return (
              <button
                key={item.title}
                data-selected={isSelected}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${
                  isSelected ? "bg-accent" : "hover:bg-accent"
                }`}
                onClick={() => command(item)}
                onMouseEnter={() => setSelectedIndex(currentIndex)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
