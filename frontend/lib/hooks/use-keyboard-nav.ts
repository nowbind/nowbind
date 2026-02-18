"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

interface UseKeyboardNavOptions {
  posts: Post[];
  enabled?: boolean;
  isAuthenticated?: boolean;
}

interface UseKeyboardNavReturn {
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Check for cmdk dialog (search)
  if (el.closest("[cmdk-input]")) return true;
  return false;
}

export function useKeyboardNav({
  posts,
  enabled = true,
  isAuthenticated = false,
}: UseKeyboardNavOptions): UseKeyboardNavReturn {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();
  const pendingAction = useRef(false);

  // Reset focus when posts change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [posts]);

  const scrollToPost = useCallback((index: number) => {
    const el = document.querySelector(`[data-post-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || posts.length === 0) return;
      if (isInputFocused()) return;

      const key = e.key.toLowerCase();

      // ? — toggle help
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }

      // Escape — close help or clear focus
      if (key === "escape") {
        if (showHelp) {
          setShowHelp(false);
        } else {
          setFocusedIndex(-1);
        }
        return;
      }

      // j — next post
      if (key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < posts.length - 1 ? prev + 1 : prev;
          scrollToPost(next);
          return next;
        });
        return;
      }

      // k — previous post
      if (key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          scrollToPost(next);
          return next;
        });
        return;
      }

      // o or Enter — open focused post
      if (key === "enter" || key === "o") {
        if (focusedIndex >= 0 && focusedIndex < posts.length) {
          e.preventDefault();
          router.push(`/post/${posts[focusedIndex].slug}`);
        }
        return;
      }

      // l — toggle like (requires auth)
      if (key === "l") {
        if (!isAuthenticated) return;
        if (focusedIndex < 0 || focusedIndex >= posts.length) return;
        if (pendingAction.current) return;
        e.preventDefault();
        const post = posts[focusedIndex];
        pendingAction.current = true;
        const action = post.is_liked
          ? api.delete(`/posts/${post.id}/like`)
          : api.post(`/posts/${post.id}/like`);
        action
          .then(() => {
            post.is_liked = !post.is_liked;
            post.like_count += post.is_liked ? 1 : -1;
          })
          .catch(() => {})
          .finally(() => {
            pendingAction.current = false;
          });
        return;
      }

      // b — toggle bookmark (requires auth)
      if (key === "b") {
        if (!isAuthenticated) return;
        if (focusedIndex < 0 || focusedIndex >= posts.length) return;
        if (pendingAction.current) return;
        e.preventDefault();
        const post = posts[focusedIndex];
        pendingAction.current = true;
        const action = post.is_bookmarked
          ? api.delete(`/posts/${post.id}/bookmark`)
          : api.post(`/posts/${post.id}/bookmark`);
        action
          .then(() => {
            post.is_bookmarked = !post.is_bookmarked;
          })
          .catch(() => {})
          .finally(() => {
            pendingAction.current = false;
          });
        return;
      }
    },
    [enabled, posts, focusedIndex, isAuthenticated, showHelp, router, scrollToPost]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  return { focusedIndex, setFocusedIndex, showHelp, setShowHelp };
}
