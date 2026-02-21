import { Node, mergeAttributes } from "@tiptap/core";

export interface BookmarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attributes: {
        url: string;
        title?: string;
        description?: string;
        favicon?: string;
      }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create<BookmarkOptions>({
  name: "bookmark",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      favicon: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-bookmark]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-bookmark": "",
        class: "bookmark-card",
      }),
      [
        "a",
        { href: HTMLAttributes.url, target: "_blank", rel: "noopener" },
        [
          "div",
          { class: "bookmark-content" },
          [
            "div",
            { class: "bookmark-title" },
            HTMLAttributes.title || HTMLAttributes.url,
          ],
          ...(HTMLAttributes.description
            ? [
                [
                  "div",
                  { class: "bookmark-description" },
                  HTMLAttributes.description,
                ],
              ]
            : []),
          [
            "div",
            { class: "bookmark-url" },
            ...(HTMLAttributes.favicon
              ? [
                  [
                    "img",
                    {
                      src: HTMLAttributes.favicon,
                      class: "bookmark-favicon",
                      alt: "",
                    },
                  ],
                ]
              : []),
            HTMLAttributes.url,
          ],
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attributes) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: attributes }).run(),
    };
  },
});

export default Bookmark;
