import { parseNikeDescription } from "../lib/parseNikeDescription";

type Params = {
  sku: string;
  marketplace: string; // "US"
  language: string; // "en"
  channelId?: string;
};

type Output = {
  sku: string;
  title: string;
  subtitle: string;
  description: string;
  shortDescription: string;
  benefits: string[];
  productDetails: string[];
  colorway: string;
  price_usd: number;
  gallery_images: string[];
  thumbnail: string;
};

const DEFAULT_CHANNEL_ID = "d9a5bc42-4b9c-4976-858a-f159cf99c647";

function looksLikeNikeCdn(url: unknown): url is string {
  if (typeof url !== "string") return false;
  return (
    url.includes("static.nike.com") ||
    url.includes("/a/images/") ||
    url.includes("secure-images.nike.com/is/image")
  );
}

function isSecureNikeImage(url: string): boolean {
  return url.includes("secure-images.nike.com/is/image");
}

function uniqKeepOrder(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function deriveThumbFromGallery(gallery0: string): string {
  if (gallery0.includes("/t_default/")) return gallery0.replace("/t_default/", "/t_PDP_144_v1/");
  return gallery0;
}

function buildImageSetFromProductImageUrl(productImageUrl: string): string[] {
  const clean = productImageUrl.split("?")[0];
  if (!looksLikeNikeCdn(clean)) return [];
  if (!isSecureNikeImage(clean)) return [clean];

  const lastSlash = clean.lastIndexOf("/");
  if (lastSlash === -1 || lastSlash >= clean.length - 1) {
    return [clean];
  }

  const prefix = clean.slice(0, lastSlash + 1);
  const asset = clean.slice(lastSlash + 1);
  const assetRoot = asset.replace(/_[A-Z]+_PREM$/i, "");
  const views = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const generated = views.map((view) => `${prefix}${assetRoot}_${view}_PREM`);
  return uniqKeepOrder([clean, ...generated]);
}

function pickVariantProductInfo(obj0: any, sku: string) {
  const list: any[] = Array.isArray(obj0?.productInfo) ? obj0.productInfo : [];
  if (list.length === 0) return null;
  return list.find((pi) => pi?.merchProduct?.styleColor === sku) ?? list[0] ?? null;
}

function pickTitle(pi: any, obj0: any): string {
  return (
    pi?.productContent?.fullTitle || 
    pi?.productContent?.title || 
    obj0?.publishedContent?.properties?.title ||
    obj0?.publishedContent?.properties?.seo?.title ||
    "Nike Product"
  );
}

function pickSubtitle(pi: any, obj0: any): string {
  return (
    pi?.productContent?.subtitle ||
    pi?.productContent?.productType ||
    obj0?.publishedContent?.properties?.subtitle ||
    obj0?.publishedContent?.properties?.products?.[0]?.productType ||
    ""
  );
}

// ✅ ЗАСВАР: Тайлбарыг форматтайгаар авах функц
function pickDescription(pi: any, obj0: any): string {
  let desc = 
    pi?.productContent?.description || 
    pi?.productContent?.longDescription || 
    obj0?.publishedContent?.properties?.description || 
    obj0?.publishedContent?.properties?.subtitle || 
    "";
  
  if (!desc || typeof desc !== "string") return "";

  // HTML бүтцийг Текст бүтэц рүү хөрвүүлэх
  let formatted = desc
    // Headings -> New lines with spacing
    .replace(/<h[1-6][^>]*>/gi, "\n\n") 
    .replace(/<\/h[1-6]>/gi, "")

    // Breaks & Paragraphs -> New lines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")

    // Lists -> Bullet points
    .replace(/<ul[^>]*>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "");

  // Remove remaining tags
  formatted = formatted.replace(/<[^>]*>?/gm, "");

  // Decode entities
  formatted = formatted
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Cleanup whitespace (max 2 newlines)
  formatted = formatted.replace(/\n\s*\n\s*\n/g, "\n\n");
  
  return formatted.trim();
}

function pickColorway(pi: any, obj0: any): string {
  return (
    pi?.productContent?.colorDescription ||
    pi?.productContent?.colorway ||
    obj0?.publishedContent?.properties?.products?.[0]?.colorDescription ||
    obj0?.publishedContent?.properties?.products?.[0]?.colorway ||
    "UNKNOWN"
  );
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nestedCandidates: unknown[] = [
      obj.value,
      obj.amount,
      obj.price,
      obj.currentPrice,
      obj.discountedPrice,
      obj.fullPrice,
    ];

    for (const candidate of nestedCandidates) {
      const parsed = parseNumberish(candidate);
      if (parsed != null) return parsed;
    }
  }

  return null;
}

