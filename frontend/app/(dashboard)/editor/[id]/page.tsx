"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "@/components/editor/block-editor";
import { PostSettingsPanel } from "@/components/editor/post-settings-panel";
import { PostContent } from "@/components/post/post-content";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { useAutosave } from "@/lib/hooks/use-autosave";
import { api, ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";
import type { JSONContent } from "novel";
import {
  Save,
  Send,
  Settings,
  Loader2,
  X,
  Upload,
  Image as ImageIcon,
  Eye,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";

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
  const [initialContent, setInitialContent] = useState<
    JSONContent | undefined
  >();
  const [excerpt, setExcerpt] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [slug, setSlug] = useState("");
  const [featured, setFeatured] = useState(false);
  const [featureImage, setFeatureImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  // Plain text content for tag suggestion hook
  const [contentText, setContentText] = useState("");

  // Refs for autosave to capture latest values
  const postRef = useRef(post);
  postRef.current = post;
  const titleRef = useRef(title);
  titleRef.current = title;
  const subtitleRef = useRef(subtitle);
  subtitleRef.current = subtitle;
  const contentJSONRef = useRef(contentJSON);
  contentJSONRef.current = contentJSON;
  const excerptRef = useRef(excerpt);
  excerptRef.current = excerpt;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const slugRef = useRef(slug);
  slugRef.current = slug;
  const featuredRef = useRef(featured);
  featuredRef.current = featured;
  const featureImageRef = useRef(featureImage);
  featureImageRef.current = featureImage;

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
        setLoading(false);
      })
      .catch(() => router.push("/dashboard"));
  }, [id, router]);

  const performSave = useCallback(async () => {
    if (!postRef.current) return false;
    try {
      const updated = await api.put<Post>(`/posts/${postRef.current.id}`, {
        title: titleRef.current,
        subtitle: subtitleRef.current,
        content_json: contentJSONRef.current
          ? JSON.stringify(contentJSONRef.current)
          : undefined,
        excerpt: excerptRef.current,
        tags: tagsRef.current,
        slug: slugRef.current || undefined,
        featured: featuredRef.current,
        feature_image: featureImageRef.current,
      });
      postRef.current = updated;
      setPost(updated);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        toast.error("Content Policy Violation", {
          description: err.message || "Your changes contain content that violates our community guidelines.",
          duration: 8000,
        });
      }
      return false;
    }
  }, []);

  const {
    status: autosaveStatus,
    statusLabel,
    markDirty,
    markClean,
  } = useAutosave({
    interval: 30_000,
    onSave: performSave,
  });

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
        markDirty();
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
      setSlug(updated.slug || slug);
      markClean();
      toast.success("Post saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        toast.error("Content Policy Violation", {
          description: err.message || "Your changes contain content that violates our community guidelines.",
          duration: 8000,
        });
      } else {
        toast.error("Failed to save post");
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!post) return;
    setSaving(true);
    try {
      await api.put(`/posts/${post.id}`, {
        title,
        subtitle,
        content_json: contentJSON ? JSON.stringify(contentJSON) : undefined,
        excerpt,
        tags,
        slug: slug || undefined,
        featured,
        feature_image: featureImage,
      });
      await api.post(`/posts/${post.id}/publish`);
      markClean();
      toast.success("Post published");
      router.push(`/post/${post.slug}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        toast.error("Content Policy Violation", {
          description: err.message || "Your post was blocked by our content moderation system.",
          duration: 8000,
        });
      } else {
        toast.error("Failed to publish");
      }
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
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {/* Row 1: title + preview (preview stays on this row on mobile) */}
            <div className="flex flex-1 items-center gap-3 min-w-0">
              <h1 className="text-lg font-semibold shrink-0">Edit Post</h1>
              {statusLabel && (
                <span
                  className={`text-xs ${
                    autosaveStatus === "saving"
                      ? "text-muted-foreground"
                      : autosaveStatus === "unsaved"
                        ? "text-amber-500"
                        : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {statusLabel}
                </span>
              )}
            </div>
            <Button
              variant={previewMode ? "default" : "ghost"}
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? (
                <>
                  <PenLine className="mr-2 h-4 w-4" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            {/* Row 2 on mobile (basis-full), inline on desktop (sm:basis-auto) */}
            <div className="flex items-center basis-full justify-end gap-2 sm:basis-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettingsOpen(true)}
                title="Post settings"
                aria-label="Open post settings"
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

          {/* ---- Preview Mode (overlay, editor stays mounted) ---- */}
          {previewMode && (
            <article className="prose dark:prose-invert mx-auto max-w-3xl">
              {featureImage && (
                <img
                  src={featureImage}
                  alt="Feature"
                  className="mb-6 w-full max-h-96 rounded-lg object-cover"
                />
              )}
              <h1 className="text-4xl font-bold">{title || "Untitled Post"}</h1>
              {subtitle && (
                <p className="text-xl text-muted-foreground">{subtitle}</p>
              )}
              <hr className="my-6" />
              {contentJSON ? (
                <PostContent
                  content=""
                  contentJSON={JSON.stringify(contentJSON)}
                  contentFormat="tiptap"
                />
              ) : (
                <p className="text-muted-foreground italic">
                  No content yet. Start writing to see the preview.
                </p>
              )}
            </article>
          )}

          {/* ---- Edit Mode (always mounted, hidden when previewing) ---- */}
          <div className={previewMode ? "hidden" : ""}>
            {/* Feature Image */}
            {featureImage ? (
              <div className="relative mb-6">
                <img
                  src={featureImage}
                  alt="Feature"
                  className="w-full max-h-96 rounded-lg border object-cover"
                />
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                    onClick={handleFeatureImageUpload}
                    disabled={featureUploading}
                    aria-label="Replace feature image"
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
                    onClick={() => {
                      setFeatureImage("");
                      markDirty();
                    }}
                    aria-label="Remove feature image"
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

            {/* Title & Subtitle */}
            <div className="mb-2">
              <input
                placeholder="Post title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                className="w-full bg-transparent text-4xl font-bold text-foreground placeholder:text-muted-foreground/50 outline-none"
              />
            </div>
            <div className="mb-6">
              <input
                placeholder="Add a subtitle..."
                value={subtitle}
                onChange={(e) => {
                  setSubtitle(e.target.value);
                  markDirty();
                }}
                className="w-full bg-transparent text-xl text-foreground/70 placeholder:text-muted-foreground/40 outline-none"
              />
            </div>

            {/* Block Editor */}
            <BlockEditor
              initialContent={initialContent}
              onChange={(json) => {
                setContentJSON(json);
                // Extract plain text for tag suggestions
                try {
                  const extractText = (node: any): string => {
                    if (!node) return "";
                    if (node.text) return node.text;
                    if (node.content) return node.content.map(extractText).join(" ");
                    return "";
                  };
                  setContentText(extractText(json));
                } catch {
                  // noop
                }
                markDirty();
              }}
              onImageUpload={uploadMedia}
            />
          </div>
        </div>
      </main>

      {/* Post Settings Sidebar */}
      <PostSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        slug={slug}
        onSlugChange={(v) => {
          setSlug(v);
          markDirty();
        }}
        tags={tags}
        onTagsChange={(v) => {
          setTags(v);
          markDirty();
        }}
        excerpt={excerpt}
        onExcerptChange={(v) => {
          setExcerpt(v);
          markDirty();
        }}
        featured={featured}
        onFeaturedChange={(v) => {
          setFeatured(v);
          markDirty();
        }}
        featureImage={featureImage}
        onFeatureImageChange={(v) => {
          setFeatureImage(v);
          markDirty();
        }}
        postId={post?.id || ""}
        title={title}
        subtitle={subtitle}
        content={contentText}
      />
    </div>
  );
}
