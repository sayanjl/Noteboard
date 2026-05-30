export function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function getTwitterId(url: string): string | null {
  const m = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return m ? m[1] : null;
}

export function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|tv)\//.test(url);
}

export function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

export type UrlKind = "youtube" | "twitter" | "instagram" | "link";

export function classifyUrl(url: string): UrlKind {
  if (getYouTubeId(url)) return "youtube";
  if (getTwitterId(url)) return "twitter";
  if (isInstagramUrl(url)) return "instagram";
  return "link";
}
