"use client";

import { Button } from "@/components/ui/button";
import { useBookmark } from "@/lib/hooks/use-social";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  postId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({ postId, initialBookmarked = false }: BookmarkButtonProps) {
  const { isBookmarked, toggle, loading } = useBookmark(initialBookmarked);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => toggle(postId)}
      disabled={loading}
      className="text-muted-foreground"
    >
      <Bookmark
        className={cn(
          "h-4 w-4 transition-colors",
          isBookmarked && "fill-current text-foreground"
        )}
      />
      <span className="sr-only">{isBookmarked ? "Remove bookmark" : "Bookmark"}</span>
    </Button>
  );
}
