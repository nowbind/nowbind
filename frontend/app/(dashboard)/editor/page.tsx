"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostContent } from "@/components/post/post-content";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import { Save, Send, Eye, Edit3, X, Loader2 } from "lucide-react";

export default function EditorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

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

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  const saveAsDraft = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const post = await api.post<{ slug: string }>("/posts", {
        title,
        subtitle,
        content,
        excerpt,
        tags,
      });
      router.push(`/post/${post.slug}`);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const saveAndPublish = async () => {
    if (!title.trim()) return;
    setPublishing(true);
    try {
      const post = await api.post<{ id: string; slug: string }>("/posts", {
        title,
        subtitle,
        content,
        excerpt,
        tags,
      });
      await api.post(`/posts/${post.id}/publish`);
      router.push(`/post/${post.slug}`);
    } catch (err) {
      console.error("Failed to publish:", err);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {/* Toolbar */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-lg font-semibold">New Post</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={saveAsDraft}
                disabled={saving || !title.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Draft
              </Button>
              <Button
                size="sm"
                onClick={saveAndPublish}
                disabled={publishing || !title.trim()}
              >
                {publishing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Publish
              </Button>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="mb-4 space-y-3">
            <Input
              placeholder="Post title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-bold text-foreground placeholder:text-muted-foreground"
            />
            <Input
              placeholder="Subtitle (optional)"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="text-foreground/80 placeholder:text-muted-foreground"
            />
          </div>

          {/* Tags */}
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
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              className="w-32 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Excerpt */}
          <div className="mb-4">
            <Input
              placeholder="Excerpt (brief summary for cards and search)..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="text-sm text-foreground/80 placeholder:text-muted-foreground"
            />
          </div>

          {/* Editor / Preview */}
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
                    Nothing to preview yet. Start writing!
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
