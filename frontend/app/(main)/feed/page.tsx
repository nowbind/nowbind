"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostCard } from "@/components/post/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Post, PaginatedResponse } from "@/lib/types";
import { Rss, Keyboard } from "lucide-react";
import { useKeyboardNav } from "@/lib/hooks/use-keyboard-nav";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import Link from "next/link";

// ---------- Skeleton ----------

function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-4 border-b py-6 first:pt-0">
          {/* Text content */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Title */}
            <Skeleton className="h-6 w-3/4" />
            {/* Excerpt lines */}
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            {/* Meta row: avatar + author + date + read time */}
            <div className="flex items-center gap-3 pt-1">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            {/* Tags row */}
            <div className="flex gap-1.5 pt-0.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          </div>
          {/* Thumbnail (hidden on mobile, matches sm:block) */}
          <Skeleton className="hidden sm:block h-28 w-40 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ---------- Infinite Scroll Hook ----------

function useInfiniteScroll(
  onLoadMore: () => void,
  loading: boolean,
  hasMore: boolean,
) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const callbackRef = useRef(onLoadMore);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);

  useEffect(() => {
    callbackRef.current = onLoadMore;
    loadingRef.current = loading;
    hasMoreRef.current = hasMore;
  }, [onLoadMore, loading, hasMore]);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreRef.current && !loadingRef.current) {
          callbackRef.current();
        }
      },
      { rootMargin: "300px", threshold: 0 },
    );
    observerRef.current.observe(node);
  }, []);

  return sentinelRef;
}

// ---------- Main Page ----------

const POSTS_PER_PAGE = 10;

export default function FeedPage() {
  const { user, loading: authLoading } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const pageRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Initial load
  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    pageRef.current = 1;
    api
      .get<PaginatedResponse<Post>>("/feed", {
        page: "1",
        per_page: String(POSTS_PER_PAGE),
      })
      .then((res) => {
        setPosts(res.data || []);
        setHasMore((res.page || 1) < (res.total_pages || 1));
      })
      .catch((err) => console.error("Failed to load feed:", err))
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  // Load more on scroll
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !user) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    api
      .get<PaginatedResponse<Post>>("/feed", {
        page: String(nextPage),
        per_page: String(POSTS_PER_PAGE),
      })
      .then((res) => {
        pageRef.current = nextPage;
        setPosts((prev) => [...prev, ...(res.data || [])]);
        setHasMore(nextPage < (res.total_pages || 1));
      })
      .catch((err) => console.error("Failed to load more feed:", err))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, user]);

  const sentinelRef = useInfiniteScroll(loadMore, loadingMore, hasMore);

  const { focusedIndex, showHelp, setShowHelp } = useKeyboardNav({
    posts,
    enabled: !authLoading && !!user && !loading,
    isAuthenticated: !!user,
    onPostsChange: (updater) => setPosts((prev) => updater(prev)),
  });

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center px-4">
          <Rss className="h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Your Feed</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in and follow authors to see their posts here.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold">Your Feed</h1>
              <p className="text-muted-foreground">
                Posts from authors you follow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
              title="Keyboard shortcuts"
              aria-label="Open keyboard shortcuts"
            >
              <Keyboard className="h-3 w-3" />
              <kbd className="font-mono">?</kbd>
            </button>
          </div>

          <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />

          {loading ? (
            <PostListSkeleton />
          ) : posts.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              <p className="text-muted-foreground">
                No posts in your feed yet. Follow some authors to see their
                posts here.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/explore">Discover authors</Link>
              </Button>
            </div>
          ) : (
            <>
              <div>
                {posts.map((post, i) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    focused={focusedIndex === i}
                    data-post-index={i}
                  />
                ))}
              </div>

              {hasMore && (
                <div ref={sentinelRef} className="py-4">
                  {loadingMore ? <PostListSkeleton /> : <div className="h-10" />}
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