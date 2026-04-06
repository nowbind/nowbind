import {
  StarterKit,
  UpdatedImage,
  TiptapLink,
  TiptapUnderline,
  CodeBlockLowlight,
  Youtube,
  TextStyle,
  HorizontalRule,
  Placeholder,
} from "novel";
import {
  Extension,
  InputRule,
  type Editor,
  type Range,
  type CommandProps,
} from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { Code } from "@tiptap/extension-code";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { common, createLowlight } from "lowlight";
import { Callout } from "./extensions/callout";
import { Bookmark } from "./extensions/bookmark";
import { Embed } from "./extensions/embed";
import { SlashCommandList, commandGroups } from "./slash-command-list";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";

const lowlight = createLowlight(common);

// All titles for suggestion filtering (controls when popup shows/hides)
const allTitles = commandGroups.flatMap((g) => g.items.map((i) => i.title));

const SlashCommand = Extension.create({
  name: "slash-command",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        items: ({ query }: { query: string }) =>
          allTitles.filter((t) =>
            t.toLowerCase().includes(query.toLowerCase()),
          ),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: { command: (args: { editor: Editor; range: Range }) => void };
        }) => {
          props.command({ editor, range });
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList as any, {
                props,
                editor: props.editor,
              });

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },
            onUpdate: (props: any) => {
              component?.updateProps(props);
              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
              });
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }
              // Delegate to the component's key handler
              const handler = (window as any).__slashCommandKeyDown;
              if (handler) {
                return handler(props.event);
              }
              return false;
            },
            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

// Custom inline-code extension with a reliable input rule.
// The default Code extension uses markInputRule with a (^|[^`]) prefix capture group
// which can produce incorrect position calculations. This version uses a raw InputRule
// that correctly handles both handleTextInput (closing backtick not yet in doc) and
// compositionend (text already committed) paths.
const CustomCode = Code.extend({
  addInputRules() {
    const type = this.type;
    return [
      new InputRule({
        find: /`([^`]+)`$/,
        handler({ state, range, match }) {
          const content = match[1];
          if (!content) return null;

          const { tr } = state;
          const openBacktickPos = range.from;
          const contentStart = range.from + 1;
          const contentEnd = contentStart + content.length;

          // Delete closing backtick only when it's already in the document
          // (compositionend path). In the handleTextInput path, range.to equals
          // contentEnd, so this branch is skipped and handleTextInput returning
          // true prevents the backtick from being inserted at all.
          if (contentEnd < range.to) {
            tr.delete(contentEnd, range.to);
          }

          // Delete the opening backtick.
          tr.delete(openBacktickPos, contentStart);

          // Apply the code mark to the content (positions shift after the opening
          // backtick deletion, so content is now at openBacktickPos).
          tr.addMark(
            openBacktickPos,
            openBacktickPos + content.length,
            type.create(),
          );
          tr.removeStoredMark(type);
        },
      }),
    ];
  },
});

// Custom font-size extension using TextStyle marks
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: CommandProps) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: CommandProps) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    } as any;
  },
});

// Image alignment extension — adds data-align attribute to images
const ImageAlign = Extension.create({
  name: "imageAlign",
  addGlobalAttributes() {
    return [
      {
        types: ["image"],
        attributes: {
          dataAlign: {
            default: "center",
            parseHTML: (element) =>
              element.getAttribute("data-align") || "center",
            renderHTML: (attributes) => {
              const align = attributes.dataAlign || "center";
              const styles: Record<string, string> = {
                left: "display: block; margin-right: auto;",
                center:
                  "display: block; margin-left: auto; margin-right: auto;",
                right: "display: block; margin-left: auto;",
              };
              return {
                "data-align": align,
                style: styles[align] || styles.center,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setImageAlign:
        (align: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { selection } = state;
          const node =
            selection instanceof NodeSelection
              ? selection.node
              : state.doc.nodeAt(selection.from);
          if (node?.type.name === "image") {
            tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              dataAlign: align,
            });
            if (dispatch) dispatch(tr);
            return true;
          }
          return false;
        },
    } as any;
  },
});

// YouTube container width extension — allows resizing YouTube embeds
const YoutubeResize = Extension.create({
  name: "youtubeResize",
  addGlobalAttributes() {
    return [
      {
        types: ["youtube"],
        attributes: {
          containerWidth: {
            default: "100%",
            parseHTML: (element) =>
              element.getAttribute("data-width") ||
              element.style?.maxWidth ||
              "100%",
            renderHTML: (attributes) => {
              const w = attributes.containerWidth || "100%";
              return {
                "data-width": w,
                style:
                  w === "100%"
                    ? ""
                    : `max-width: ${w}; margin-left: auto; margin-right: auto;`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setYoutubeWidth:
        (width: string) =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { selection } = state;
          const node =
            selection instanceof NodeSelection
              ? selection.node
              : state.doc.nodeAt(selection.from);
          if (node?.type.name === "youtube") {
            tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              containerWidth: width,
            });
            if (dispatch) dispatch(tr);
            return true;
          }
          return false;
        },
    } as any;
  },
});

export const defaultExtensions = [
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  StarterKit.configure({
    codeBlock: false,
    horizontalRule: false,
    code: false,
  }),
  CustomCode,
  UpdatedImage.configure({
    allowBase64: false,
    HTMLAttributes: {
      class: "rounded-lg",
    },
  }),
  TiptapLink.configure({
    HTMLAttributes: {
      class:
        "text-foreground underline underline-offset-4 hover:text-muted-foreground cursor-pointer",
    },
    openOnClick: false,
  }),
  TiptapUnderline,
  TextStyle,
  FontSize,
  CodeBlockLowlight.configure({
    lowlight,
  }),
  HorizontalRule,
  Youtube.configure({
    HTMLAttributes: {
      class: "rounded-lg",
    },
    inline: false,
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return `Heading ${node.attrs.level}`;
      }
      return "Press '/' for commands...";
    },
  }),
  SlashCommand,
  ImageAlign,
  YoutubeResize,
  Callout,
  Bookmark,
  Embed,
];
