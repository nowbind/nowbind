"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Post, Tag, PaginatedResponse } from "@/lib/types";
import {
  PenSquare,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  Star,
  ArrowUpDown,
  Search,
  X,
  CheckSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StatusFilter = "" | "draft" | "published";
type SortOption = "newest" | "oldest" | "updated";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    api
      .get<Tag[]>("/users/me/tags")
      .then(setAllTags)
      .catch(() => setAllTags([]));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tagFilter && !allTags.some((tag) => tag.slug === tagFilter)) {
      setTagFilter("");
    }
  }, [allTags, tagFilter]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (tagFilter) params.tag = tagFilter;
    if (sortBy !== "newest") params.sort = sortBy;
    params.per_page = "50";

    api
      .get<PaginatedResponse<Post>>("/users/me/posts", params)
      .then((res) => setPosts(res.data || []))
      .catch((err) => console.error("Failed to load user posts:", err))
      .finally(() => setLoading(false));
  }, [user, authLoading, statusFilter, tagFilter, sortBy]);

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, tagFilter, sortBy, debouncedSearch]);

  const filteredPosts = debouncedSearch
    ? posts.filter((p) =>
        p.title.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : posts;

  const handlePublish = async (id: string) => {
    try {
      await api.post(`/posts/${id}/publish`);
      setPosts(
        posts.map((p) => (p.id === id ? { ...p, status: "published" } : p)),
      );
      toast.success("Post published");
    } catch {
      toast.error("Failed to publish post");
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await api.post(`/posts/${id}/unpublish`);
      setPosts(posts.map((p) => (p.id === id ? { ...p, status: "draft" } : p)));
      toast.success("Post unpublished");
    } catch {
      toast.error("Failed to unpublish post");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/posts/${deleteId}`);
      setPosts(posts.filter((p) => p.id !== deleteId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      setDeleteId(null);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
      setDeleteId(null);
    }
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPosts.map((p) => p.id)));
    }
  };

  const handleBulkPublish = useCallback(async () => {
    setBulkActing(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.post(`/posts/${id}/publish`)),
      );
      setPosts((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, status: "published" as const } : p,
        ),
      );
      toast.success(`${selectedIds.size} post(s) published`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to publish some posts");
    } finally {
      setBulkActing(false);
    }
  }, [selectedIds]);

  const handleBulkUnpublish = useCallback(async () => {
    setBulkActing(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.post(`/posts/${id}/unpublish`)),
      );
      setPosts((prev) =>
        prev.map((p) =>
          selectedIds.has(p.id) ? { ...p, status: "draft" as const } : p,
        ),
      );
      toast.success(`${selectedIds.size} post(s) unpublished`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to unpublish some posts");
    } finally {
      setBulkActing(false);
    }
  }, [selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    setBulkActing(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => api.delete(`/posts/${id}`)),
      );
      setPosts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      toast.success(`${selectedIds.size} post(s) deleted`);
      setSelectedIds(new Set());
    } catch {
      toast.error("Failed to delete some posts");
    } finally {
      setBulkActing(false);
      setBulkDeleteOpen(false);
    }
  }, [selectedIds]);

  const statusTabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "" },
    { label: "Drafts", value: "draft" },
    { label: "Published", value: "published" },
  ];

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: "Newest first", value: "newest" },
    { label: "Oldest first", value: "oldest" },
    { label: "Recently updated", value: "updated" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Your Posts</h1>
            <Button size="sm" asChild>
              <Link href="/editor">
                <PenSquare className="mr-2 h-4 w-4" />
                New Post
              </Link>
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts by title..."
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* Status tabs */}
            <div className="flex rounded-md border">
              {statusTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    statusFilter === tab.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  } ${tab.value === "" ? "rounded-l-md" : ""} ${
                    tab.value === "published" ? "rounded-r-md" : ""
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground"
              >
                <option value="">All tags</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.slug}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sortOptions.find((o) => o.value === sortBy)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sortOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                  >
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2 rounded-lg border p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              {debouncedSearch ? (
                <>
                  <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="mb-1 font-semibold">No matches</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    No posts match &ldquo;{debouncedSearch}&rdquo;
                  </p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <PenSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <h2 className="mb-1 font-semibold">No posts yet</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {statusFilter
                      ? `No ${statusFilter} posts found.`
                      : "Write your first post and share it with the world."}
                  </p>
                  <Button asChild>
                    <Link href="/editor">Create Post</Link>
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-4 py-1">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === filteredPosts.length &&
                    filteredPosts.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : "Select all"}
                </span>
              </div>

              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className={`flex items-center gap-3 rounded-lg border p-4 ${
                    selectedIds.has(post.id)
                      ? "border-primary/50 bg-primary/5"
                      : ""
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(post.id)}
                    onChange={() => toggleSelect(post.id)}
                    className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                  />

                  {/* Feature image thumbnail */}
                  {post.feature_image && (
                    <img
                      src={post.feature_image}
                      alt=""
                      className="hidden h-14 w-20 shrink-0 rounded border object-cover sm:block"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {post.featured && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                      )}
                      <Link
                        href={
                          post.status === "draft"
                            ? `/editor/${post.slug}`
                            : `/post/${post.slug}`
                        }
                        className="truncate font-semibold hover:underline"
                      >
                        {post.title}
                      </Link>
                      <Badge
                        variant={
                          post.status === "published" ? "default" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {post.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(post.updated_at).toLocaleDateString()}
                      {" · "}
                      {post.reading_time} min read
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Open post actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/editor/${post.slug}`)}
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {post.status === "draft" ? (
                        <DropdownMenuItem
                          onClick={() => handlePublish(post.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Publish
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleUnpublish(post.id)}
                        >
                          <EyeOff className="mr-2 h-4 w-4" />
                          Unpublish
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(post.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
          <div className="flex w-full max-w-full items-center gap-2 overflow-x-auto border-t bg-background px-3 py-2 shadow-lg sm:w-auto sm:rounded-xl sm:border sm:px-4 sm:py-2.5">
            <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-sm font-medium">
              {selectedIds.size}{" "}
              <span className="hidden sm:inline">selected</span>
            </span>
            <div className="mx-1 h-5 w-px shrink-0 bg-border sm:mx-2" />
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkPublish}
              disabled={bulkActing}
              className="flex-1 sm:flex-none"
            >
              <Eye className="mr-0 h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkUnpublish}
              disabled={bulkActing}
              className="flex-1 sm:flex-none"
            >
              <EyeOff className="mr-0 h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Unpublish</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkActing}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="mr-0 h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Clear selected posts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Posts</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} post
              {selectedIds.size > 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkActing}
            >
              Delete {selectedIds.size} Post{selectedIds.size > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
