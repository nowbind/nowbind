"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostCard } from "@/components/post/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FollowButton } from "@/components/social/follow-button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Post, User, PaginatedResponse } from "@/lib/types";

interface Props {
  params: Promise<{ username: string }>;
}

export default function AuthorPage({ params }: Props) {
  const { username } = use(params);
  const { user: me } = useAuth();
  const [author, setAuthor] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [username]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-60" />
                </div>
              </div>
            </div>
          ) : author ? (
            <>
              <div className="mb-8 flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  {author.avatar_url && (
                    <AvatarImage src={author.avatar_url} alt={author.display_name || author.username} />
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
                      <FollowButton username={author.username} initialFollowing={author.is_following} />
                    )}
                  </div>
                  {author.bio && (
                    <p className="mt-1 text-sm text-muted-foreground">{author.bio}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <Link href={`/author/${username}/followers`} className="hover:text-foreground">
                      <span className="font-medium text-foreground">{author.follower_count}</span> followers
                    </Link>
                    <Link href={`/author/${username}/following`} className="hover:text-foreground">
                      <span className="font-medium text-foreground">{author.following_count}</span> following
                    </Link>
                  </div>
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
                <p className="text-muted-foreground">
                  No published posts yet.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Author not found.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
