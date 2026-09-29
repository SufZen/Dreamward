/* ============================================================================
 * apps/api — agent/text.ts
 * Text utilities for the digest: strip TipTap HTML, safe truncation.
 * ========================================================================= */

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/** Convert rich-text HTML to readable plain text (lists → "- " lines). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(h[1-6]|blockquote|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.replaceAll(entity, char);
  }
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/** Truncate on code points (never mid-multibyte) with an ellipsis marker. */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const points = [...text];
  if (points.length <= maxChars) return text;
  return points.slice(0, maxChars).join('') + '…';
}

/** Minimal markdown → HTML for proposal-created content (paragraphs + lists). */
export function markdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const lines = md.split('\n');
  const out: string[] = [];
  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length) {
      out.push(`<ul>${listItems.map((li) => `<li>${li}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      listItems.push(esc(bullet[1] ?? ''));
      continue;
    }
    flushList();
    out.push(`<p dir="auto">${esc(line)}</p>`);
  }
  flushList();
  return out.join('\n');
}
