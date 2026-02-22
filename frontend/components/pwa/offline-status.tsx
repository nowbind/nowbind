"use client";

import { useState, useEffect, useRef } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const initialOnline = navigator.onLine;
    setIsOnline(initialOnline);
    wasOfflineRef.current = !initialOnline;

    const goOffline = () => {
      clearReconnectTimer();
      setIsOnline(false);
      setShowReconnected(false);
      wasOfflineRef.current = true;
    };

    const goOnline = () => {
      setIsOnline(true);
      if (!wasOfflineRef.current) {
        return;
      }
      wasOfflineRef.current = false;
      setShowReconnected(true);
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      clearReconnectTimer();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors ${
        isOnline
          ? "bg-green-600 text-white"
          : "bg-muted-foreground text-background"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          Back online
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          You are offline
        </>
      )}
    </div>
  );
}
