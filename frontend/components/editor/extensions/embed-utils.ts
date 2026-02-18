export function extractTwitterId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

export function extractGistInfo(url: string): { user: string; id: string } | null {
  const match = url.match(/gist\.github\.com\/([^/]+)\/([a-f0-9]+)/);
  return match ? { user: match[1], id: match[2] } : null;
}

export function extractCodePenParts(url: string): { user: string; pen: string } | null {
  const match = url.match(/codepen\.io\/([^/]+)\/(?:pen|full|embed)\/([^/?#]+)/);
  return match ? { user: match[1], pen: match[2] } : null;
}

export function isYoutubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
}

export function detectProvider(url: string): string | null {
  if (extractTwitterId(url)) return "twitter";
  if (extractGistInfo(url)) return "gist";
  if (extractCodePenParts(url)) return "codepen";
  if (isYoutubeUrl(url)) return "youtube";
  return null;
}
