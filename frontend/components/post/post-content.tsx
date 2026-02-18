"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import createDOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { CodeBlock } from "@/components/post/code-block";
import type { Components } from "react-markdown";
import { generateHTML } from "@tiptap/html";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import TiptapLink from "@tiptap/extension-link";
import TiptapUnderline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Youtube from "@tiptap/extension-youtube";
import { common, createLowlight } from "lowlight";
import { Callout } from "@/components/editor/extensions/callout";
import { Bookmark } from "@/components/editor/extensions/bookmark";
import { Embed } from "@/components/editor/extensions/embed";

const lowlight = createLowlight(common);

// Rendering-only extensions for generateHTML
const FontSizeRender = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
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
    }];
  },
});

const ImageAlignRender = Extension.create({
  name: "imageAlign",
  addGlobalAttributes() {
    return [{
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
            return { "data-align": align, style: styles[align] || styles.center };
          },
        },
      },
    }];
  },
});

const YoutubeResizeRender = Extension.create({
  name: "youtubeResize",
  addGlobalAttributes() {
    return [{
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
              style: w === "100%" ? "" : `max-width: ${w}; margin-left: auto; margin-right: auto;`,
            };
          },
        },
      },
    }];
  },
});

const tiptapExtensions = [
  StarterKit.configure({ codeBlock: false, horizontalRule: false }),
  TiptapImage,
  TiptapLink,
  TiptapUnderline,
  TextStyle,
  FontSizeRender,
  ImageAlignRender,
  YoutubeResizeRender,
  CodeBlockLowlight.configure({ lowlight }),
  HorizontalRule,
  Youtube,
  Callout,
  Bookmark,
  Embed,
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

interface PostContentProps {
  content: string;
  contentJSON?: string;
  contentFormat?: "markdown" | "tiptap";
}

export function PostContent({ content, contentJSON, contentFormat }: PostContentProps) {
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Add IDs to headings for TOC anchor linking
  const addHeadingIds = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const headings = el.querySelectorAll("h2, h3");
    const usedIds = new Set<string>();
    headings.forEach((heading) => {
      if (heading.id) return;
      let id = slugify(heading.textContent || "");
      if (usedIds.has(id)) {
        let i = 1;
        while (usedIds.has(`${id}-${i}`)) i++;
        id = `${id}-${i}`;
      }
      usedIds.add(id);
      heading.id = id;
    });
  }, []);

  // TipTap JSON rendering
  const tiptapHTML = useMemo(() => {
    if (contentFormat === "tiptap" && contentJSON) {
      try {
        const json = JSON.parse(contentJSON);
        return generateHTML(json, tiptapExtensions);
      } catch {
        return null;
      }
    }
    return null;
  }, [contentJSON, contentFormat]);

  if (tiptapHTML) {
    return (
      <div
        className="tiptap-content"
        ref={(el) => { contentRef.current = el; addHeadingIds(el); }}
        dangerouslySetInnerHTML={{ __html: (() => {
          const purify = createDOMPurify(window);
          const clean = purify.sanitize(tiptapHTML, {
            ADD_TAGS: ["iframe"],
            ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "src", "sandbox", "loading"],
            ALLOWED_URI_REGEXP: /^(?:(?:https?):\/\/|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
          });
          // Post-process: validate iframe src against whitelist
          const div = document.createElement("div");
          div.innerHTML = clean;
          div.querySelectorAll("iframe").forEach((iframe) => {
            const src = iframe.getAttribute("src") || "";
            const allowedDomains = [
              "youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com",
              "twitter.com", "x.com", "platform.twitter.com",
              "codepen.io",
              "gist.github.com",
            ];
            try {
              const url = new URL(src);
              if (!allowedDomains.some((d) => url.hostname === d || url.hostname.endsWith("." + d))) {
                iframe.remove();
              }
            } catch {
              iframe.remove();
            }
          });
          return div.innerHTML;
        })() }}
      />
    );
  }

  // Heading component that auto-generates IDs for TOC linking
  const createHeading = (level: 2 | 3) => {
    const HeadingComponent = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
      const text = typeof children === "string" ? children : String(children);
      const id = slugify(text);
      const Tag = `h${level}` as const;
      return <Tag id={id} {...props}>{children}</Tag>;
    };
    HeadingComponent.displayName = `H${level}`;
    return HeadingComponent;
  };

  // Fallback: Markdown rendering
  const components: Components = mounted
    ? {
        h2: createHeading(2),
        h3: createHeading(3),
        pre({ children }) {
          return <>{children}</>;
        },
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          if (!match) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          return (
            <CodeBlock language={match[1]}>
              {String(children).replace(/\n$/, "")}
            </CodeBlock>
          );
        },
      }
    : {};

  return (
    <div className="markdown-content" ref={contentRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
