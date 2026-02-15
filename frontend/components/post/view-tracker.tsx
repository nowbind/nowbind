"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface ViewTrackerProps {
  slug: string;
}

export function ViewTracker({ slug }: ViewTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    api
      .post(`/posts/${slug}/view`, {
        referrer: typeof document !== "undefined" ? document.referrer : "",
      })
      .catch(() => {});
  }, [slug]);

  return null;
}
