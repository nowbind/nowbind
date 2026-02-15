"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock } from "lucide-react";
import { LikeButton } from "@/components/social/like-button";
import { BookmarkButton } from "@/components/social/bookmark-button";
import { ShareButtons } from "@/components/social/share-buttons";
import type { Post } from "@/lib/types";

interface PostHeaderProps {
  post: Post;
}

export function PostHeader({ post }: PostHeaderProps) {
  const publishDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <header className="mb-8 space-y-4">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        {post.title}
      </h1>

      {post.subtitle && (
        <p className="text-lg text-muted-foreground">{post.subtitle}</p>
      )}

      <div className="flex items-center gap-4">
        {post.author && (
          <Link
            href={`/author/${post.author.username}`}
            className="flex items-center gap-2"
          >
            <Avatar className="h-8 w-8">
              {post.author.avatar_url && (
                <AvatarImage src={post.author.avatar_url} alt={post.author.display_name || post.author.username} />
              )}
              <AvatarFallback className="text-xs">
                {post.author.display_name?.[0]?.toUpperCase() ||
                  post.author.username?.[0]?.toUpperCase() ||
                  "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {post.author.display_name || post.author.username}
            </span>
          </Link>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {publishDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {publishDate}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {post.reading_time} min read
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <LikeButton postId={post.id} initialLiked={post.is_liked} initialCount={post.like_count} />
          <BookmarkButton postId={post.id} initialBookmarked={post.is_bookmarked} />
        </div>
        <ShareButtons url={`/post/${post.slug}`} title={post.title} />
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Link key={tag.id} href={`/tag/${tag.slug}`}>
              <Badge variant="secondary">{tag.name}</Badge>
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
