"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export function useFollow(initialFollowing: boolean = false) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(
    async (username: string) => {
      setLoading(true);
      const prev = isFollowing;
      setIsFollowing(!prev); // optimistic
      try {
        if (prev) {
          await api.delete(`/users/${username}/follow`);
        } else {
          await api.post(`/users/${username}/follow`);
        }
      } catch {
        setIsFollowing(prev); // revert
      } finally {
        setLoading(false);
      }
    },
    [isFollowing]
  );

  return { isFollowing, toggle, loading, setIsFollowing };
}

export function useLike(initialLiked: boolean = false, initialCount: number = 0) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(
    async (postId: string) => {
      setLoading(true);
      const prev = isLiked;
      setIsLiked(!prev);
      setCount((c) => (prev ? c - 1 : c + 1)); // optimistic
      try {
        if (prev) {
          await api.delete(`/posts/${postId}/like`);
        } else {
          await api.post(`/posts/${postId}/like`);
        }
      } catch {
        setIsLiked(prev);
        setCount((c) => (prev ? c + 1 : c - 1)); // revert
      } finally {
        setLoading(false);
      }
    },
    [isLiked]
  );

  return { isLiked, count, toggle, loading, setIsLiked, setCount };
}

export function useBookmark(initialBookmarked: boolean = false) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(
    async (postId: string) => {
      setLoading(true);
      const prev = isBookmarked;
      setIsBookmarked(!prev); // optimistic
      try {
        if (prev) {
          await api.delete(`/posts/${postId}/bookmark`);
        } else {
          await api.post(`/posts/${postId}/bookmark`);
        }
      } catch {
        setIsBookmarked(prev); // revert
      } finally {
        setLoading(false);
      }
    },
    [isBookmarked]
  );

  return { isBookmarked, toggle, loading, setIsBookmarked };
}
