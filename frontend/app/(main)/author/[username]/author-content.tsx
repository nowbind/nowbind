"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PostCard } from "@/components/post/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FollowButton } from "@/components/social/follow-button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Post, User, PaginatedResponse } from "@/lib/types";
import { Globe, Twitter, Github } from "lucide-react";

interface AuthorContentProps {
  username: string;
  initialAuthor: User | null;
  initialPosts: Post[];
}

export function AuthorContent({
  username,
  initialAuthor,
  initialPosts,
}: AuthorContentProps) {
  const { user: me } = useAuth();
  const [author, setAuthor] = useState<User | null>(initialAuthor);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(!initialAuthor);

  useEffect(() => {
    if (initialAuthor) return;
    Promise.all([
      api.get<User>(`/users/${username}`),
      api.get<PaginatedResponse<Post>>(`/users/${username}/posts`),
    ])
      .then(([user, postsRes]) => {
        setAuthor(user);
        setPosts(postsRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username, initialAuthor]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
      </div>
    );
  }

  if (!author) {
    return <p className="text-muted-foreground">Author not found.</p>;
  }

  return (
    <>
      <div className="mb-8 flex items-start gap-4">
        <Avatar className="h-16 w-16">
          {author.avatar_url && (
            <AvatarImage
              src={author.avatar_url}
              alt={author.display_name || author.username}
            />
          )}
          <AvatarFallback className="text-xl">
            {author.display_name?.[0]?.toUpperCase() ||
              author.username?.[0]?.toUpperCase() ||
              "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              {author.display_name || author.username}
            </h1>
            {me && me.id !== author.id && (
              <FollowButton
                username={author.username}
                initialFollowing={author.is_following}
                onToggle={(nowFollowing) => {
                  setAuthor((prev) =>
                    prev
                      ? {
                          ...prev,
                          follower_count: prev.follower_count + (nowFollowing ? 1 : -1),
                          is_following: nowFollowing,
                        }
                      : prev
                  );
                }}
              />
            )}
          </div>
          {author.bio && (
            <p className="mt-2 text-sm">{author.bio}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href={`/author/${username}/followers`}
              className="hover:text-foreground"
            >
              <span className="font-medium text-foreground">
                {author.follower_count}
              </span>{" "}
              followers
            </Link>
            <Link
              href={`/author/${username}/following`}
              className="hover:text-foreground"
            >
              <span className="font-medium text-foreground">
                {author.following_count}
              </span>{" "}
              following
            </Link>
          </div>
          {/* Social links */}
          {(author.website || author.twitter_url || author.github_url) && (
            <div className="mt-3 flex items-center gap-3">
              {author.website && (
                <a
                  href={author.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline">Website</span>
                </a>
              )}
              {author.twitter_url && (
                <a
                  href={author.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Twitter className="h-4 w-4" />
                  <span className="hidden sm:inline">Twitter</span>
                </a>
              )}
              {author.github_url && (
                <a
                  href={author.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Github className="h-4 w-4" />
                  <span className="hidden sm:inline">GitHub</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Posts</h2>
      {posts.length > 0 ? (
        <div>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No published posts yet.</p>
      )}
    </>
  );
}
