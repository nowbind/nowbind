"use client";

import { Button } from "@/components/ui/button";
import { useFollow } from "@/lib/hooks/use-social";
import { UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  username: string;
  initialFollowing?: boolean;
}

export function FollowButton({ username, initialFollowing = false }: FollowButtonProps) {
  const { isFollowing, toggle, loading } = useFollow(initialFollowing);

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={() => toggle(username)}
      disabled={loading}
    >
      {isFollowing ? (
        <>
          <UserCheck className="h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow
        </>
      )}
    </Button>
  );
}
