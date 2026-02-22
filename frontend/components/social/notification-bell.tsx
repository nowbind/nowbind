"use client";

import { useNotifications } from "@/lib/hooks/use-notifications";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NotificationItem } from "./notification-item";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotifications();

  const { isSubscribed, isSupported, subscribe, unsubscribe } =
    usePushNotifications();

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label="Open notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>

        {isSupported && (
          <div className="border-b px-3 py-2">
            {isSubscribed ? (
              <button
                onClick={unsubscribe}
                className="flex w-full items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <BellRing className="h-3.5 w-3.5" />
                Browser notifications on — click to disable
              </button>
            ) : (
              <button
                onClick={subscribe}
                className="flex w-full items-center gap-2 text-xs text-primary hover:text-primary/80"
              >
                <Bell className="h-3.5 w-3.5" />
                Enable browser notifications
              </button>
            )}
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.slice(0, 10).map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={markRead}
              />
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          )}
        </div>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">
              <Link
                href="/notifications"
                className="block rounded-sm px-2 py-1.5 text-center text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                View all notifications
              </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
