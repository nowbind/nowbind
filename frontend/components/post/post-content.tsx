"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { CodeBlock } from "@/components/post/code-block";
import type { Components } from "react-markdown";

interface PostContentProps {
  content: string;
}

export function PostContent({ content }: PostContentProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial client render, use standard <pre><code> (valid HTML,
  // identical on server and client, no hydration mismatch). After mount, swap in
  // CodeBlock with syntax highlighting.
  const components: Components = mounted
    ? {
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
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
