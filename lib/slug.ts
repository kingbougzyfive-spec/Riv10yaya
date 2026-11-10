export function slugify(s: string): string {
  const base = s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return base || "event";
}
export const looksLikeId = (k: string) => /^[0-9a-f]{24}$/i.test(k);
