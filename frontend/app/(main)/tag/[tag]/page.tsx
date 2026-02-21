import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { TagContent } from "./tag-content";
import { API_URL, SITE_URL } from "@/lib/constants";
import { safeJsonLd } from "@/lib/utils";
import type { Post, Tag } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ tag: string }>;
}

interface TagPostsResponse {
  tag: Tag;
  data: Post[];
  total_pages: number;
}

async function getTagPosts(
  tagSlug: string,
): Promise<TagPostsResponse | null> {
  try {
    const res = await fetch(
      `${API_URL}/tags/${tagSlug}/posts?page=1&per_page=10`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag: tagSlug } = await params;
  const data = await getTagPosts(tagSlug);

  const tagName = data?.tag?.name || tagSlug;
  const description = `Browse posts tagged "${tagName}" on NowBind.`;
  const ogImageUrl = `/api/og?title=${encodeURIComponent(`#${tagName}`)}&type=tag`;

  return {
    title: `Posts tagged "${tagName}"`,
    description,
    openGraph: {
      title: `Posts tagged "${tagName}" | NowBind`,
      description,
      url: `/tag/${tagSlug}`,
      siteName: "NowBind",
      images: [
        { url: ogImageUrl, width: 1200, height: 630, alt: `#${tagName}` },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Posts tagged "${tagName}" | NowBind`,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `/tag/${tagSlug}`,
    },
  };
}

export default async function TagPage({ params }: Props) {
  const { tag: tagSlug } = await params;
  const data = await getTagPosts(tagSlug);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <TagContent
            tagSlug={tagSlug}
            initialTag={data?.tag || null}
            initialPosts={data?.data || []}
            initialTotalPages={data?.total_pages || 1}
          />
        </div>

        {data?.tag && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: safeJsonLd({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: `Posts tagged "${data.tag.name}"`,
                url: `${SITE_URL}/tag/${tagSlug}`,
                description: `Browse posts tagged "${data.tag.name}" on NowBind.`,
              }),
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