function pickPrice(pi: any): number | null {
  const rawPrice =
    pi?.merchPrice?.currentPrice ??
    pi?.merchPrice?.discountedPrice ??
    pi?.merchPrice?.fullPrice;

  return parseNumberish(rawPrice);
}

function getSingleBestUrl(item: any): string | null {
  const props = item?.properties || item;
  const candidates = [
    props?.portrait?.url,
    props?.portraitURL,
    props?.squarish?.url,
    props?.squarishURL,
    props?.landscape?.url,
    props?.url,
    props?.landscapeURL,
    props?.imageUrl,
    props?.src
  ];

  for (const u of candidates) {
    if (looksLikeNikeCdn(u)) return u;
  }
  return null;
}

function findGalleryArray(obj: any): any[] | null {
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;

    if (Array.isArray(cur)) {
      const first = cur[0];
      if (first && typeof first === "object") {
        const props = first.properties || first;
        if (
          props?.portrait?.url ||
          props.portraitURL || 
          props?.squarish?.url ||
          props.squarishURL || 
          (props.url && looksLikeNikeCdn(props.url))
        ) {
          return cur; 
        }
      }
    }
    for (const key of Object.keys(cur)) {
      if (key === "productInfo" || key === "merchPrice") continue; 
      stack.push(cur[key]);
    }
  }
  return null;
}

function extractFromProductInfo(pi: any): string[] {
  const imageUrls: unknown = pi?.imageUrls;

  if (Array.isArray(imageUrls)) {
    return uniqKeepOrder(imageUrls.filter(looksLikeNikeCdn));
  }

  if (!imageUrls || typeof imageUrls !== "object") {
    return [];
  }

  const urlObj = imageUrls as Record<string, unknown>;
  const gallery: string[] = [];

  if (typeof urlObj.productImageUrl === "string") {
    gallery.push(...buildImageSetFromProductImageUrl(urlObj.productImageUrl));
  }

  const directCandidates = [
    urlObj.portraitURL,
    urlObj.squarishURL,
    urlObj.url,
    urlObj.landscapeURL,
    urlObj.imageUrl,
    urlObj.src,
  ];

  for (const candidate of directCandidates) {
    if (looksLikeNikeCdn(candidate)) {
      gallery.push(candidate);
    }
  }

  return uniqKeepOrder(gallery);
}

function extractSmartDeep(obj0: any): string[] {
  const out: string[] = [];
  const stack = [obj0];
  while(stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (typeof cur === "string" && looksLikeNikeCdn(cur) && /\.(png|jpg|webp)/.test(cur)) {
      out.push(cur);
    } else if (typeof cur === "object") {
      for (const k of Object.keys(cur)) stack.push(cur[k]);
    }
  }
  return uniqKeepOrder(out);
}

function toHighResNikeUrl(url: string) {
  if (url.startsWith("//")) url = "https:" + url;
  return url.replace(
    /\/a\/images\/t_[^/]+\//,
    "/a/images/t_web_pdp_535_v2/f_auto/"
  );
}

function hasOnlySecureImages(urls: string[]): boolean {
  return urls.length > 0 && urls.every((url) => isSecureNikeImage(url));
}

function dropSecureImages(urls: string[]): string[] {
  return urls.filter((url) => !isSecureNikeImage(url));
}

function normalizeProductPageSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  let slug = raw.trim();
  if (!slug) return null;

  if (slug.startsWith("http://") || slug.startsWith("https://")) {
    try {
      slug = new URL(slug).pathname;
    } catch {
      return null;
    }
  }

  slug = slug.replace(/^\/+|\/+$/g, "");
  if (!slug) return null;

  const tIndex = slug.indexOf("t/");
  if (tIndex >= 0) {
    slug = slug.slice(tIndex + 2);
  }

  slug = slug.replace(/^\/+|\/+$/g, "");
  return slug || null;
}

