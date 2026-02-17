"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    // Load tags for filter dropdown
    api.get<Tag[]>("/tags").then(setAllTags).catch(() => {});
  }, [user, authLoading, router]);

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, statusFilter, tagFilter, sortBy]);

  const handlePublish = async (id: string) => {
    await api.post(`/posts/${id}/publish`);
    setPosts(
      posts.map((p) => (p.id === id ? { ...p, status: "published" } : p))
    );
  };

  const handleUnpublish = async (id: string) => {
    await api.post(`/posts/${id}/unpublish`);
    setPosts(posts.map((p) => (p.id === id ? { ...p, status: "draft" } : p)));
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await api.delete(`/posts/${deleteId}`);
    setPosts(posts.filter((p) => p.id !== deleteId));
    setDeleteId(null);
  };

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
          ) : posts.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
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
            </div>
          ) : (
            <div className="space-y-2">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 rounded-lg border p-4"
                >
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
                        href={`/post/${post.slug}`}
                        className="truncate font-semibold hover:underline"
                      >
                        {post.title}
                      </Link>
                      <Badge
                        variant={
                          post.status === "published"
                            ? "default"
                            : "secondary"
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
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/editor/${post.slug}`)}>
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
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
    </div>
  );
}
