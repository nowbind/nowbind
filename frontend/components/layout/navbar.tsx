"use client";

import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/social/notification-bell";
import { Search, PenSquare, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Logo size={28} />
          <nav className="hidden items-center gap-4 text-sm md:flex">
            <Link
              href="/explore"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Explore
            </Link>
            {user && (
              <Link
                href="/feed"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Feed
              </Link>
            )}
            <Link
              href="/search"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Search
            </Link>
            <Link
              href="/docs"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 md:flex"
            asChild
          >
            <Link href="/search">
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Link>
          </Button>

          <ThemeToggle />

          {user ? (
            <>
              <NotificationBell />
              <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
                <Link href="/editor">
                  <PenSquare className="mr-2 h-4 w-4" />
                  Write
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    aria-label="Open account menu"
                  >
                    <Avatar className="h-7 w-7">
                      {user.avatar_url && (
                        <AvatarImage src={user.avatar_url} alt={user.display_name || user.username} />
                      )}
                      <AvatarFallback className="text-xs">
                        {user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">Your Posts</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/editor">New Post</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/reading-list">Reading List</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/liked">Liked Posts</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/stats">Stats</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/api-keys">API Keys</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/import">Import</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-2 text-sm">
            <Link
              href="/explore"
              className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Explore
            </Link>
            {user && (
              <Link
                href="/feed"
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Feed
              </Link>
            )}
            <Link
              href="/search"
              className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Search
            </Link>
            <Link
              href="/docs"
              className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              Docs
            </Link>
            {user && (
              <Link
                href="/editor"
                className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Write
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
