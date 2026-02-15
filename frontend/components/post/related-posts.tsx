"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

interface RelatedPostsProps {
  slug: string;
}

export function RelatedPosts({ slug }: RelatedPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    api
      .get<Post[]>(`/posts/${slug}/related`)
      .then((data) => setPosts(data || []))
      .catch(() => {});
  }, [slug]);

  if (posts.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">You might also like</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/post/${post.slug}`}
            className="group rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <h3 className="font-medium tracking-tight group-hover:text-muted-foreground line-clamp-2">
              {post.title}
            </h3>
            {post.excerpt && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {post.excerpt}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {post.reading_time} min read
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
