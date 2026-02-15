"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/use-auth";
import type { NotificationPreferences } from "@/lib/types";
import { Loader2, Save } from "lucide-react";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
      setBio(user.bio || "");
      api
        .get<NotificationPreferences>("/notifications/preferences")
        .then(setNotifPrefs)
        .catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/users/me", { display_name: displayName, bio });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!notifPrefs) return;
    setSavingPrefs(true);
    try {
      await api.put("/notifications/preferences", {
        new_follower: notifPrefs.new_follower,
        new_comment: notifPrefs.new_comment,
        new_like: notifPrefs.new_like,
      });
    } catch {
      // ignore
    } finally {
      setSavingPrefs(false);
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

                {user?.avatar_url && (
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={user.avatar_url} alt={user.display_name || user.username} />
                      <AvatarFallback className="text-xl">
                        {user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-muted-foreground">
                      Avatar from Gravatar or OAuth provider.
                    </p>
                  </div>
                )}

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
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saved ? "Saved!" : "Save Changes"}
                </Button>
              </section>

              {/* Notification preferences */}
              {notifPrefs && (
                <section className="space-y-4 border-t pt-6">
                  <h2 className="text-lg font-semibold">Notification Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Choose which notifications you receive.
                  </p>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm">New followers</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.new_follower}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, new_follower: e.target.checked })}
                        className="h-4 w-4 rounded border-input"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">New comments</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.new_comment}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, new_comment: e.target.checked })}
                        className="h-4 w-4 rounded border-input"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">New likes</span>
                      <input
                        type="checkbox"
                        checked={notifPrefs.new_like}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, new_like: e.target.checked })}
                        className="h-4 w-4 rounded border-input"
                      />
                    </label>
                  </div>

                  <Button size="sm" onClick={handleSavePrefs} disabled={savingPrefs}>
                    {savingPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Preferences
                  </Button>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
