"use client";

import { toast } from "sonner";

export interface AIActionOptions {
  prompt: string;
  option: string;
  context?: string;
  tone?: string;
}

export interface AIResult {
  text: string;
  error?: boolean;
}

export const aiService = {
  async generate(options: AIActionOptions): Promise<AIResult> {
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.text || "AI generation failed");
        return { text: "", error: true };
      }

      return { text: data.text };
    } catch (err) {
      const message = "Failed to generate text. Please check your connection.";
      toast.error(message);
      console.error("AI Service Error:", err);
      return { text: "", error: true };
    }
  },
};
