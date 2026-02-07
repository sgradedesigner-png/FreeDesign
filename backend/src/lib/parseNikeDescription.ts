export type ParsedNikeDescription = {
  shortDescription: string;
  benefits: string[];
  productDetails: string[];
};

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function stripBullet(text: string): string {
  return text.replace(/^[-*\u2022\u00B7?]\s*/, '').trim();
}

function splitInlineBullets(text: string): string[] {
  const parts = text
    .split(/[\u2022\u00B7]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isLikelyHeading(text: string): boolean {
  if (!text) return false;
  if (text.length > 60) return false;
  if (text.includes(':')) return false;
  if (/[.!?]$/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 6;
}

function isLikelyDetailLine(text: string): boolean {
  return /^(shown|style|weight|heel-to-toe drop|drop|not intended)\b/i.test(text);
}

function isFeatureHeading(text: string): boolean {
  if (!text) return false;
  if (/^product details?\b/i.test(text)) return false;
  if (/^benefits?\b/i.test(text)) return false;
  if (isLikelyDetailLine(text)) return false;

  if (isLikelyHeading(text)) return true;

  // Support headings like "Flexibility: High", "Stability: High"
  if (!text.includes(':')) return false;
  if (/[.!?]$/.test(text)) return false;

  const [leftRaw, rightRaw] = text.split(':', 2);
  const left = normalizeLine(leftRaw || '');
  const right = normalizeLine(rightRaw || '');
  if (!left || !right) return false;
  if (left.length > 28 || right.length > 24) return false;

  const leftWords = left.split(/\s+/).filter(Boolean).length;
  const rightWords = right.split(/\s+/).filter(Boolean).length;
  if (leftWords > 4 || rightWords > 4) return false;

  return true;
}

function extractFeatureSections(
  lines: string[]
): { intro: string; sections: string[] } {
  const cleaned = lines.map((line) => normalizeLine(line)).filter(Boolean);
  if (cleaned.length === 0) {
    return { intro: '', sections: [] };
  }

  const introParts: string[] = [];
  const sections: string[] = [];
  let i = 0;

  // Intro is everything before the first heading/description pair.
  while (i < cleaned.length) {
    const current = cleaned[i];
    const next = cleaned[i + 1];

    if (isFeatureHeading(current) && next && !isFeatureHeading(next)) {
      break;
    }

    introParts.push(current);
    i++;
  }

  // Parse heading + paragraph blocks into "Heading - Description" format.
  while (i < cleaned.length) {
    const heading = cleaned[i];
    const next = cleaned[i + 1];

    if (isFeatureHeading(heading) && next && !isFeatureHeading(next)) {
      sections.push(`${heading} - ${next}`);
      i += 2;
      continue;
    }

    if (sections.length > 0) {
      sections[sections.length - 1] = normalizeLine(
        `${sections[sections.length - 1]} ${heading}`
      );
    } else {
      introParts.push(heading);
    }

    i++;
  }

  return {
    intro: normalizeLine(introParts.join(' ')),
    sections,
  };
}

export function parseNikeDescription(raw: string): ParsedNikeDescription {
  if (!raw || typeof raw !== 'string') {
    return { shortDescription: '', benefits: [], productDetails: [] };
  }

  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { shortDescription: '', benefits: [], productDetails: [] };
  }

  const lines = normalized.split('\n');

  let section: 'short' | 'benefits' | 'details' = 'short';
  let foundHeading = false;

  const shortLines: string[] = [];
  const benefits: string[] = [];
  const productDetails: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const benefitsMatch = line.match(/^benefits?\b[:\-]?\s*(.*)$/i);
    if (benefitsMatch) {
      foundHeading = true;
      section = 'benefits';
      const rest = normalizeLine(benefitsMatch[1] || '');
      if (rest) {
        for (const item of splitInlineBullets(rest)) {
          const cleaned = stripBullet(item);
          if (cleaned) benefits.push(cleaned);
        }
      }
      continue;
    }

    const detailsMatch = line.match(/^product details?\b[:\-]?\s*(.*)$/i);
    if (detailsMatch) {
      foundHeading = true;
      section = 'details';
      const rest = normalizeLine(detailsMatch[1] || '');
      if (rest) {
        for (const item of splitInlineBullets(rest)) {
          const cleaned = stripBullet(item);
          if (cleaned) productDetails.push(cleaned);
        }
      }
      continue;
    }

    const cleanedLine = stripBullet(normalizeLine(line));
    if (!cleanedLine) continue;

    if (section === 'short') {
      shortLines.push(cleanedLine);
    } else if (section === 'benefits') {
      for (const item of splitInlineBullets(cleanedLine)) {
        const cleaned = stripBullet(item);
        if (cleaned) benefits.push(cleaned);
      }
    } else {
      for (const item of splitInlineBullets(cleanedLine)) {
        const cleaned = stripBullet(item);
        if (cleaned) productDetails.push(cleaned);
      }
    }
  }

  if (!foundHeading) {
    const segments: string[] = [];
    let current: string[] = [];

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) {
        if (current.length) {
          segments.push(normalizeLine(current.join(' ')));
          current = [];
        }
        continue;
      }

      const isBullet = /^[\-*\u2022\u00B7?]\s+/.test(trimmed);
      if (isBullet) {
        if (current.length) {
          segments.push(normalizeLine(current.join(' ')));
          current = [];
        }
        segments.push(stripBullet(trimmed));
        continue;
      }

      current.push(trimmed);
    }

    if (current.length) {
      segments.push(normalizeLine(current.join(' ')));
    }

    const cleanedSegments = segments.filter(Boolean);
    if (cleanedSegments.length === 0) {
      return { shortDescription: normalized.trim(), benefits: [], productDetails: [] };
    }

    const extracted = extractFeatureSections(cleanedSegments);
    if (extracted.sections.length > 0) {
      return {
        shortDescription: extracted.intro || cleanedSegments[0],
        benefits: extracted.sections,
        productDetails: [],
      };
    }

    let shortDescription = cleanedSegments[0];
    let rest = cleanedSegments.slice(1);

    const shortSentences = splitSentences(shortDescription);
    if (shortSentences.length > 2) {
      shortDescription = shortSentences.slice(0, 2).join(' ');
      const remainder = shortSentences.slice(2).join(' ');
      if (remainder) rest = [remainder, ...rest];
    } else if (shortDescription.length > 260) {
      const truncated = shortDescription.slice(0, 260).trim();
      const remainder = shortDescription.slice(260).trim();
      shortDescription = truncated;
      if (remainder) rest = [remainder, ...rest];
    }

    const mergedDetails: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const currentItem = rest[i];
      const nextItem = rest[i + 1];
      if (nextItem && isFeatureHeading(currentItem)) {
        mergedDetails.push(`${currentItem} - ${nextItem}`);
        i++;
      } else {
        mergedDetails.push(currentItem);
      }
    }

    return {
      shortDescription: normalizeLine(shortDescription),
      benefits: [],
      productDetails: mergedDetails,
    };
  }

  const extracted = extractFeatureSections(shortLines);
  const shortDescription =
    extracted.intro || normalizeLine(shortLines.join(' ').trim());
  const mergedBenefits = benefits.length > 0 ? benefits : extracted.sections;

  return {
    shortDescription,
    benefits: mergedBenefits,
    productDetails,
  };
}
