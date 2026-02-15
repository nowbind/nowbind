"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";
import { FileText, Search } from "lucide-react";

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Post[]>([]);
  const router = useRouter();

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const data = await api.get<Post[]>("/search/suggest", {
          q: query,
        });
        setResults(data || []);
      } catch {
        setResults([]);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback(
    (slug: string) => {
      setOpen(false);
      setQuery("");
      router.push(`/post/${slug}`);
    },
    [router]
  );

  const handleSearchAll = useCallback(() => {
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setQuery("");
  }, [query, router]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search posts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query
            ? "No results found. Press Enter to search."
            : "Start typing to search..."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Posts">
            {results.map((post) => (
              <CommandItem
                key={post.id}
                value={post.slug}
                onSelect={() => handleSelect(post.slug)}
              >
                <FileText className="mr-2 h-4 w-4" />
                <div className="flex-1 truncate">
                  <span className="font-medium">{post.title}</span>
                  {post.excerpt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {post.excerpt.slice(0, 60)}...
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {query.trim() && (
          <CommandGroup>
            <CommandItem onSelect={handleSearchAll}>
              <Search className="mr-2 h-4 w-4" />
              Search all for &quot;{query}&quot;
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
