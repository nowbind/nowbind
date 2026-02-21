"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { key: "j", description: "Next post" },
  { key: "k", description: "Previous post" },
  { key: "o", description: "Open post" },
  { key: "l", description: "Like / unlike" },
  { key: "b", description: "Bookmark / unbookmark" },
  { key: "?", description: "Toggle this help" },
  { key: "Esc", description: "Clear selection" },
];

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map(({ key, description }) => (
            <div
              key={key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-muted-foreground">
                {description}
              </span>
              <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Like and bookmark shortcuts require sign-in.
        </p>
      </DialogContent>
    </Dialog>
  );
}
