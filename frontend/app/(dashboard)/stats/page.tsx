"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { StatsOverview, ViewsByDate, PostStatsDetail, ReferrerStat } from "@/lib/types";
import { BarChart3, Eye, Heart, Users, FileText, Bot } from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DateRange = "7" | "30" | "90";

export default function StatsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [timeline, setTimeline] = useState<ViewsByDate[]>([]);
  const [topPosts, setTopPosts] = useState<PostStatsDetail[]>([]);
  const [referrers, setReferrers] = useState<ReferrerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30");

  const fetchData = useCallback(
    (days: string) => {
      if (!user) return;
      setLoading(true);
      Promise.all([
        api.get<StatsOverview>("/stats/overview"),
        api.get<ViewsByDate[]>("/stats/timeline", { days }),
        api.get<PostStatsDetail[]>("/stats/top-posts", { days, limit: "10" }),
        api.get<ReferrerStat[]>("/stats/referrers", { days, limit: "10" }),
      ])
        .then(([ov, tl, tp, rf]) => {
          setOverview(ov);
          setTimeline(tl || []);
          setTopPosts(tp || []);
          setReferrers(rf || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [user]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    fetchData(dateRange);
  }, [user, authLoading, router, dateRange, fetchData]);

  const chartData = timeline.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    views: d.view_count,
    unique: d.unique_views,
    ai: d.ai_views,
  }));

  const topPostsChartData = topPosts.slice(0, 8).map((p) => ({
    name: p.title.length > 30 ? p.title.slice(0, 27) + "..." : p.title,
    views: p.view_count,
    likes: p.like_count,
    slug: p.slug,
  }));

  const dateRangeOptions: { label: string; value: DateRange }[] = [
    { label: "7d", value: "7" },
    { label: "30d", value: "30" },
    { label: "90d", value: "90" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Stats</h1>
            <div className="flex rounded-md border">
              {dateRangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateRange(opt.value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    dateRange === opt.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  } ${opt.value === "7" ? "rounded-l-md" : ""} ${
                    opt.value === "90" ? "rounded-r-md" : ""
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

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

              {/* Views over time - Area Chart */}
              {chartData.length > 0 && (
                <section>
                  <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <BarChart3 className="h-5 w-5" />
                    Views Over Time
                  </h2>
                  <div className="rounded-lg border p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorAI" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-2, 160 60% 45%))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--chart-2, 160 60% 45%))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "13px",
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="views"
                          name="Views"
                          stroke="hsl(var(--primary))"
                          fillOpacity={1}
                          fill="url(#colorViews)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="ai"
                          name="AI Views"
                          stroke="hsl(var(--chart-2, 160 60% 45%))"
                          fillOpacity={1}
                          fill="url(#colorAI)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        <span>Views</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "hsl(160, 60%, 45%)" }} />
                        <span>AI Views</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Top posts - Horizontal Bar Chart */}
              {topPostsChartData.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">Top Posts</h2>
                  <div className="rounded-lg border p-4">
                    <ResponsiveContainer width="100%" height={Math.max(200, topPostsChartData.length * 40 + 20)}>
                      <BarChart
                        data={topPostsChartData}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={180}
                          tick={{ fontSize: 11 }}
                          className="text-muted-foreground"
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "13px",
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                        <Bar dataKey="views" name="Views" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Clickable post list below chart */}
                  <div className="mt-3 space-y-1">
                    {topPosts.map((post, i) => (
                      <Link
                        key={post.post_id}
                        href={`/post/${post.slug}`}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-xs font-medium text-muted-foreground">{i + 1}</span>
                          <span className="font-medium line-clamp-1">{post.title}</span>
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
