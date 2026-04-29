"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import { useTagSuggestions } from "@/lib/hooks/use-tag-suggestions";
import { TagSuggestions } from "./tag-suggestions";
import { X, Upload, Star, Loader2, Image as ImageIcon } from "lucide-react";

interface PostSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  onSlugChange: (slug: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  excerpt: string;
  onExcerptChange: (excerpt: string) => void;
  featured: boolean;
  onFeaturedChange: (featured: boolean) => void;
  featureImage: string;
  onFeatureImageChange: (url: string) => void;
  slugPrefix?: string;
  // Auto-tag suggestion context
  postId?: string;
  title?: string;
  subtitle?: string;
  content?: string;
}

export function PostSettingsPanel({
  open,
  onOpenChange,
  slug,
  onSlugChange,
  tags,
  onTagsChange,
  excerpt,
  onExcerptChange,
  featured,
  onFeaturedChange,
  featureImage,
  onFeatureImageChange,
  slugPrefix = "nowbind.com/post/",
  postId = "",
  title = "",
  subtitle = "",
  content = "",
}: PostSettingsPanelProps) {
  const { uploadMedia, uploading } = useMediaUpload();
  const [tagInput, setTagInput] = useState("");

  const { suggestions, isLoading: suggestionsLoading, acceptSuggestion, dismissSuggestion } =
    useTagSuggestions({
      postId,
      title,
      subtitle,
      excerpt,
      content,
      selectedTags: tags,
    });

  const hasAutoTagged = useRef(false);

  useEffect(() => {
    // Only auto-tag once per session if there are no tags selected yet
    if (!hasAutoTagged.current && tags.length === 0 && suggestions.length > 0) {
      hasAutoTagged.current = true;
      const top3 = suggestions.slice(0, 3).map((s) => s.matched_tag || s.keyword);
      // Deduplicate — multiple suggestions can resolve to the same matched_tag
      const unique = [...new Set(top3)];
      if (unique.length > 0) {
        onTagsChange([...tags, ...unique]);
      }
    }
  }, [suggestions, tags, onTagsChange]);

  const addTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onTagsChange([...tags, tag]);
      setTagInput("");
    }
  }, [tagInput, tags, onTagsChange]);

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleFeatureImageUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await uploadMedia(file);
        onFeatureImageChange(url);
      } catch (err) {
        console.error("Failed to upload feature image:", err);
      }
    };
    input.click();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] overflow-y-auto sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Post Settings</SheetTitle>
          <SheetDescription>Configure your post metadata</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4 pt-0">
          {/* Post URL / Slug */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Post URL</label>
            <div className="flex items-center gap-0 rounded-md border">
              <span className="shrink-0 bg-muted px-2 py-2 text-xs text-muted-foreground rounded-md mx-0.5">
                {slugPrefix}
              </span>
              <Input
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                className="border-0 shadow-none"
                placeholder="post-slug"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
            />

            {/* AI-powered tag suggestions */}
            <TagSuggestions
              suggestions={suggestions}
              isLoading={suggestionsLoading}
              onAccept={(keyword) => {
                // Add the matched tag or the keyword itself to the tag list
                const suggestion = suggestions.find((s) => s.keyword === keyword);
                const tagName = suggestion?.is_existing_tag && suggestion.matched_tag
                  ? suggestion.matched_tag
                  : keyword;
                if (!tags.some((t) => t.toLowerCase() === tagName.toLowerCase())) {
                  onTagsChange([...tags, tagName]);
                }
                acceptSuggestion(keyword);
              }}
              onDismiss={dismissSuggestion}
            />
          </div>

          {/* Excerpt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Excerpt</label>
            <Textarea
              value={excerpt}
              onChange={(e) => onExcerptChange(e.target.value)}
              placeholder="A short summary of your post..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {excerpt.length}/300 characters
            </p>
          </div>

          {/* Feature this post */}
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className={`h-4 w-4 ${featured ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">Feature this post</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={featured}
                aria-label="Toggle featured post"
                onClick={() => onFeaturedChange(!featured)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  featured ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
                    featured ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
            <p className="text-xs text-muted-foreground">
              Featured posts are highlighted on the explore page.
            </p>
          </div>

          {/* Feature Image */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Feature Image</label>
            {featureImage ? (
              <div className="relative">
                <img
                  src={featureImage}
                  alt="Feature"
                  className="h-40 w-full rounded-md border object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    onClick={handleFeatureImageUpload}
                    disabled={uploading}
                    aria-label="Replace feature image"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    onClick={() => onFeatureImageChange("")}
                    aria-label="Remove feature image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleFeatureImageUpload}
                disabled={uploading}
                className="flex h-32 w-full items-center justify-center rounded-md border-2 border-dashed text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground/70"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-xs">Upload feature image</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
