export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

function getMeta(doc: Document, ...names: string[]): string | undefined {
  for (const name of names) {
    const el =
      doc.querySelector(`meta[property="${name}"]`) ??
      doc.querySelector(`meta[name="${name}"]`);
    const val = el?.getAttribute("content")?.trim();
    if (val) return val;
  }
  return undefined;
}

function resolveFavicon(doc: Document, baseUrl: string): string {
  const sel = 'link[rel="icon"], link[rel="shortcut icon"], link[rel~="icon"]';
  const href = doc.querySelector(sel)?.getAttribute("href");
  if (href) {
    try { return new URL(href, baseUrl).href; } catch {}
  }
  try {
    return new URL("/favicon.ico", baseUrl).href;
  } catch {
    return "";
  }
}

function resolveUrl(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try { return new URL(url, base).href; } catch { return url; }
}

async function fetchHtml(url: string): Promise<string> {
  // Direct fetch — works in Tauri native webview; may fail in browser due to CORS
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) return await res.text();
  } catch {}

  // Fallback: allorigins.win CORS proxy
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const json = await res.json();
  return json.contents as string;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const html = await fetchHtml(url);
  const doc = new DOMParser().parseFromString(html, "text/html");

  const title = getMeta(doc, "og:title", "twitter:title") ?? (doc.title?.trim() || undefined);
  const description = getMeta(doc, "og:description", "twitter:description", "description");
  const rawImage = getMeta(doc, "og:image", "twitter:image");
  const image = resolveUrl(rawImage, url);
  const favicon = resolveFavicon(doc, url);

  return { title, description, image, favicon };
}
