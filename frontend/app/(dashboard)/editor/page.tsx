"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "@/components/editor/block-editor";
import { PostSettingsPanel } from "@/components/editor/post-settings-panel";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { JSONContent } from "novel";
import { Save, Send, Settings, Loader2, X, Upload, Image as ImageIcon } from "lucide-react";

export default function EditorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { uploadMedia, uploading: featureUploading } = useMediaUpload();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [contentJSON, setContentJSON] = useState<JSONContent | undefined>();
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [featured, setFeatured] = useState(false);
  const [featureImage, setFeatureImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const saveAsDraft = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const post = await api.post<{ slug: string }>("/posts", {
        title,
        subtitle,
        content_json: contentJSON ? JSON.stringify(contentJSON) : undefined,
        excerpt,
        tags,
        slug: slug || undefined,
        featured,
        feature_image: featureImage || undefined,
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
        content_json: contentJSON ? JSON.stringify(contentJSON) : undefined,
        excerpt,
        tags,
        slug: slug || undefined,
        featured,
        feature_image: featureImage || undefined,
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
