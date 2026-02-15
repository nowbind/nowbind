"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostCard } from "@/components/post/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Post, Tag, PaginatedResponse } from "@/lib/types";
import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";

export default function ExplorePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [trending, setTrending] = useState<Post[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<PaginatedResponse<Post>>("/posts", {
        page: String(page),
        per_page: "10",
      }),
      page === 1 ? api.get<Tag[]>("/tags") : Promise.resolve(null),
      page === 1 ? api.get<Post[]>("/posts/trending").catch(() => []) : Promise.resolve(null),
    ])
      .then(([postsRes, tagsRes, trendingRes]) => {
        setPosts(postsRes.data || []);
        setTotalPages(postsRes.total_pages);
        if (tagsRes) setTags(tagsRes || []);
        if (trendingRes) setTrending(trendingRes || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="mb-2 text-2xl font-bold">Explore</h1>
          <p className="mb-6 text-muted-foreground">
            Discover posts from the NowBind community.
          </p>

          {/* Trending section */}
          {trending.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Trending
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {trending.slice(0, 4).map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.slug}`}
                    className="group rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <h3 className="text-sm font-medium tracking-tight line-clamp-2 group-hover:text-muted-foreground">
                      {post.title}
                    </h3>
                    {post.author && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {post.author.display_name || post.author.username}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link key={tag.id} href={`/tag/${tag.slug}`}>
                  <Badge variant="outline" className="cursor-pointer">
                    {tag.name}
                    <span className="ml-1 text-muted-foreground">
                      {tag.post_count}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 border-b pb-6">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              <p className="text-muted-foreground">
                No posts published yet. Be the first!
              </p>
            </div>
          ) : (
            <>
              <div>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