function pickProductPageSlug(pi: any, obj0: any): string | null {
  const candidates: unknown[] = [
    pi?.productContent?.slug,
    pi?.productContent?.url,
    pi?.merchProduct?.url,
    pi?.merchProduct?.pdpUrl,
    pi?.merchProduct?.seoSlug,
    obj0?.publishedContent?.properties?.seo?.slug,
    obj0?.publishedContent?.properties?.seo?.canonicalUrl,
    obj0?.publishedContent?.properties?.slug,
    obj0?.publishedContent?.properties?.products?.[0]?.slug,
    obj0?.publishedContent?.properties?.products?.[0]?.url,
  ];

  for (const candidate of candidates) {
    const slug = normalizeProductPageSlug(candidate);
    if (slug) return slug;
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findProductPageSlugBySkuSearch(sku: string): Promise<string | null> {
  const searchUrl = `https://www.nike.com/w?q=${encodeURIComponent(sku)}&vst=${encodeURIComponent(sku)}`;
  const response = await fetch(searchUrl, {
    headers: { "user-agent": "Mozilla/5.0" },
  });

  if (!response.ok) return null;

  const html = await response.text();
  const normalizedHtml = html.replace(/\\\//g, "/");
  const escapedSku = escapeRegExp(sku);

  const skuPathMatch = normalizedHtml.match(
    new RegExp(
      `(?:https?:\\/\\/www\\.nike\\.com)?(\\/t\\/[A-Za-z0-9\\-_/]*${escapedSku}[A-Za-z0-9\\-_/]*)`,
      "i"
    )
  );

  if (skuPathMatch?.[1]) {
    return normalizeProductPageSlug(skuPathMatch[1]);
  }

  const anyPathMatch = normalizedHtml.match(
    /(?:https?:\/\/www\.nike\.com)?(\/t\/[A-Za-z0-9\-_\/]+)/i
  );

  if (anyPathMatch?.[1]) {
    return normalizeProductPageSlug(anyPathMatch[1]);
  }

  return null;
}

function normalizeSku(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function generateSkuCandidates(rawSku: string): string[] {
  const normalized = normalizeSku(rawSku);
  const [style = "", color = ""] = normalized.split("-");
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (stylePart: string) => {
    if (!stylePart) return;
    const candidate = color ? `${stylePart}-${color}` : stylePart;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push(candidate);
  };

  pushCandidate(style);
  pushCandidate(style.replace(/O/g, "0"));
  pushCandidate(style.replace(/0/g, "O"));
  pushCandidate(style.replace(/I/g, "1"));
  pushCandidate(style.replace(/1/g, "I"));
  pushCandidate(style.replace(/O/g, "0").replace(/I/g, "1"));
  pushCandidate(style.replace(/0/g, "O").replace(/1/g, "I"));

  return candidates;
}

function extractStyleColorCandidatesFromSearch(html: string): string[] {
  const normalizedHtml = html.replace(/\\\//g, "/");
  const matches = normalizedHtml.match(/\b[A-Z0-9]{5,8}-[0-9]{3}\b/gi) ?? [];
  return uniqKeepOrder(matches.map((m) => m.toUpperCase()));
}

function scoreStyleColorCandidate(candidate: string, querySku: string): number {
  const normalizedCandidate = candidate.replace(/[^A-Z0-9]/g, "");
  const normalizedQuery = querySku.replace(/[^A-Z0-9]/g, "");
  const queryColor = querySku.split("-")[1] ?? "";

  let score = 0;
  if (candidate === querySku) score += 100;
  if (normalizedQuery && normalizedCandidate.includes(normalizedQuery)) score += 40;
  if (queryColor && candidate.endsWith(`-${queryColor}`)) score += 25;

  return score;
}

function isWithinOneEditDistance(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff += 1;
      if (diff > 1) return false;
    }
    return true;
  }

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;
    i += 1;
  }

  return true;
}

async function findStyleColorCandidatesBySearchQuery(sku: string): Promise<string[]> {
  const searchUrl = `https://www.nike.com/w?q=${encodeURIComponent(sku)}&vst=${encodeURIComponent(sku)}`;
  const response = await fetch(searchUrl, {
    headers: { "user-agent": "Mozilla/5.0" },
  });

  if (!response.ok) return [];

  const html = await response.text();
  const candidates = extractStyleColorCandidatesFromSearch(html);
  if (candidates.length === 0) return [];

  const ranked = [...candidates].sort(
    (a, b) => scoreStyleColorCandidate(b, sku) - scoreStyleColorCandidate(a, sku)
  );

  return ranked;
}

async function fetchNikeObjectByStyleColor(params: {
  sku: string;
  marketplace: string;
  language: string;
  channelId: string;
}): Promise<any | null> {
  const { sku, marketplace, language, channelId } = params;
  const base = "https://api.nike.com/product_feed/threads/v2";
  const qs = new URLSearchParams();
  qs.set("count", "10");
  qs.append("filter", `channelId(${channelId})`);
  qs.append("filter", `marketplace(${marketplace})`);
  qs.append("filter", `language(${language})`);
  qs.append("filter", `productInfo.merchProduct.styleColor(${sku})`);
  qs.append("fields", "id,productInfo,publishedContent");

  const url = `${base}?${qs.toString()}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Nike API HTTP ${res.status}`);

  const data = (await res.json()) as any;
  return data?.objects?.[0] ?? null;
}

function extractNextData(html: string): any | null {
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  );

  if (!match || !match[1]) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function matchesSku(value: unknown, sku: string): boolean {
  return typeof value === "string" && value.toUpperCase() === sku.toUpperCase();
}

function nodeHasSku(node: any, sku: string): boolean {
  return (
    matchesSku(node?.styleColor, sku) ||
    matchesSku(node?.sku, sku) ||
    matchesSku(node?.merchProduct?.styleColor, sku) ||
    matchesSku(node?.productData?.styleColor, sku)
  );
}

function extractSkuContentImages(nextData: any, sku: string): any[] {
  const out: any[] = [];
  const stack: Array<{ node: any; skuContext: boolean }> = [
    { node: nextData, skuContext: false },
  ];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    const { node, skuContext } = current;
    if (!node || typeof node !== "object") continue;

    const currentSkuContext = skuContext || nodeHasSku(node, sku);
    if (currentSkuContext && Array.isArray(node.contentImages)) {
      out.push(...node.contentImages);
    }

    if (Array.isArray(node)) {
      for (const child of node) {
        stack.push({ node: child, skuContext: currentSkuContext });
      }
    } else {
      for (const value of Object.values(node)) {
        stack.push({ node: value, skuContext: currentSkuContext });
      }
    }
  }

  return out;
}

