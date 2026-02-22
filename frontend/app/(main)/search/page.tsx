"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostCard } from "@/components/post/post-card";
import { FollowButton } from "@/components/social/follow-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Post, Tag, User } from "@/lib/types";
import {
  ArrowRight,
  Hash,
  Loader2,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

type SearchTab = "posts" | "authors";

function buildSuggestedAuthors(posts: Post[], currentUserID?: string): User[] {
  const seen = new Set<string>();
  const authors: User[] = [];

  for (const post of posts) {
    const author = post.author;
    if (!author) continue;
    if (currentUserID && author.id === currentUserID) continue;
    if (seen.has(author.id)) continue;
    seen.add(author.id);
    authors.push(author);
  }

  return authors;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryParam = useMemo(() => (searchParams.get("q") || "").trim(), [searchParams]);

  const [query, setQuery] = useState(queryParam);
  const [debouncedQuery, setDebouncedQuery] = useState(queryParam);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [authorResults, setAuthorResults] = useState<User[]>([]);
  const [authorTotal, setAuthorTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<SearchTab>("posts");
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [topics, setTopics] = useState<Tag[]>([]);
  const [authorsToFollow, setAuthorsToFollow] = useState<User[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const searchRequestID = useRef(0);
  const prevURLQueryRef = useRef(queryParam);

  useEffect(() => {
    // Only sync from URL when query param changed externally (e.g. browser back/forward),
    // not while the user is actively typing.
    if (queryParam !== prevURLQueryRef.current) {
      setQuery(queryParam);
      setDebouncedQuery(queryParam);
      prevURLQueryRef.current = queryParam;
    }
  }, [queryParam]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setDiscoverLoading(true);

    Promise.all([
      api.get<Post[]>("/posts/trending", { limit: "8" }).catch(() => [] as Post[]),
      api
        .get<Tag[]>("/tags", { page: "1", per_page: "14" })
        .catch(() => [] as Tag[]),
    ])
      .then(async ([trendingRes, tagsRes]) => {
        if (cancelled) return;
        setTrendingPosts(trendingRes || []);
        setTopics(tagsRes || []);

        const baseAuthors = buildSuggestedAuthors(trendingRes || [], user?.id).slice(0, 6);
        if (!user || baseAuthors.length === 0) {
          setAuthorsToFollow(baseAuthors);
          return;
        }

        const enriched = await Promise.all(
          baseAuthors.map((author) =>
            api
              .getSilent<User>(`/users/${author.username}`)
              .then((fresh) => (fresh ? { ...author, is_following: fresh.is_following } : author))
              .catch(() => author)
          )
        );

        if (!cancelled) {
          setAuthorsToFollow(enriched);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDiscoverLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const currentQuery = debouncedQuery.trim();
    const requestID = ++searchRequestID.current;

    if (typeof window !== "undefined") {
      const url = currentQuery ? `/search?q=${encodeURIComponent(currentQuery)}` : "/search";
      window.history.replaceState(window.history.state, "", url);
      prevURLQueryRef.current = currentQuery;
    }

    if (!currentQuery) {
      setPostResults([]);
      setPostTotal(0);
      setAuthorResults([]);
      setAuthorTotal(0);
      setActiveTab("posts");
      setSearching(false);
      setSearchFailed(false);
      return;
    }

    setSearching(true);
    setSearchFailed(false);

    const postsReq = api
      .get<{ posts: Post[]; total: number }>("/search", {
        q: currentQuery,
        page: "1",
        per_page: "20",
      })
      .then((res) => ({ ok: true as const, res }))
      .catch(() => ({ ok: false as const, res: null }));

    const authorsReq = api
      .get<{ authors: User[]; total: number }>("/search/authors", {
        q: currentQuery,
        page: "1",
        per_page: "20",
      })
      .then((res) => ({ ok: true as const, res }))
      .catch(() => ({ ok: false as const, res: null }));

    Promise.all([postsReq, authorsReq])
      .then(([postsResp, authorsResp]) => {
        if (searchRequestID.current !== requestID) return;

        const nextPostResults = postsResp.ok ? postsResp.res?.posts || [] : [];
        const nextPostTotal = postsResp.ok ? postsResp.res?.total || 0 : 0;
        const nextAuthorResults = authorsResp.ok ? authorsResp.res?.authors || [] : [];
        const nextAuthorTotal = authorsResp.ok ? authorsResp.res?.total || 0 : 0;

        setPostResults(nextPostResults);
        setPostTotal(nextPostTotal);
        setAuthorResults(nextAuthorResults);
        setAuthorTotal(nextAuthorTotal);
        setSearchFailed(!postsResp.ok && !authorsResp.ok);

        setActiveTab((prev) => {
          if (prev === "posts" && nextPostResults.length === 0 && nextAuthorResults.length > 0) {
            return "authors";
          }
          if (prev === "authors" && nextAuthorResults.length === 0 && nextPostResults.length > 0) {
            return "posts";
          }
          return prev;
        });
      })
      .finally(() => {
        if (searchRequestID.current === requestID) {
          setSearching(false);
        }
      });
  }, [debouncedQuery]);

  const hasQuery = debouncedQuery.length > 0;
  const hasAnySearchResults = postResults.length > 0 || authorResults.length > 0;
  const showDiscovery = !hasQuery || (!searching && !hasAnySearchResults);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Search</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Type to search posts and authors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
          autoFocus
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {hasQuery ? (
        <section className="mb-10">
          {searchFailed ? (
            <p className="text-sm text-destructive">
              Search is temporarily unavailable. Please try again.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("posts")}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    activeTab === "posts"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Posts ({postTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("authors")}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    activeTab === "authors"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Authors ({authorTotal})
                </button>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                {searching
                  ? "Searching..."
                  : activeTab === "posts"
                    ? `${postTotal} post result${postTotal !== 1 ? "s" : ""} for "${debouncedQuery}"`
                    : `${authorTotal} author result${authorTotal !== 1 ? "s" : ""} for "${debouncedQuery}"`}
              </p>

              {searching ? null : activeTab === "posts" ? (
                postResults.length > 0 ? (
                  <div>
                    {postResults.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No posts found for this query.
                  </p>
                )
              ) : authorResults.length > 0 ? (
                <div className="space-y-3">
                  {authorResults.map((author) => (
                    <div
                      key={author.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <Link
                        href={`/author/${author.username}`}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <Avatar className="h-10 w-10">
                          {author.avatar_url && (
                            <AvatarImage src={author.avatar_url} alt="" />
                          )}
                          <AvatarFallback>
                            {(author.display_name || author.username)?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {author.display_name || author.username}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            @{author.username}
                          </p>
                          {author.bio && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {author.bio}
                            </p>
                          )}
                        </div>
                      </Link>

                      {user ? (
                        user.id === author.id ? (
                          <Badge variant="secondary">You</Badge>
                        ) : (
                          <FollowButton
                            username={author.username}
                            initialFollowing={author.is_following}
                            onToggle={(nowFollowing) => {
                              setAuthorResults((prev) =>
                                prev.map((item) =>
                                  item.id === author.id
                                    ? {
                                        ...item,
                                        is_following: nowFollowing,
                                        follower_count: Math.max(
                                          0,
                                          item.follower_count + (nowFollowing ? 1 : -1)
                                        ),
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        )
                      ) : (
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/login">Sign in</Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No authors found for this query.
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">
          Search updates as you type for posts and authors.
        </p>
      )}

      {showDiscovery && (
        <div className="space-y-10">
          {discoverLoading ? (
            <>
              <section>
                <Skeleton className="mb-3 h-4 w-24" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              </section>
              <section>
                <Skeleton className="mb-3 h-4 w-32" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              {trendingPosts.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Trending
                    </h2>
                    <Button variant="link" size="sm" className="h-auto p-0" asChild>
                      <Link href="/explore">
                        Explore
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {trendingPosts.slice(0, 6).map((post, idx) => (
                      <Link
                        key={post.id}
                        href={`/post/${post.slug}`}
                        className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                      >
                        <div className="mb-2 text-xs font-semibold text-muted-foreground">
                          #{idx + 1}
                        </div>
                        <h3 className="line-clamp-2 text-sm font-semibold">
                          {post.title}
                        </h3>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {post.author?.display_name || post.author?.username || "Unknown"}{" "}
                          · {post.reading_time} min read
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {authorsToFollow.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Follow Authors
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {authorsToFollow.map((author) => (
                      <div
                        key={author.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <Link
                          href={`/author/${author.username}`}
                          className="flex min-w-0 items-center gap-2.5"
                        >
                          <Avatar className="h-9 w-9">
                            {author.avatar_url && (
                              <AvatarImage src={author.avatar_url} alt="" />
                            )}
                            <AvatarFallback>
                              {(author.display_name || author.username)?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {author.display_name || author.username}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{author.username}
                            </p>
                          </div>
                        </Link>
                        {user ? (
                          <FollowButton
                            username={author.username}
                            initialFollowing={author.is_following}
                            onToggle={(nowFollowing) => {
                              setAuthorsToFollow((prev) =>
                                prev.map((item) =>
                                  item.id === author.id
                                    ? {
                                        ...item,
                                        is_following: nowFollowing,
                                        follower_count: Math.max(
                                          0,
                                          item.follower_count + (nowFollowing ? 1 : -1)
                                        ),
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        ) : (
                          <Button size="sm" variant="outline" asChild>
                            <Link href="/login">Sign in</Link>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {topics.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" />
                    Topics
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {topics.map((tag) => (
                      <Link key={tag.id} href={`/tag/${tag.slug}`}>
                        <Badge
                          variant="outline"
                          className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {tag.name}
                          <span className="ml-1 text-muted-foreground">
                            {tag.post_count}
                          </span>
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="mx-auto max-w-3xl px-4 py-8">
              <Skeleton className="mb-6 h-8 w-32" />
              <Skeleton className="mb-8 h-10 w-full" />
            </div>
          }
        >
          <SearchContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
