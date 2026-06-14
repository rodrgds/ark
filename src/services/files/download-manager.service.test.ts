import { describe, expect, test } from 'bun:test';
import { __test__ as downloadInternals } from '@/services/files/download-manager.service';

const { stripFailedImageTags } = downloadInternals;
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
