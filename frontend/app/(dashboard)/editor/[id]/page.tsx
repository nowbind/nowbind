"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "@/components/editor/block-editor";
import { PostSettingsPanel } from "@/components/editor/post-settings-panel";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";
import type { JSONContent } from "novel";
import { Save, Send, Settings, Loader2, X, Upload, Image as ImageIcon } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPostPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { uploadMedia, uploading: featureUploading } = useMediaUpload();
  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [contentJSON, setContentJSON] = useState<JSONContent | undefined>();
  const [initialContent, setInitialContent] = useState<JSONContent | undefined>();
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [featured, setFeatured] = useState(false);
  const [featureImage, setFeatureImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    api
      .get<Post>(`/posts/${id}`)
      .then((p) => {
        setPost(p);
        setTitle(p.title);
        setSubtitle(p.subtitle || "");
        setExcerpt(p.excerpt || "");
        setTags(p.tags?.map((t) => t.name) || []);
        setSlug(p.slug || "");
        setFeatured(p.featured || false);
        setFeatureImage(p.feature_image || "");

        if (p.content_format === "tiptap" && p.content_json) {
          try {
            const parsed = JSON.parse(p.content_json);
            setInitialContent(parsed);
            setContentJSON(parsed);
          } catch {
            // Fallback: empty editor
          }
        }
      })
      .catch(() => router.push("/dashboard"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleFeatureImageUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await uploadMedia(file);
        setFeatureImage(url);
      } catch (err) {
        console.error("Failed to upload feature image:", err);
      }
    };
    input.click();
  };

  const handleSave = async () => {
    if (!post) return;
    setSaving(true);
    try {
      const updated = await api.put<Post>(`/posts/${post.id}`, {
        title,
        subtitle,
        content_json: contentJSON ? JSON.stringify(contentJSON) : undefined,
        excerpt,
        tags,
        slug: slug || undefined,
        featured,
        feature_image: featureImage,
      });
      setPost(updated);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!post) return;
    setSaving(true);
    try {
      await handleSave();
      await api.post(`/posts/${post.id}/publish`);
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
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                title="Post settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
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

          {/* Feature Image */}
          {featureImage ? (
            <div className="relative mb-6">
              <img
                src={featureImage}
                alt="Feature"
                className="h-64 w-full rounded-lg border object-cover"
              />
              <div className="absolute top-3 right-3 flex gap-1.5">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                  onClick={handleFeatureImageUpload}
                  disabled={featureUploading}
                >
                  {featureUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                  onClick={() => setFeatureImage("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleFeatureImageUpload}
              disabled={featureUploading}
              className="mb-6 flex h-16 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground/70"
            >
              {featureUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" />
                  Add feature image
                </>
              )}
            </button>
          )}

          {/* Title & Subtitle — Ghost-style borderless */}
          <div className="mb-2">
            <input
              placeholder="Post title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent text-4xl font-bold text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
          <div className="mb-6">
            <input
              placeholder="Add a subtitle..."
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full bg-transparent text-xl text-foreground/70 placeholder:text-muted-foreground/40 outline-none"
            />
          </div>

          {/* Block Editor */}
          <BlockEditor
            initialContent={initialContent}
            onChange={setContentJSON}
            onImageUpload={uploadMedia}
          />
        </div>
      </main>

      {/* Post Settings Sidebar */}
      <PostSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        slug={slug}
        onSlugChange={setSlug}
        tags={tags}
        onTagsChange={setTags}
        excerpt={excerpt}
        onExcerptChange={setExcerpt}
        featured={featured}
        onFeaturedChange={setFeatured}
        featureImage={featureImage}
        onFeatureImageChange={setFeatureImage}
      />
    </div>
  );
}
