import { describe, expect, test } from 'bun:test';
import { sanitizeArticleHtml } from '@/services/content/zim-html-sanitizer';

describe('sanitizeArticleHtml', () => {
  test('strips script tags including their bodies', () => {
    const html = '<p>safe</p><script>alert(1)</script><p>after</p>';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<p>safe</p>');
    expect(out).toContain('<p>after</p>');
  });

  test('strips self-closing void tags (meta, link, base)', () => {
    const html = '<meta http-equiv="refresh" content="0;url=evil"><link rel="import" href="x">';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain('<meta');
    expect(out).not.toContain('<link');
  });

  test('strips iframes, objects, embeds, forms', () => {
    const html =
      '<iframe src="https://evil"></iframe><object data="x"></object><embed src="y"><form action="post"><input name="x"></form>';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('<object');
    expect(out).not.toContain('<embed');
    expect(out).not.toContain('<form');
    expect(out).not.toContain('<input');
  });

  test('strips inline event handlers', () => {
    const html = '<a href="x" onclick="alert(1)" onmouseover="evil()">click</a>';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('evil()');
    expect(out).toContain('href="x"');
    expect(out).toContain('>click</a>');
  });

  test('neutralises javascript: URLs in href/src/action', () => {
    const html =
      '<a href="javascript:alert(1)">x</a><img src="javascript:alert(2)">';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toMatch(/href\s*=\s*["']\s*javascript:/i);
    expect(out).not.toMatch(/src\s*=\s*["']\s*javascript:/i);
  });

  test('strips doctype declarations and HTML comments', () => {
    const html = '<!doctype html><html><!-- secret --><body><p>visible</p></body></html>';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain('<!doctype');
    expect(out).not.toContain('secret');
    expect(out).toContain('visible');
  });

  test('preserves safe content', () => {
    const html = '<h1>Title</h1><p>Body with <strong>bold</strong> and <em>italic</em>.</p>';
    const out = sanitizeArticleHtml(html);
    expect(out).toBe(html);
  });

  test('returns empty string for empty input', () => {
    expect(sanitizeArticleHtml('')).toBe('');
  });
});
