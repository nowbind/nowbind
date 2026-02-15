import { notFound } from "next/navigation";
import { API_URL, SITE_URL } from "@/lib/constants";
import type { Post } from "@/lib/types";
import type { Metadata } from "next";
import { PostContent } from "@/components/post/post-content";
import { PostHeader } from "@/components/post/post-header";
import { CommentSection } from "@/components/social/comment-section";
import { RelatedPosts } from "@/components/post/related-posts";
import { ViewTracker } from "@/components/post/view-tracker";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_URL}/posts/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found" };

  return {
    title: post.title,
    description: post.excerpt || post.ai_summary,
    keywords: post.ai_keywords,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: post.author ? [post.author.display_name || post.author.username] : [],
      tags: post.tags?.map((t) => t.name),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-8">
          <PostHeader post={post} />
          <PostContent content={post.content} />
        </article>

        <div className="mx-auto max-w-3xl space-y-12 px-4 pb-12">
          <CommentSection postId={post.id} initialCount={post.comment_count} />
          <RelatedPosts slug={post.slug} />
        </div>

        <ViewTracker slug={post.slug} />

        {/* JSON-LD for the article */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: post.title,
              description: post.excerpt,
              datePublished: post.published_at,
              dateModified: post.updated_at,
              author: post.author
                ? {
                    "@type": "Person",
                    name: post.author.display_name || post.author.username,
                    url: `${SITE_URL}/author/${post.author.username}`,
                  }
                : undefined,
              keywords: post.ai_keywords?.join(", "),
              wordCount: post.content?.split(/\s+/).length,
              timeRequired: `PT${post.reading_time}M`,
            }),
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
