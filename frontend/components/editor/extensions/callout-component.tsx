"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import { Info, AlertTriangle, Lightbulb, StickyNote } from "lucide-react";

const calloutTypes = ["info", "warning", "tip", "note"] as const;
type CalloutType = (typeof calloutTypes)[number];

const calloutConfig: Record<
  CalloutType,
  {
    icon: typeof Info;
    label: string;
    border: string;
    bg: string;
    iconColor: string;
  }
> = {
  info: {
    icon: Info,
    label: "Info",
    border: "border-blue-500 dark:border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-500 dark:text-blue-400",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    border: "border-amber-500 dark:border-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  tip: {
    icon: Lightbulb,
    label: "Tip",
    border: "border-green-500 dark:border-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-500 dark:text-green-400",
  },
  note: {
    icon: StickyNote,
    label: "Note",
    border: "border-gray-500 dark:border-gray-400",
    bg: "bg-gray-50 dark:bg-gray-950/30",
    iconColor: "text-gray-500 dark:text-gray-400",
  },
};

export function CalloutComponent({ node, updateAttributes }: any) {
  const type = (node.attrs.type || "info") as CalloutType;
  const config = calloutConfig[type] || calloutConfig.info;
  const Icon = config.icon;

  const cycleType = () => {
    const currentIndex = calloutTypes.indexOf(type);
    const nextIndex = (currentIndex + 1) % calloutTypes.length;
    updateAttributes({ type: calloutTypes[nextIndex] });
  };

  return (
    <NodeViewWrapper>
      <div
        className={`border-l-4 ${config.border} ${config.bg} rounded-r-lg p-4 my-2 flex items-start gap-3`}
      >
        <button
          type="button"
          contentEditable={false}
          onClick={cycleType}
          className={`mt-0.5 shrink-0 cursor-pointer ${config.iconColor} opacity-80 hover:opacity-100 transition-opacity`}
          title={`${config.label} — click to change type`}
        >
          <Icon className="h-5 w-5" />
        </button>
        <NodeViewContent className="flex-1 min-w-0 outline-none" />
      </div>
    </NodeViewWrapper>
  );
}
