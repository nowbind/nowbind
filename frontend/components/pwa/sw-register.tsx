"use client";

import { useEffect } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";

export function SwRegister({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!("serviceWorker" in navigator)) return;

    // In development, clear old registrations to avoid stale cached bundles.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch(() => {
        // Ignore SW cleanup errors in local dev.
      });
  }, []);

  if (process.env.NODE_ENV !== "production") {
    return <>{children}</>;
  }

  return <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>;
}
