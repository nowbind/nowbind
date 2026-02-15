import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, Heart, MessageSquare } from "lucide-react";
import type { Post } from "@/lib/types";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const publishDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <article className="group border-b py-6 first:pt-0 last:border-b-0">
      <Link href={`/post/${post.slug}`} className="block space-y-2">
        <h2 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-muted-foreground md:text-xl">
          {post.title}
        </h2>

        {post.subtitle && (
          <p className="text-sm text-muted-foreground">{post.subtitle}</p>
        )}

        {post.excerpt && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {post.excerpt}
          </p>
        )}
      </Link>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          {post.author && (
            <Link
              href={`/author/${post.author.username}`}
              className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Avatar className="h-6 w-6">
                {post.author.avatar_url && (
                  <AvatarImage src={post.author.avatar_url} alt="" />
                )}
                <AvatarFallback className="text-[9px]">
                  {post.author.display_name?.[0]?.toUpperCase() || post.author.username?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="whitespace-nowrap">
                {post.author.display_name || post.author.username}
              </span>
            </Link>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {publishDate && (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <Calendar className="h-3 w-3" />
                {publishDate}
              </span>
            )}
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <Clock className="h-3 w-3" />
              {post.reading_time} min
            </span>
            {post.like_count > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <Heart className="h-3 w-3" />
                {post.like_count}
              </span>
            )}
            {post.comment_count > 0 && (
              <span className="flex shrink-0 items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {post.comment_count}
              </span>
            )}
          </div>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <Link key={tag.id} href={`/tag/${tag.slug}`}>
                <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
