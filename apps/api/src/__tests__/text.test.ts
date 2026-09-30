/* stripHtml turns rich text into plain text for Lify; no tag may survive. */
import { describe, it, expect } from 'vitest';
import { stripHtml } from '../agent/text';

describe('stripHtml', () => {
  it('keeps structure as plain text', () => {
    expect(stripHtml('<p>One</p><ul><li>a</li><li>b</li></ul>')).toContain('- a');
  });

  it('leaves no tag behind, even from nested fragments', () => {
    const out = stripHtml('<<b>script>alert(1)<</b>/script> ok');
    expect(out).not.toMatch(/[<>]/);
    expect(out).toContain('ok');
  });
});
