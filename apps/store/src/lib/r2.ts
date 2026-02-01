// src/lib/r2.ts
const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_BASE_URL; 
// жишээ: https://pub-ae3ca9ca99644328a7c71402917f9dae.r2.dev

export function r2Url(pathOrUrl?: string | null) {
  if (!pathOrUrl) return "";                 // ✅ хоосон үед буцаана
  if (pathOrUrl.startsWith("http")) return pathOrUrl; // ✅ full URL бол хэвээр
  if (!R2_PUBLIC_BASE) return "";            // ✅ base байхгүй бол буцаана

  const base = R2_PUBLIC_BASE.replace(/\/$/, "");
  const path = pathOrUrl.replace(/^\//, "");
  return `${base}/${path}`;
}
