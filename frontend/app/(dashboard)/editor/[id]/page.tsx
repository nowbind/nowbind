"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostContent } from "@/components/post/post-content";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";
import { Save, Send, Eye, Edit3, X, Loader2 } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPostPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Post>(`/posts/${id}`)
      .then((p) => {
        setPost(p);
        setTitle(p.title);
        setSubtitle(p.subtitle || "");
        setContent(p.content);
        setExcerpt(p.excerpt || "");
        setTags(p.tags?.map((t) => t.name) || []);
      })
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const addTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  }, [tagInput, tags]);

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.put<Post>(`/posts/${id}`, {
        title,
        subtitle,
        content,
        excerpt,
        tags,
      });
      setPost(updated);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await handleSave();
      await api.post(`/posts/${id}/publish`);
      if (post) {
        router.push(`/post/${post.slug}`);
      }
    } catch (err) {
      console.error("Failed to publish:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-96" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Edit Post</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              {post?.status === "draft" && (
                <Button size="sm" onClick={handlePublish} disabled={saving}>
                  <Send className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              )}
            </div>
          </div>

          <div className="mb-4 space-y-3">
            <Input
              placeholder="Post title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border-0 bg-transparent text-2xl font-bold placeholder:text-muted-foreground/50 focus-visible:ring-0"
            />
            <Input
              placeholder="Subtitle (optional)"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="border-0 bg-transparent text-lg text-muted-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0"
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              className="h-7 w-24 border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
            />
          </div>

          <div className="mb-4">
            <Input
              placeholder="Excerpt..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="text-sm text-muted-foreground"
            />
          </div>

          <Tabs defaultValue="write" className="w-full">
            <TabsList>
              <TabsTrigger value="write" className="gap-1">
                <Edit3 className="h-3.5 w-3.5" />
                Write
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-4">
              <Textarea
                placeholder="Write your post in Markdown..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] resize-none font-mono text-sm leading-relaxed"
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-4">
              <div className="min-h-[500px] rounded-lg border p-6">
                {content ? (
                  <PostContent content={content} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
