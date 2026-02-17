"use client";

import { useCallback, useState } from "react";
import { API_URL } from "@/lib/constants";
import { toast } from "sonner";

interface UploadResult {
  url: string;
  mime_type: string;
  size: number;
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadMedia = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/media/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err.error || "Upload failed";
        toast.error(message);
        throw new Error(message);
      }

      const data: UploadResult = await res.json();
      return data.url;
    } catch (err) {
      if (err instanceof Error && !err.message.includes("Upload failed") && !err.message.includes("unsupported")) {
        toast.error("Upload failed. Please try again.");
      }
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { uploadMedia, uploading };
}
