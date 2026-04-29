"use client";

import { ShieldAlert } from "lucide-react";

interface ModerationAlertProps {
  message: string;
}

export function ModerationAlert({ message }: ModerationAlertProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900/50 dark:bg-red-950/30">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
      <div className="space-y-1">
        <p className="font-semibold text-red-800 dark:text-red-300">
          Content Policy Violation
        </p>
        <p className="text-red-700 dark:text-red-400">{message}</p>
      </div>
    </div>
  );
}
