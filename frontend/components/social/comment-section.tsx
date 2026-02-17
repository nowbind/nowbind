"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { MessageSquare, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Comment } from "@/lib/types";

type SortOrder = "newest" | "oldest";

interface CommentSectionProps {
  postId: string;
  initialCount?: number;
}

export function CommentSection({ postId, initialCount = 0 }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(initialCount);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Comment[]; total: number }>(`/posts/${postId}/comments`);
      setComments(res.data || []);
      setCount(res.total ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const sortedComments = useMemo(() => {
    const sorted = [...comments].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
    });
    return sorted;
  }, [comments, sortOrder]);

  const handleCreate = async (content: string) => {
    const newComment = await api.post<Comment>(`/posts/${postId}/comments`, { content });
    setComments((prev) => [...prev, newComment]);
    setCount((c) => c + 1);
    toast.success("Comment posted");
  };

  const handleReply = async (parentId: string, content: string) => {
    const reply = await api.post<Comment>(`/posts/${postId}/comments`, {
      content,
      parent_id: parentId,
    });
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === parentId) {
          return { ...c, replies: [...(c.replies || []), reply] };
        }
        return c;
      })
    );
    setCount((c) => c + 1);
    toast.success("Reply posted");
  };

  const handleUpdate = (id: string, content: string) => {
    const updateInTree = (list: Comment[]): Comment[] =>
      list.map((c) => {
        if (c.id === id) return { ...c, content };
        if (c.replies) return { ...c, replies: updateInTree(c.replies) };
        return c;
      });
    setComments(updateInTree);
    toast.success("Comment updated");
  };

  const handleDelete = (id: string) => {
    const removeFromTree = (list: Comment[]): Comment[] =>
      list
        .filter((c) => c.id !== id)
        .map((c) => (c.replies ? { ...c, replies: removeFromTree(c.replies) } : c));
    setComments(removeFromTree);
    setCount((c) => Math.max(c - 1, 0));
    toast.success("Comment deleted");
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" />
          Comments {count > 0 && `(${count})`}
        </h2>

        {comments.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortOrder === "newest" ? "Newest" : "Oldest"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                Oldest first
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <CommentForm onSubmit={handleCreate} />

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : sortedComments.length > 0 ? (
        <div className="space-y-6">
          {sortedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              onReply={handleReply}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts.</p>
      )}
    </section>
  );
}
