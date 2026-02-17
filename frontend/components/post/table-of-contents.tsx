"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  contentSelector?: string;
  /** "mobile" = inline collapsible only, "desktop" = sticky sidebar only */
  variant?: "mobile" | "desktop";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function TableOfContents({ contentSelector = ".tiptap-content, .markdown-content", variant }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll sidebar TOC to keep active item visible
  useEffect(() => {
    if (!activeId || !sidebarRef.current) return;
    const activeEl = sidebarRef.current.querySelector(`[data-toc-id="${activeId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeId]);

  // Extract headings from rendered content
  useEffect(() => {
    const findHeadings = () => {
      const container = document.querySelector(contentSelector);
      if (!container) return;

      const headings = container.querySelectorAll("h2, h3");
      const tocItems: TocItem[] = [];

      headings.forEach((heading) => {
        const el = heading as HTMLElement;
        if (!el.id) {
          el.id = slugify(el.textContent || "");
        }
        if (el.id && el.textContent) {
          tocItems.push({
            id: el.id,
            text: el.textContent.trim(),
            level: el.tagName === "H2" ? 2 : 3,
          });
        }
      });

      setItems(tocItems);
    };

    // Delay to let content render
    const timer = setTimeout(findHeadings, 300);
    return () => clearTimeout(timer);
  }, [contentSelector]);

  // IntersectionObserver to track active heading
  useEffect(() => {
    if (items.length < 3) return;

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setMobileOpen(false);
    }
  }, []);

  // Only show for posts with 3+ headings
  if (items.length < 3) return null;

  const tocList = (
    <nav aria-label="Table of contents">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              data-toc-id={item.id}
              onClick={() => scrollTo(item.id)}
              className={cn(
                "block w-full text-left text-sm transition-colors hover:text-foreground",
                item.level === 3 && "pl-4",
                activeId === item.id
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Desktop: sticky sidebar */}
      {variant !== "mobile" && (
        <aside className={cn("hidden lg:block", variant === "desktop" && "lg:block")}>
          <div ref={sidebarRef} className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              On this page
            </h4>
            {tocList}
          </div>
        </aside>
      )}

      {/* Mobile: collapsible section */}
      {variant !== "desktop" && (
        <div className="mb-6 rounded-lg border lg:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Table of Contents
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                mobileOpen && "rotate-180"
              )}
            />
          </button>
          {mobileOpen && <div className="px-4 pb-4">{tocList}</div>}
        </div>
      )}
    </>
  );
}
