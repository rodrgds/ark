import { describe, expect, test } from 'bun:test';
import { arkDownloadHeaders, arkUserAgent } from '@/services/files/http-headers';
import { stripFailedImageTags } from '@/services/files/snapshot-html';

const BASE_URL =
  'https://www.cdc.gov/water-emergency/safety/guidelines-for-personal-hygiene-during-an-emergency.html';

describe('stripFailedImageTags', () => {
  test('strips only the failed <img> tags by absolute URL', () => {
    const html = `
      <figure><img src="https://www.cdc.gov/a.png" alt="A"></figure>
      <p><img src="https://www.cdc.gov/b.png" alt="B"></p>
    `;
    const failed = new Set<string>(['https://www.cdc.gov/b.png']);
    const out = stripFailedImageTags(html, BASE_URL, failed);
    expect(out).toContain('a.png');
    expect(out).not.toContain('b.png');
  });

  test('resolves relative URLs against the base URL', () => {
    const html = `<p><img src="/water-emergency/media/images/Wash-Your-Hands.JPG" alt=""></p>`;
    const failed = new Set<string>([
      'https://www.cdc.gov/water-emergency/media/images/Wash-Your-Hands.JPG',
    ]);
    const out = stripFailedImageTags(html, BASE_URL, failed);
    expect(out).not.toContain('Wash-Your-Hands.JPG');
  });

  test('leaves HTML unchanged when failed set is empty', () => {
    const html = `<p><img src="https://example.com/x.png"></p>`;
    const out = stripFailedImageTags(html, BASE_URL, new Set());
    expect(out).toBe(html);
  });

  test('does not touch images with non-matching src', () => {
    const html = `<p><img src="https://example.com/x.png" alt="x"></p>`;
    const failed = new Set<string>(['https://example.com/other.png']);
    const out = stripFailedImageTags(html, BASE_URL, failed);
    expect(out).toContain('x.png');
  });
});

describe('arkDownloadHeaders', () => {
  test('uses an Android user agent only for Android downloads', () => {
    const headers = arkDownloadHeaders({ platform: 'android' });

    expect(headers['User-Agent']).toContain('Android');
    expect(headers['Accept-Encoding']).toBe('identity');
  });

  test('does not identify iOS downloads as Android', () => {
    const userAgent = arkUserAgent('ios');

    expect(userAgent).toContain('iPhone');
    expect(userAgent).not.toContain('Android');
  });

  test('preserves snapshot-specific Accept headers', () => {
    const headers = arkDownloadHeaders({
      accept: 'text/html,application/xhtml+xml,*/*',
      platform: 'ios',
    });

    expect(headers.Accept).toBe('text/html,application/xhtml+xml,*/*');
    expect(headers['User-Agent']).toContain('iPhone');
  });
});
