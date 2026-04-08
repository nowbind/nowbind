import { notFound } from "next/navigation";
import { API_URL, SITE_URL } from "@/lib/constants";
import { safeJsonLd } from "@/lib/utils";
import type { Post } from "@/lib/types";
import type { Metadata } from "next";
import { PostContent } from "@/components/post/post-content";
import { PostHeader } from "@/components/post/post-header";
import { CommentSection } from "@/components/social/comment-section";
import { RelatedPosts } from "@/components/post/related-posts";
import { ViewTracker } from "@/components/post/view-tracker";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ReadingProgress } from "@/components/layout/reading-progress";
import { TableOfContents } from "@/components/post/table-of-contents";
import { ReadingToolbar } from "@/components/post/reading-toolbar";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await fetch(`${API_URL}/posts/${slug}`, {
      cache: "no-store",
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

  const authorName = post.author
    ? post.author.display_name || post.author.username
    : "";
  const ogImageUrl = `/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(authorName)}&type=post`;

  return {
    title: post.title,
    description: post.excerpt || post.ai_summary,
    keywords: post.ai_keywords,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: `/post/${slug}`,
      siteName: "NowBind",
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at,
      authors: post.author ? [authorName] : [],
      tags: post.tags?.map((t) => t.name),
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `/post/${slug}`,
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
      <ReadingProgress />
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:grid lg:grid-cols-[1fr_minmax(0,48rem)_1fr] lg:gap-8">
          {/* Left spacer on desktop */}
          <div className="hidden lg:block" />

          {/* Main article column */}
          <div>
            <article>
              <PostHeader post={post} />
              {/* Mobile TOC (hidden on desktop) */}
              <div data-toc>
                <TableOfContents variant="mobile" />
              </div>
              <PostContent
                content={post.content}
                contentJSON={post.content_json}
                contentFormat={post.content_format}
              />
            </article>
          </div>

          {/* Desktop TOC sidebar (hidden on mobile) */}
          <div data-toc>
            <TableOfContents variant="desktop" />
          </div>
        </div>

        <div
          data-post-extras
          className="mx-auto max-w-3xl space-y-12 px-4 pb-12"
        >
          <CommentSection postId={post.id} initialCount={post.comment_count} />
          <RelatedPosts slug={post.slug} />
        </div>

        <ViewTracker slug={post.slug} />
        <ReadingToolbar />

        {/* JSON-LD for the article */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "Article",
              headline: post.title,
              description: post.excerpt,
              url: `${SITE_URL}/post/${post.slug}`,
              image: `${SITE_URL}/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(post.author?.display_name || post.author?.username || "")}&type=post`,
              datePublished: post.published_at,
              dateModified: post.updated_at,
              author: post.author
                ? {
                    "@type": "Person",
                    name: post.author.display_name || post.author.username,
                    url: `${SITE_URL}/author/${post.author.username}`,
                  }
                : undefined,
              publisher: {
                "@type": "Organization",
                name: "NowBind",
                url: SITE_URL,
              },
              keywords: post.ai_keywords?.join(", "),
              wordCount: post.content?.split(/\s+/).length,
              timeRequired: `PT${post.reading_time}M`,
              isAccessibleForFree: true,
              inLanguage: "en",
            }),
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
