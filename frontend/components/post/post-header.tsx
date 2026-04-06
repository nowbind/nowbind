"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LikeButton } from "@/components/social/like-button";
import { BookmarkButton } from "@/components/social/bookmark-button";
import { ShareButtons } from "@/components/social/share-buttons";
import { PenLine } from "lucide-react";
import { FollowButton } from "@/components/social/follow-button";
import { Button } from "@/components/ui/button";
import { TTSPlayer } from "@/components/post/tts-player";
import { useAuth } from "@/lib/hooks/use-auth";
import { api } from "@/lib/api";
import type { Post, User } from "@/lib/types";

interface PostHeaderProps {
  post: Post;
}

export function PostHeader({ post }: PostHeaderProps) {
  const { user, loading: authLoading } = useAuth();
  // SSR fetch doesn't send user cookies, so re-fetch like/bookmark state client-side
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked ?? false);
  const [authorFollowing, setAuthorFollowing] = useState(
    post.author?.is_following ?? false,
  );

  useEffect(() => {
    // Wait for AuthProvider to finish (and potentially refresh the token)
    // before re-fetching, otherwise OptionalAuth silently ignores expired tokens
    if (authLoading || !user) return;

    const followStatePromise = post.author
      ? api.getSilent<User>(`/users/${post.author.username}`)
      : Promise.resolve(null);

    Promise.all([
      api.getSilent<Post>(`/posts/${post.slug}`),
      followStatePromise,
    ])
      .then(([p, author]) => {
        if (p.is_liked !== undefined) setLiked(p.is_liked);
        if (p.is_bookmarked !== undefined) setBookmarked(p.is_bookmarked);
        if (author?.is_following !== undefined) {
          setAuthorFollowing(author.is_following);
        }
      })
      .catch((err) => console.error("Failed to load author data:", err));
  }, [post.slug, post.author, user, authLoading]);
  const publishDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <header className="mb-8 space-y-4">
      {/* Feature image hero */}
      {post.feature_image && (
        <div className="mb-6">
          <img
            src={post.feature_image}
            alt=""
            className="w-full max-h-[28rem] rounded-lg object-cover"
          />
        </div>
      )}

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
        {post.title}
      </h1>

      {post.subtitle && (
        <p className="text-lg text-muted-foreground">{post.subtitle}</p>
      )}

      <div className="flex items-start justify-between gap-3">
        {post.author && (
          <Link
            href={`/author/${post.author.username}`}
            className="min-w-0 flex items-center gap-2"
          >
            <Avatar className="h-8 w-8">
              {post.author.avatar_url && (
                <AvatarImage
                  src={post.author.avatar_url}
                  alt={post.author.display_name || post.author.username}
                />
              )}
              <AvatarFallback className="text-xs">
                {post.author.display_name?.[0]?.toUpperCase() ||
                  post.author.username?.[0]?.toUpperCase() ||
                  "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {post.author.display_name || post.author.username}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {publishDate && <span>{publishDate}</span>}
                {publishDate && <span>&middot;</span>}
                <span>{post.reading_time} min read</span>
              </span>
            </div>
          </Link>
        )}
        {!authLoading && !user && post.author && (
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Follow</Link>
          </Button>
        )}
        {user && post.author && user.id !== post.author.id && (
          <FollowButton
            username={post.author.username}
            initialFollowing={authorFollowing}
            onToggle={setAuthorFollowing}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-y py-2">
        <div className="flex items-center gap-1">
          <LikeButton
            postId={post.id}
            initialLiked={liked}
            initialCount={post.like_count}
          />
          <BookmarkButton postId={post.id} initialBookmarked={bookmarked} />
        </div>
        <div className="flex items-center gap-2">
          {user && post.author && user.id === post.author.id && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              asChild
            >
              <Link href={`/editor/${post.slug}`}>
                <PenLine className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            </Button>
          )}
          <TTSPlayer />
          <ShareButtons url={`/post/${post.slug}`} title={post.title} />
        </div>
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
