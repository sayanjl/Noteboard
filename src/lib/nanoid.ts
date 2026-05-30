/** Tiny crypto-based ID generator — no dependency needed. */
export function nanoid(size = 21): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (b) => chars[b & 63]).join("");
}
