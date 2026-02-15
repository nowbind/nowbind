"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommentForm } from "./comment-form";
import { useAuth } from "@/lib/hooks/use-auth";
import { api } from "@/lib/api";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import type { Comment } from "@/lib/types";

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, content: string) => Promise<void>;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export function CommentItem({ comment, onReply, onUpdate, onDelete }: CommentItemProps) {
  const { user } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const isOwner = user?.id === comment.author_id;

  const timeAgo = formatTimeAgo(comment.created_at);

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await api.put(`/comments/${comment.id}`, { content: editContent.trim() });
      onUpdate(comment.id, editContent.trim());
      setEditing(false);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/comments/${comment.id}`);
      onDelete(comment.id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Link href={`/author/${comment.author?.username}`}>
          <Avatar className="h-7 w-7">
            {comment.author?.avatar_url && (
              <AvatarImage src={comment.author.avatar_url} alt={comment.author.display_name || comment.author.username} />
            )}
            <AvatarFallback className="text-xs">
              {comment.author?.display_name?.[0]?.toUpperCase() || comment.author?.username?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/author/${comment.author?.username}`}
              className="text-sm font-medium hover:underline"
            >
              {comment.author?.display_name || comment.author?.username}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="xs" onClick={handleEdit}>Save</Button>
                <Button size="xs" variant="ghost" onClick={() => { setEditing(false); setEditContent(comment.content); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
          )}

          {!editing && (
            <div className="flex items-center gap-1">
              {user && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => setShowReply(!showReply)}
                >
                  <MessageSquare className="h-3 w-3" />
                  Reply
                </Button>
              )}
              {isOwner && (
                <>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          )}

          {showReply && (
            <div className="mt-2">
              <CommentForm
                onSubmit={async (content) => {
                  await onReply(comment.id, content);
                  setShowReply(false);
                }}
                placeholder="Write a reply..."
                submitLabel="Reply"
                onCancel={() => setShowReply(false)}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-10 space-y-3 border-l pl-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
