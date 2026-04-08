import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AuthorContent } from "./author-content";
import { API_URL, SITE_URL } from "@/lib/constants";
import { safeJsonLd } from "@/lib/utils";
import type { User, Post, PaginatedResponse } from "@/lib/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
}

async function getAuthor(username: string): Promise<User | null> {
  try {
    const res = await fetch(`${API_URL}/users/${username}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getAuthorPosts(username: string): Promise<Post[]> {
  try {
    const res = await fetch(`${API_URL}/users/${username}/posts`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data: PaginatedResponse<Post> = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const author = await getAuthor(username);
  if (!author) return { title: "Author Not Found" };

  const name = author.display_name || author.username;
  const description =
    author.bio || `Read posts by ${name} on NowBind.`;
  const ogImageUrl = `/api/og?title=${encodeURIComponent(name)}&type=author`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} | NowBind`,
      description,
      url: `/author/${username}`,
      siteName: "NowBind",
      type: "profile",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | NowBind`,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: `/author/${username}`,
    },
  };
}

export default async function AuthorPage({ params }: Props) {
  const { username } = await params;
  const [author, posts] = await Promise.all([
    getAuthor(username),
    getAuthorPosts(username),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <AuthorContent
            username={username}
            initialAuthor={author}
            initialPosts={posts}
          />
        </div>

        {author && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: safeJsonLd({
                "@context": "https://schema.org",
                "@type": "Person",
                name: author.display_name || author.username,
                url: `${SITE_URL}/author/${username}`,
                description: author.bio || undefined,
              }),
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
