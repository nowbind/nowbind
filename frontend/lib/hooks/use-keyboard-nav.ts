"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

interface UseKeyboardNavOptions {
  posts: Post[];
  enabled?: boolean;
  isAuthenticated?: boolean;
  onPostsChange?: (updater: (posts: Post[]) => Post[]) => void;
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
  onPostsChange,
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
    const el = document.querySelector(`[data-post-index="${index}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Only scroll if the element is outside the viewport
    if (rect.top < 0) {
      window.scrollBy({ top: rect.top - 80, behavior: "smooth" });
    } else if (rect.bottom > window.innerHeight) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + 20, behavior: "smooth" });
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
        setFocusedIndex((prev) => {
          const next = prev < posts.length - 1 ? prev + 1 : prev;
          requestAnimationFrame(() => scrollToPost(next));
          return next;
        });
        return;
      }

      // k — previous post
      if (key === "k") {
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          requestAnimationFrame(() => scrollToPost(next));
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
            if (!onPostsChange) return;
            onPostsChange((currentPosts) =>
              currentPosts.map((currentPost, index) => {
                if (index !== focusedIndex) return currentPost;
                const nextLiked = !currentPost.is_liked;
                return {
                  ...currentPost,
                  is_liked: nextLiked,
                  like_count: Math.max(
                    0,
                    currentPost.like_count + (nextLiked ? 1 : -1)
                  ),
                };
              })
            );
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
            if (!onPostsChange) return;
            onPostsChange((currentPosts) =>
              currentPosts.map((currentPost, index) =>
                index === focusedIndex
                  ? {
                      ...currentPost,
                      is_bookmarked: !currentPost.is_bookmarked,
                    }
                  : currentPost
              )
            );
          })
          .catch(() => {})
          .finally(() => {
            pendingAction.current = false;
          });
        return;
      }
    },
    [
      enabled,
      posts,
      focusedIndex,
      isAuthenticated,
      showHelp,
      router,
      scrollToPost,
      onPostsChange,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  return { focusedIndex, setFocusedIndex, showHelp, setShowHelp };
}
