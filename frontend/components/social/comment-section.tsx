"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { MessageSquare } from "lucide-react";
import type { Comment } from "@/lib/types";

interface CommentSectionProps {
  postId: string;
  initialCount?: number;
}

export function CommentSection({ postId, initialCount = 0 }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(initialCount);

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

  const handleCreate = async (content: string) => {
    const newComment = await api.post<Comment>(`/posts/${postId}/comments`, { content });
    setComments((prev) => [...prev, newComment]);
    setCount((c) => c + 1);
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
  };

  const handleUpdate = (id: string, content: string) => {
    const updateInTree = (list: Comment[]): Comment[] =>
      list.map((c) => {
        if (c.id === id) return { ...c, content };
        if (c.replies) return { ...c, replies: updateInTree(c.replies) };
        return c;
      });
    setComments(updateInTree);
  };

  const handleDelete = (id: string) => {
    const removeFromTree = (list: Comment[]): Comment[] =>
      list
        .filter((c) => c.id !== id)
        .map((c) => (c.replies ? { ...c, replies: removeFromTree(c.replies) } : c));
    setComments(removeFromTree);
    setCount((c) => Math.max(c - 1, 0));
  };

  return (
    <section className="space-y-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="h-5 w-5" />
        Comments {count > 0 && `(${count})`}
      </h2>

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
      ) : comments.length > 0 ? (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
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
