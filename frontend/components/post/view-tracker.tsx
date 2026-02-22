"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

interface ViewTrackerProps {
  slug: string;
}

const VIEWED_POST_PREFIX = "nowbind:viewed-post:";

export function ViewTracker({ slug }: ViewTrackerProps) {
  useEffect(() => {
    if (!slug) return;

    const storageKey = `${VIEWED_POST_PREFIX}${slug}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(storageKey) === "1") {
      return;
    }

    let cancelled = false;

    api
      .post(`/posts/${slug}/view`, {
        referrer: typeof document !== "undefined" ? document.referrer : "",
      })
      .then(() => {
        if (!cancelled && typeof window !== "undefined") {
          sessionStorage.setItem(storageKey, "1");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return null;
}
