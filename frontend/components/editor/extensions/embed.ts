import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { EmbedComponent } from "./embed-component";
import {
  extractTwitterId,
  extractGistInfo,
  extractCodePenParts,
  detectProvider,
} from "./embed-utils";

export interface EmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attributes: { provider: string; url: string }) => ReturnType;
    };
  }
}

export const Embed = Node.create<EmbedOptions>({
  name: "embed",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      provider: {
        default: "twitter",
        parseHTML: (el) => el.getAttribute("data-embed-provider") || "twitter",
        renderHTML: (attrs) => ({ "data-embed-provider": attrs.provider }),
      },
      url: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-embed-url") || "",
        renderHTML: (attrs) => ({ "data-embed-url": attrs.url }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const provider = HTMLAttributes["data-embed-provider"] || "twitter";
    const url = HTMLAttributes["data-embed-url"] || "";

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes, {
      "data-embed": "",
      "data-embed-provider": provider,
      "data-embed-url": url,
      class: `embed-wrapper embed-${provider}`,
    });

    if (provider === "twitter") {
      const tweetId = extractTwitterId(url);
      if (tweetId) {
        return [
          "div",
          wrapperAttrs,
          [
            "iframe",
            {
              src: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`,
              sandbox: "allow-scripts allow-same-origin allow-popups",
              loading: "lazy",
              style:
                "width: 100%; min-height: 350px; border: none; border-radius: 0.75rem;",
            },
          ],
        ];
      }
    }

    if (provider === "codepen") {
      const parts = extractCodePenParts(url);
      if (parts) {
        return [
          "div",
          wrapperAttrs,
          [
            "iframe",
            {
              src: `https://codepen.io/${parts.user}/embed/${parts.pen}?default-tab=result`,
              sandbox:
                "allow-scripts allow-same-origin allow-popups allow-forms",
              loading: "lazy",
              style:
                "width: 100%; height: 400px; border: none; border-radius: 0.75rem;",
            },
          ],
        ];
      }
    }

    if (provider === "gist") {
      const info = extractGistInfo(url);
      return [
        "div",
        wrapperAttrs,
        [
          "a",
          {
            href: url,
            target: "_blank",
            rel: "noopener",
            class: "embed-gist-link",
          },
          [
            "div",
            { class: "embed-gist-content" },
            [
              "div",
              { class: "embed-gist-title" },
              info ? `${info.user}/${info.id.slice(0, 8)}...` : "GitHub Gist",
            ],
            ["div", { class: "embed-gist-url" }, url],
          ],
        ],
      ];
    }

    // Fallback: plain link
    return [
      "div",
      wrapperAttrs,
      ["a", { href: url, target: "_blank", rel: "noopener" }, url],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedComponent);
  },

  addCommands() {
    return {
      setEmbed:
        (attributes) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: attributes }).run(),
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text || !text.match(/^https?:\/\/\S+$/)) return false;

            const provider = detectProvider(text);
            if (!provider) return false;

            // YouTube has its own dedicated extension
            if (provider === "youtube") {
              editor.chain().setYoutubeVideo({ src: text }).run();
              return true;
            }

            editor.chain().setEmbed({ provider, url: text }).run();
            return true;
          },
        },
      }),
    ];
  },
});

export default Embed;
