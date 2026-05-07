"use client";

import { Sparkles, X } from "lucide-react";

interface TagSuggestion {
  keyword: string;
  score: number;
  is_existing_tag: boolean;
}

interface TagSuggestionsProps {
  suggestions: TagSuggestion[];
  isLoading: boolean;
  onAccept: (keyword: string) => void;
  onDismiss: (keyword: string) => void;
}

export function TagSuggestions({
  suggestions,
  isLoading,
  onAccept,
  onDismiss,
}: TagSuggestionsProps) {
  if (!isLoading && suggestions.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Suggested tags</span>
        {isLoading && (
          <span className="animate-pulse text-xs">· analyzing…</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <div
            key={s.keyword}
            className="flex items-center gap-0.5 rounded-full border border-dashed
                       border-primary/40 bg-primary/5 px-2.5 py-0.5 text-xs
                       hover:border-primary/70 transition-colors group"
          >
            {/* Clicking the keyword text accepts it */}
            <button
              type="button"
              onClick={() => onAccept(s.keyword)}
              className="text-foreground/80 hover:text-foreground leading-none cursor-pointer"
              title={
                s.is_existing_tag
                  ? "Add existing tag"
                  : "Add as new tag"
              }
            >
              {s.keyword}
              {!s.is_existing_tag && (
                <span className="ml-1 text-muted-foreground text-[10px]">new</span>
              )}
            </button>

            {/* X to dismiss without accepting */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(s.keyword);
              }}
              className="ml-1 text-muted-foreground/50 hover:text-muted-foreground
                         opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Dismiss suggestion"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
