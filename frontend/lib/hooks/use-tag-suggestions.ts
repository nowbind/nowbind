"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";

interface TagSuggestion {
  keyword: string;
  score: number;
  is_existing_tag: boolean;
  matched_tag: string | null;
}

interface SuggestTagsResponse {
  suggestions: TagSuggestion[];
  source: string;
}

interface UseTagSuggestionsOptions {
  postId: string;
  title: string;
  subtitle: string;
  excerpt: string;
  content: string;
  selectedTags: string[];
}

const TITLE_DEBOUNCE_MS = 800;
const EXCERPT_DEBOUNCE_MS = 1000;
const CONTENT_DEBOUNCE_MS = 1200;
const CONTENT_WORD_THRESHOLD = 50;
const CONTENT_WORD_INCREMENT = 100;
// Max words sent to backend (keep payload small)
const MAX_CONTENT_WORDS = 500;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

export function useTagSuggestions({
  postId,
  title,
  subtitle,
  excerpt,
  content,
  selectedTags,
}: UseTagSuggestionsOptions) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track last word count at which we fetched for content
  const lastContentFetchAt = useRef<number>(0);
  // Track dismissed keywords (per session, to avoid re-showing)
  const sessionDismissed = useRef<Set<string>>(new Set());
  // Track whether we've loaded persisted suggestions
  const persistedLoaded = useRef(false);

  // Load persisted suggestions on mount (for draft resumption)
  useEffect(() => {
    if (!postId || postId === "new" || persistedLoaded.current) return;
    persistedLoaded.current = true;

    api
      .get<{ suggestions: (TagSuggestion & { accepted: boolean | null })[] }>(
        `/posts/${postId}/suggestions`
      )
      .then((data) => {
        // Only show ones not yet accepted/dismissed (accepted === null)
        const pending = (data.suggestions || []).filter(
          (s) => s.accepted === null
        );
        if (pending.length > 0) {
          const byKeyword = new Map<string, TagSuggestion>();
          for (const s of pending) {
            byKeyword.set(s.keyword, s);
          }
          setSuggestions(Array.from(byKeyword.values()));
        }
      })
      .catch(() => {});
  }, [postId]);

  const fetchSuggestions = useCallback(
    async (_source: "title" | "subtitle" | "excerpt" | "content") => {
      if (!postId || postId === "new") return;

      const contentSample = truncateToWords(content, MAX_CONTENT_WORDS);

      // Don't fetch if there's nothing meaningful to analyse
      const combined = [title, subtitle, excerpt, contentSample]
        .filter(Boolean)
        .join(" ");
      if (countWords(combined) < 3) return;

      try {
        setIsLoading(true);
        const data = await api.post<SuggestTagsResponse>(
          `/posts/${postId}/suggest-tags`,
          {
            title,
            excerpt: [subtitle, excerpt].filter(Boolean).join(". "),
            content_sample: contentSample,
            selected_tags: selectedTags,
          }
        );

        setSuggestions((prev) => {
          const selectedLower = new Set(
            selectedTags.map((t) => t.toLowerCase())
          );

          const byKeyword = new Map<string, TagSuggestion>();
          for (const s of prev) {
            byKeyword.set(s.keyword, s);
          }
          for (const s of data.suggestions || []) {
            if (
              sessionDismissed.current.has(s.keyword) ||
              selectedLower.has(s.keyword)
            ) {
              continue;
            }
            byKeyword.set(s.keyword, s);
          }

          return Array.from(byKeyword.values());
        });
      } catch {
        // Fail silently — suggestions are a nice-to-have
      } finally {
        setIsLoading(false);
      }
    },
    [postId, title, subtitle, excerpt, content, selectedTags]
  );

  // When postId first becomes valid (draft created), fetch suggestions immediately
  // with whatever content we already have — the debounced effects won't re-fire
  // because title/subtitle/content haven't changed.
  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!postId || postId === "new" || initialFetchDone.current) return;
    initialFetchDone.current = true;
    // Small delay to let the autosave response settle
    const timer = setTimeout(() => fetchSuggestions("title"), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Title: debounce 800ms
  useEffect(() => {
    if (!title.trim() || !postId || postId === "new") return;
    const timer = setTimeout(
      () => fetchSuggestions("title"),
      TITLE_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Subtitle: debounce 1000ms
  useEffect(() => {
    if (!subtitle.trim() || !postId || postId === "new") return;
    const timer = setTimeout(
      () => fetchSuggestions("subtitle"),
      EXCERPT_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitle]);

  // Excerpt: debounce 1000ms
  useEffect(() => {
    if (!excerpt.trim() || !postId || postId === "new") return;
    const timer = setTimeout(
      () => fetchSuggestions("excerpt"),
      EXCERPT_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [excerpt]);

  // Content: trigger at 50 words, then every 100 additional words
  useEffect(() => {
    if (!postId || postId === "new") return;
    const wordCount = countWords(content);
    const shouldFetch =
      wordCount >= CONTENT_WORD_THRESHOLD &&
      wordCount - lastContentFetchAt.current >= CONTENT_WORD_INCREMENT;

    if (!shouldFetch) return;

    const timer = setTimeout(() => {
      lastContentFetchAt.current = wordCount;
      fetchSuggestions("content");
    }, CONTENT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const acceptSuggestion = useCallback(
    (keyword: string) => {
      // Remove from suggestions list (it moves to selected tags in parent)
      setSuggestions((prev) => prev.filter((s) => s.keyword !== keyword));
      // Notify backend
      if (postId && postId !== "new") {
        api
          .post(`/posts/${postId}/suggest-tags/accept`, {
            keyword,
            accepted: true,
          })
          .catch(() => {});
      }
    },
    [postId]
  );

  const dismissSuggestion = useCallback(
    (keyword: string) => {
      sessionDismissed.current.add(keyword);
      setSuggestions((prev) => prev.filter((s) => s.keyword !== keyword));
      // Notify backend
      if (postId && postId !== "new") {
        api
          .post(`/posts/${postId}/suggest-tags/accept`, {
            keyword,
            accepted: false,
          })
          .catch(() => {});
      }
    },
    [postId]
  );

  // Filter out already-selected tags from suggestions reactively
  const filteredSuggestions = suggestions.filter(
    (s) => !selectedTags.map((t) => t.toLowerCase()).includes(s.keyword)
  );

  return {
    suggestions: filteredSuggestions,
    isLoading,
    acceptSuggestion,
    dismissSuggestion,
  };
}
