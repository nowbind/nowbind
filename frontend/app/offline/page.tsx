"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <WifiOff className="h-12 w-12 text-muted-foreground" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight">You&apos;re offline</h1>
      <p className="mt-2 text-center text-muted-foreground">
        Check your internet connection and try again.
      </p>
      <Button className="mt-6" onClick={() => typeof window !== "undefined" && window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}
