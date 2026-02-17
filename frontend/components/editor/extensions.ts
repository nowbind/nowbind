import {
  StarterKit,
  UpdatedImage,
  TiptapLink,
  TiptapUnderline,
  CodeBlockLowlight,
  Youtube,
  TextStyle,
} from "novel";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Placeholder from "@tiptap/extension-placeholder";
import { common, createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";
import { Callout } from "./extensions/callout";
import { Bookmark } from "./extensions/bookmark";
import { SlashCommandList, commandGroups } from "./slash-command-list";

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
          allTitles.filter((t) => t.toLowerCase().includes(query.toLowerCase())),
        command: ({
          editor,
          range,
          props,
        }: {
          editor: any;
          range: any;
          props: any;
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
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
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
            parseHTML: (element) => element.getAttribute("data-align") || "center",
            renderHTML: (attributes) => {
              const align = attributes.dataAlign || "center";
              const styles: Record<string, string> = {
                left: "display: block; margin-right: auto;",
                center: "display: block; margin-left: auto; margin-right: auto;",
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
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          const node = selection.node ?? state.doc.nodeAt(selection.from);
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
              element.getAttribute("data-width") || element.style?.maxWidth || "100%",
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
        ({ tr, state, dispatch }: any) => {
          const { selection } = state;
          const node = selection.node ?? state.doc.nodeAt(selection.from);
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
  StarterKit.configure({
    codeBlock: false,
    horizontalRule: false,
  }),
  UpdatedImage.configure({
    allowBase64: false,
    HTMLAttributes: {
      class: "rounded-lg",
    },
  }),
  TiptapLink.configure({
    HTMLAttributes: {
      class: "text-foreground underline underline-offset-4 hover:text-muted-foreground cursor-pointer",
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
  Markdown.configure({
    html: true,
    transformPastedText: true,
    transformCopiedText: true,
  }),
];
