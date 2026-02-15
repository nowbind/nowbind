"use client";

import { Button } from "@/components/ui/button";
import { useLike } from "@/lib/hooks/use-social";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  postId: string;
  initialLiked?: boolean;
  initialCount?: number;
}

export function LikeButton({ postId, initialLiked = false, initialCount = 0 }: LikeButtonProps) {
  const { isLiked, count, toggle, loading } = useLike(initialLiked, initialCount);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggle(postId)}
      disabled={loading}
      className="gap-1.5 text-muted-foreground"
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          isLiked && "fill-red-500 text-red-500"
        )}
      />
      {count > 0 && <span className="text-xs">{count}</span>}
    </Button>
  );
}
