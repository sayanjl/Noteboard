/** Measure an image URL and return canvas-friendly dimensions.
 *  - Scales down images that exceed MAX_W × MAX_H (preserving aspect ratio)
 *  - Scales up tiny images to at least MIN_W wide
 *  - Falls back to sensible defaults on error
 */
const MAX_W = 560;
const MAX_H = 480;
const MIN_W = 140;   // don't let tiny icons be unreadably small

export function measureImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();

    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Scale down if exceeds max box
      if (w > MAX_W) { w = MAX_W; h = w / ratio; }
      if (h > MAX_H) { h = MAX_H; w = h * ratio; }

      // Scale up if too tiny (icons, favicons, etc.)
      if (w < MIN_W) { w = MIN_W; h = w / ratio; }

      resolve({ width: Math.round(w), height: Math.round(h) });
    };

    img.onerror = () => resolve({ width: 280, height: 200 });
    img.src = url;
  });
}
