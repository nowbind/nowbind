"use client";

import { NodeViewWrapper } from "@tiptap/react";
import { ExternalLink, X, Code2, Github, MessageCircle } from "lucide-react";
import {
  extractTwitterId,
  extractGistInfo,
  extractCodePenParts,
} from "./embed-utils";

const providerConfig = {
  twitter: {
    icon: MessageCircle,
    label: "Twitter / X",
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-950/20",
    border: "border-sky-200 dark:border-sky-800",
  },
  gist: {
    icon: Github,
    label: "GitHub Gist",
    color: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-50 dark:bg-gray-900/50",
    border: "border-gray-200 dark:border-gray-700",
  },
  codepen: {
    icon: Code2,
    label: "CodePen",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-gray-50 dark:bg-gray-900/50",
    border: "border-gray-200 dark:border-gray-700",
  },
};

export function EmbedComponent({ node, deleteNode, selected }: any) {
  const { provider, url } = node.attrs;
  const config =
    providerConfig[provider as keyof typeof providerConfig] ||
    providerConfig.twitter;
  const Icon = config.icon;

  const renderEmbed = () => {
    if (provider === "twitter") {
      const tweetId = extractTwitterId(url);
      if (tweetId) {
        return (
          <iframe
            src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`}
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
            className="w-full min-h-[350px] border-0 rounded-lg"
          />
        );
      }
    }

    if (provider === "codepen") {
      const parts = extractCodePenParts(url);
      if (parts) {
        return (
          <iframe
            src={`https://codepen.io/${parts.user}/embed/${parts.pen}?default-tab=result`}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            className="w-full h-[400px] border-0 rounded-lg"
          />
        );
      }
    }

    if (provider === "gist") {
      const info = extractGistInfo(url);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors no-underline"
        >
          <Github className="h-8 w-8 text-gray-600 dark:text-gray-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-sm text-foreground">
              {info ? `${info.user}/${info.id.slice(0, 8)}...` : "GitHub Gist"}
            </div>
            <div className="text-xs text-muted-foreground truncate">{url}</div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
        </a>
      );
    }

    // Fallback
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm underline"
      >
        {url}
      </a>
    );
  };

  return (
    <NodeViewWrapper>
      <div
        className={`relative my-3 rounded-xl border ${config.border} ${config.bg} overflow-hidden ${
          selected ? "ring-2 ring-primary" : ""
        }`}
        contentEditable={false}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-inherit">
          <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {config.label}
            </span>
          </div>
          <button
            type="button"
            onClick={deleteNode}
            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Remove embed"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        {/* Content */}
        <div className="p-2">{renderEmbed()}</div>
      </div>
    </NodeViewWrapper>
  );
}
