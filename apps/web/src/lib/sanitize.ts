import DOMPurify from 'dompurify';

/**
 * Sanitize rich-text HTML before rendering. Content is self-authored, but the
 * import pipeline also produces HTML, so we sanitize defensively.
 *
 * Allowances beyond the default html profile, to support the rich editor:
 * - <img> — only when src points at our own /media/ store.
 * - <iframe> — only YouTube embeds (the Youtube TipTap node), nocookie domain.
 * - links open in a new tab safely.
 */
const YT_EMBED = /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\/[\w-]+/;

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'iframe') {
      const src = node.getAttribute('src') ?? '';
      if (!YT_EMBED.test(src)) {
        node.parentNode?.removeChild(node);
        return;
      }
      node.setAttribute('allowfullscreen', '');
      node.setAttribute('loading', 'lazy');
    } else if (tag === 'img') {
      const src = node.getAttribute('src') ?? '';
      if (!src.startsWith('/media/')) {
        node.parentNode?.removeChild(node);
        return;
      }
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
    } else if (tag === 'a' && node.getAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function sanitizeHtml(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'start', 'data-youtube-video', 'target', 'rel', 'loading', 'decoding'],
  });
}
