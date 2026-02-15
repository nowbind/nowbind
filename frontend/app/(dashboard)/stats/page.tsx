"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { StatsOverview, ViewsByDate, PostStatsDetail, ReferrerStat } from "@/lib/types";
import { BarChart3, Eye, Heart, Users, FileText, Bot } from "lucide-react";
import Link from "next/link";

export default function StatsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [timeline, setTimeline] = useState<ViewsByDate[]>([]);
  const [topPosts, setTopPosts] = useState<PostStatsDetail[]>([]);
  const [referrers, setReferrers] = useState<ReferrerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    Promise.all([
      api.get<StatsOverview>("/stats/overview"),
      api.get<ViewsByDate[]>("/stats/timeline", { days: "30" }),
      api.get<PostStatsDetail[]>("/stats/top-posts", { days: "30", limit: "10" }),
      api.get<ReferrerStat[]>("/stats/referrers", { days: "30", limit: "10" }),
    ])
      .then(([ov, tl, tp, rf]) => {
        setOverview(ov);
        setTimeline(tl || []);
        setTopPosts(tp || []);
        setReferrers(rf || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="mb-6 text-2xl font-bold">Stats</h1>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : overview ? (
            <div className="space-y-8">
              {/* Overview cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard icon={<Eye className="h-5 w-5" />} label="Total Views" value={overview.total_views} />
                <StatCard icon={<Users className="h-5 w-5" />} label="Unique Visitors" value={overview.unique_views} />
                <StatCard icon={<Bot className="h-5 w-5" />} label="AI Views" value={overview.ai_views} />
                <StatCard icon={<FileText className="h-5 w-5" />} label="Posts" value={overview.total_posts} />
                <StatCard icon={<Heart className="h-5 w-5" />} label="Total Likes" value={overview.total_likes} />
                <StatCard icon={<Users className="h-5 w-5" />} label="Followers" value={overview.total_follows} />
              </div>

              {/* Timeline (simple table view) */}
              {timeline.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <BarChart3 className="h-5 w-5" />
                    Last 30 Days
                  </h2>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left font-medium">Date</th>
                          <th className="px-4 py-2 text-right font-medium">Views</th>
                          <th className="px-4 py-2 text-right font-medium">Unique</th>
                          <th className="px-4 py-2 text-right font-medium">AI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.slice(-14).reverse().map((day) => (
                          <tr key={day.date} className="border-b last:border-0">
                            <td className="px-4 py-2 text-muted-foreground">
                              {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                            <td className="px-4 py-2 text-right">{day.view_count}</td>
                            <td className="px-4 py-2 text-right">{day.unique_views}</td>
                            <td className="px-4 py-2 text-right">{day.ai_views}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Top posts */}
              {topPosts.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">Top Posts</h2>
                  <div className="space-y-2">
                    {topPosts.map((post, i) => (
                      <Link
                        key={post.post_id}
                        href={`/post/${post.slug}`}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}</span>
                          <span className="text-sm font-medium line-clamp-1">{post.title}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                          <span>{post.view_count} views</span>
                          <span>{post.like_count} likes</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Referrers */}
              {referrers.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">Top Referrers</h2>
                  <div className="rounded-lg border">
                    {referrers.map((ref, i) => (
                      <div
                        key={ref.referrer}
                        className={`flex items-center justify-between px-4 py-2.5 ${i < referrers.length - 1 ? "border-b" : ""}`}
                      >
                        <span className="text-sm">{ref.referrer || "Direct"}</span>
                        <span className="text-sm text-muted-foreground">{ref.count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="rounded-lg border p-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No stats available yet. Publish a post to start tracking.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
