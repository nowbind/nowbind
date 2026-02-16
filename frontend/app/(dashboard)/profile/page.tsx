"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PostCard } from "@/components/post/post-card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowButton } from "@/components/social/follow-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { Post, User, PaginatedResponse } from "@/lib/types";
import { Settings, Users, UserPlus, FileText, ChevronLeft, ChevronRight } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [suggested, setSuggested] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [followersPage, setFollowersPage] = useState(1);
  const [followingPage, setFollowingPage] = useState(1);
  const [followersTotalPages, setFollowersTotalPages] = useState(1);
  const [followingTotalPages, setFollowingTotalPages] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    Promise.all([
      api.get<User>(`/users/${user.username}`),
      api.get<PaginatedResponse<Post>>(`/users/${user.username}/posts`),
    ])
      .then(([profileData, postsRes]) => {
        setProfile(profileData);
        setPosts(postsRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<PaginatedResponse<User>>(`/users/${user.username}/followers`, {
        page: String(followersPage),
        per_page: "20",
      })
      .then((res) => {
        setFollowers(res.data || []);
        setFollowersTotalPages(res.total_pages);
      })
      .catch(() => {});
  }, [user, followersPage]);

  useEffect(() => {
    if (!user) return;
    api
      .get<PaginatedResponse<User>>(`/users/${user.username}/following`, {
        page: String(followingPage),
        per_page: "20",
      })
      .then((res) => {
        setFollowing(res.data || []);
        setFollowingTotalPages(res.total_pages);
      })
      .catch(() => {});
  }, [user, followingPage]);

  // Fetch suggested users to follow (from explore/recent authors)
  useEffect(() => {
    if (!user) return;
    api
      .get<PaginatedResponse<Post>>("/posts/trending", { limit: "20" })
      .then((res) => {
        const posts = res.data || [];
        const seen = new Set<string>();
        const authors: User[] = [];
        for (const p of posts) {
          if (p.author && p.author.id !== user.id && !seen.has(p.author.id)) {
            seen.add(p.author.id);
            authors.push(p.author);
          }
          if (authors.length >= 10) break;
        }
        setSuggested(authors);
      })
      .catch(() => {});
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="flex items-start gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {/* Profile Header */}
          <div className="mb-8">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                {profile.avatar_url && (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username}
                  />
                )}
                <AvatarFallback className="text-2xl">
                  {profile.display_name?.[0]?.toUpperCase() ||
                    profile.username?.[0]?.toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                      {profile.display_name || profile.username}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      @{profile.username}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Link>
                  </Button>
                </div>
                {profile.bio && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {profile.bio}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-6 text-sm">
                  <button
                    onClick={() => setActiveTab("followers")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-semibold text-foreground">
                      {profile.follower_count}
                    </span>{" "}
                    followers
                  </button>
                  <button
                    onClick={() => setActiveTab("following")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <span className="font-semibold text-foreground">
                      {profile.following_count}
                    </span>{" "}
                    following
                  </button>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {posts.length}
                    </span>{" "}
                    posts
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs: Posts, Followers, Following, Discover */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full justify-start overflow-x-auto scrollbar-hide">
              <TabsTrigger value="posts" className="shrink-0 gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="followers" className="shrink-0 gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Followers
              </TabsTrigger>
              <TabsTrigger value="following" className="shrink-0 gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Following
              </TabsTrigger>
              <TabsTrigger value="discover" className="shrink-0 gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Discover
              </TabsTrigger>
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="mt-6">
              {posts.length > 0 ? (
                <div>
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No published posts yet.
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href="/editor">Write your first post</Link>
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Followers Tab */}
            <TabsContent value="followers" className="mt-6">
              {followers.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                  No followers yet. Share your posts to grow your audience!
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    {followers.map((u) => (
                      <UserRow key={u.id} user={u} me={user} />
                    ))}
                  </div>
                  {followersTotalPages > 1 && (
                    <Pagination
                      page={followersPage}
                      totalPages={followersTotalPages}
                      onPageChange={setFollowersPage}
                    />
                  )}
                </>
              )}
            </TabsContent>

            {/* Following Tab */}
            <TabsContent value="following" className="mt-6">
              {following.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    You&apos;re not following anyone yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setActiveTab("discover")}
                  >
                    Discover writers
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {following.map((u) => (
                      <UserRow key={u.id} user={u} me={user} />
                    ))}
                  </div>
                  {followingTotalPages > 1 && (
                    <Pagination
                      page={followingPage}
                      totalPages={followingTotalPages}
                      onPageChange={setFollowingPage}
                    />
                  )}
                </>
              )}
            </TabsContent>

            {/* Discover Tab */}
            <TabsContent value="discover" className="mt-6">
              {suggested.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                  No suggestions yet. Check back as more writers join!
                </p>
              ) : (
                <div className="space-y-2">
                  {suggested.map((u) => (
                    <UserRow key={u.id} user={u} me={user} showFollow />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function UserRow({
  user,
  me,
  showFollow = true,
}: {
  user: User;
  me: User;
  showFollow?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Link
        href={`/author/${user.username}`}
        className="flex items-center gap-3"
      >
        <Avatar className="h-9 w-9">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
          <AvatarFallback className="text-xs">
            {user.display_name?.[0]?.toUpperCase() ||
              user.username?.[0]?.toUpperCase() ||
              "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">
            {user.display_name || user.username}
          </p>
          <p className="text-xs text-muted-foreground">@{user.username}</p>
        </div>
      </Link>
      {showFollow && me.id !== user.id && (
        <FollowButton
          username={user.username}
          initialFollowing={user.is_following}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