async function extractSkuGalleryFromProductPage(
  slug: string,
  sku: string
): Promise<string[]> {
  const productUrl = `https://www.nike.com/t/${slug}`;
  const response = await fetch(productUrl, {
    headers: { "user-agent": "Mozilla/5.0" },
  });

  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  const nextData = extractNextData(html);
  if (!nextData) return [];

  const contentImages = extractSkuContentImages(nextData, sku);
  if (contentImages.length === 0) return [];

  const gallery: string[] = [];
  for (const item of contentImages) {
    const best = getSingleBestUrl(item);
    if (best) gallery.push(best);
  }

  return uniqKeepOrder(gallery);
}

function extractGalleryFromPublishedContent(publishedContent: any): string[] {
  const gallery: string[] = [];
  const galleryNodes = findGalleryArray(publishedContent);

  if (!galleryNodes || galleryNodes.length === 0) {
    return [];
  }

  for (const node of galleryNodes) {
    const best = getSingleBestUrl(node);
    if (best) gallery.push(best);
  }

  return uniqKeepOrder(gallery);
}

export async function fetchNikeBySku(p: Params): Promise<Output> {
  const { sku, marketplace, language, channelId = DEFAULT_CHANNEL_ID } = p;
  const normalizedSku = normalizeSku(sku);
  let resolvedSku = normalizedSku;
  let obj0: any | null = null;

  for (const candidate of generateSkuCandidates(normalizedSku)) {
    const candidateObj = await fetchNikeObjectByStyleColor({
      sku: candidate,
      marketplace,
      language,
      channelId,
    });
    if (candidateObj) {
      obj0 = candidateObj;
      resolvedSku = candidate;
      break;
    }
  }

  if (!obj0) {
    const [queryStyle = "", queryColor = ""] = normalizedSku.split("-");
    const searchCandidates = await findStyleColorCandidatesBySearchQuery(normalizedSku);
    const likelyCandidates = searchCandidates.filter((candidate) => {
      const [candidateStyle = "", candidateColor = ""] = candidate.split("-");
      if (queryColor && candidateColor !== queryColor) return false;
      return isWithinOneEditDistance(candidateStyle, queryStyle);
    });

    for (const searchCandidate of likelyCandidates.slice(0, 10)) {
      const candidateObj = await fetchNikeObjectByStyleColor({
        sku: searchCandidate,
        marketplace,
        language,
        channelId,
      });
      if (candidateObj) {
        obj0 = candidateObj;
        resolvedSku = searchCandidate;
        break;
      }
    }
  }

  if (!obj0) throw new Error("VARIANT_NOT_FOUND");

  const pi = pickVariantProductInfo(obj0, resolvedSku);
  const effectiveSku =
    typeof pi?.merchProduct?.styleColor === "string" && pi.merchProduct.styleColor
      ? pi.merchProduct.styleColor.toUpperCase()
      : resolvedSku;
  
  const title = pickTitle(pi, obj0);
  const subtitle = pickSubtitle(pi, obj0);
  const rawDescription = pickDescription(pi, obj0);
  const parsedDescription = parseNikeDescription(rawDescription);
  const shortDescription = parsedDescription.shortDescription || rawDescription;
  const colorway = pi ? pickColorway(pi, obj0) : "UNKNOWN";
  const price = pi ? pickPrice(pi) : 0;

  let gallery: string[] = [];
  if (pi) {
    gallery = extractFromProductInfo(pi);
  }

  let productPageSlug = pickProductPageSlug(pi, obj0);
  if (!productPageSlug && (gallery.length === 0 || hasOnlySecureImages(gallery))) {
    try {
      productPageSlug = await findProductPageSlugBySkuSearch(effectiveSku);
    } catch {
      // Search fallback is best-effort only.
    }
  }

  if ((gallery.length === 0 || hasOnlySecureImages(gallery)) && productPageSlug) {
    try {
      const pageGallery = await extractSkuGalleryFromProductPage(productPageSlug, effectiveSku);
      if (pageGallery.length > 0) {
        gallery = pageGallery;
      }
    } catch {
      // Ignore fallback errors and continue with available image sources.
    }
  }

  if (gallery.length === 0 || hasOnlySecureImages(gallery)) {
    const publishedGallery = extractGalleryFromPublishedContent(obj0?.publishedContent);
    if (publishedGallery.length > 0) {
      gallery = publishedGallery;
    }
  }

  if (gallery.length === 0 || hasOnlySecureImages(gallery)) {
    gallery = extractSmartDeep(obj0);
  }

  let gallery_images = gallery.map(toHighResNikeUrl);
  gallery_images = uniqKeepOrder(gallery_images);
  gallery_images = dropSecureImages(gallery_images);
  if (gallery_images.length >= 4) gallery_images = gallery_images.filter(u => !u.endsWith("/image.png"));

  const thumbnail = gallery_images.length > 0 
    ? toHighResNikeUrl(deriveThumbFromGallery(gallery_images[0]))
    : "";

  return {
    sku: effectiveSku,
    title,
    subtitle,
    description: shortDescription,
    shortDescription,
    benefits: parsedDescription.benefits,
    productDetails: parsedDescription.productDetails,
    colorway,
    price_usd: price || 0,
    gallery_images,
    thumbnail,
  };
}

export async function fetchNikeRaw(p: any) {
    return fetchNikeBySku(p);
}
