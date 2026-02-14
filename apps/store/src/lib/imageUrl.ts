export function imageUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http')) return pathOrUrl;

  // Legacy relative path fallback for older records.
  return pathOrUrl;
}

