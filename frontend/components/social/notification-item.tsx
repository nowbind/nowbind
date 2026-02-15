"use client";

import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, UserPlus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const icon = {
    new_follower: <UserPlus className="h-4 w-4 text-blue-500" />,
    new_like: <Heart className="h-4 w-4 text-red-500" />,
    new_comment: <MessageSquare className="h-4 w-4 text-green-500" />,
  }[notification.type];

  const message = {
    new_follower: "started following you",
    new_like: `liked your post "${notification.post?.title || "a post"}"`,
    new_comment: `commented on "${notification.post?.title || "a post"}"`,
  }[notification.type];

  const href = notification.type === "new_follower"
    ? `/author/${notification.actor?.username}`
    : `/post/${notification.post?.slug || ""}`;

  const timeAgo = formatTimeAgo(notification.created_at);

  return (
    <Link
      href={href}
      onClick={() => !notification.read && onRead?.(notification.id)}
      className={cn(
        "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent",
        !notification.read && "bg-accent/50"
      )}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {notification.actor && (
            <Avatar className="h-5 w-5">
              {notification.actor.avatar_url && (
                <AvatarImage src={notification.actor.avatar_url} alt="" />
              )}
              <AvatarFallback className="text-[10px]">
                {notification.actor.display_name?.[0]?.toUpperCase() || notification.actor.username?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          )}
          <p className="text-sm truncate">
            <span className="font-medium">
              {notification.actor?.display_name || notification.actor?.username}
            </span>{" "}
            {message}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
      </div>
      {!notification.read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </Link>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
