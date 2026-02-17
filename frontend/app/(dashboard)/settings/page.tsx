"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMediaUpload } from "@/lib/hooks/use-media-upload";
import type { NotificationPreferences } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Download, Trash2, Upload, Globe, Twitter, Github } from "lucide-react";
import { API_URL } from "@/lib/constants";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, refetch } = useAuth();
  const { uploadMedia, uploading: avatarUploading } = useMediaUpload();

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  // SEO fields
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  // State
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);

  // Delete account
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user) {
      setDisplayName(user.display_name || "");
      setBio(user.bio || "");
      setAvatarUrl(user.avatar_url || "");
      setWebsite(user.website || "");
      setTwitterUrl(user.twitter_url || "");
      setGithubUrl(user.github_url || "");
      setMetaTitle(user.meta_title || "");
      setMetaDescription(user.meta_description || "");
      api
        .get<NotificationPreferences>("/notifications/preferences")
        .then(setNotifPrefs)
        .catch(() => {});
    }
  }, [user, authLoading, router]);

  const handleAvatarUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await uploadMedia(file);
        setAvatarUrl(url);
        // Immediately persist to backend so it survives refresh
        await api.put("/users/me", { avatar_url: url });
        toast.success("Avatar updated");
      } catch {
        toast.error("Failed to upload avatar");
      }
    };
    input.click();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [
        api.put("/users/me", {
          display_name: displayName,
          bio,
          avatar_url: avatarUrl,
          website,
          twitter_url: twitterUrl,
          github_url: githubUrl,
          meta_title: metaTitle,
          meta_description: metaDescription,
        }),
      ];
      if (notifPrefs) {
        promises.push(
          api.put("/notifications/preferences", {
            new_follower: notifPrefs.new_follower,
            new_comment: notifPrefs.new_comment,
            new_like: notifPrefs.new_like,
          })
        );
      }
      await Promise.all(promises);
      await refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    window.open(`${API_URL}/users/me/export`, "_blank");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      await api.delete("/users/me", { confirm: "DELETE" });
      toast.success("Account deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-xl px-4 py-8">
          <h1 className="mb-6 text-2xl font-bold">Settings</h1>

          {authLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Profile section */}
              <section className="space-y-6">
                <h2 className="text-lg font-semibold">Profile</h2>

                {/* Avatar with upload */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={avatarUrl} alt={displayName || user?.username || ""} />
                      <AvatarFallback className="text-xl">
                        {displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      onClick={handleAvatarUpload}
                      disabled={avatarUploading}
                      className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                    >
                      {avatarUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click the icon to upload a custom avatar.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={user?.email || ""} disabled />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Username</label>
                  <Input value={user?.username || ""} disabled />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Bio</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    {bio.length}/500 characters
                  </p>
                </div>

                {/* Social links */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Social Links</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        Website
                      </label>
                      <Input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Twitter className="h-3.5 w-3.5" />
                        X (Twitter)
                      </label>
                      <Input
                        value={twitterUrl}
                        onChange={(e) => setTwitterUrl(e.target.value)}
                        placeholder="https://x.com/username"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Github className="h-3.5 w-3.5" />
                        GitHub
                      </label>
                      <Input
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/username"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* SEO & Sharing section */}
              <section className="space-y-4 border-t pt-6">
                <h2 className="text-lg font-semibold">SEO & Sharing</h2>
                <p className="text-sm text-muted-foreground">
                  Override auto-generated SEO metadata for your author page.
                </p>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Meta Title</label>
                  <Input
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="Custom page title for search engines"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">
                    {metaTitle.length}/60 characters recommended
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Meta Description</label>
                  <Textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Custom description for search engines"
                    rows={2}
                    maxLength={155}
                  />
                  <p className="text-xs text-muted-foreground">
                    {metaDescription.length}/155 characters recommended
                  </p>
                </div>
              </section>

              {/* Notification preferences */}
              {notifPrefs && (
                <section className="space-y-4 border-t pt-6">
                  <h2 className="text-lg font-semibold">Notification Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose which notifications you receive.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="notif-followers" className="text-sm">New followers</label>
                      <Switch
                        id="notif-followers"
                        checked={notifPrefs.new_follower}
                        onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, new_follower: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="notif-comments" className="text-sm">New comments</label>
                      <Switch
                        id="notif-comments"
                        checked={notifPrefs.new_comment}
                        onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, new_comment: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label htmlFor="notif-likes" className="text-sm">New likes</label>
                      <Switch
                        id="notif-likes"
                        checked={notifPrefs.new_like}
                        onCheckedChange={(checked) => setNotifPrefs({ ...notifPrefs, new_like: checked })}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Save button — saves profile, SEO, and notification preferences */}
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {saved ? "Saved!" : "Save Changes"}
              </Button>

              {/* Account section */}
              <section className="space-y-4 border-t pt-6">
                <h2 className="text-lg font-semibold">Account</h2>

                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export My Data
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </Button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />

      {/* Delete account confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all your posts. This action cannot be undone.
              Type <span className="font-mono font-bold">DELETE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "DELETE" || deleting}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
