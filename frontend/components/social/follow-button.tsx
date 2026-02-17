"use client";

import { Button } from "@/components/ui/button";
import { useFollow } from "@/lib/hooks/use-social";
import { UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  username: string;
  initialFollowing?: boolean;
  onToggle?: (nowFollowing: boolean) => void;
}

export function FollowButton({ username, initialFollowing = false, onToggle }: FollowButtonProps) {
  const { isFollowing, toggle, loading } = useFollow(initialFollowing);

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onClick={async () => {
        await toggle(username);
        onToggle?.(!isFollowing);
      }}
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
