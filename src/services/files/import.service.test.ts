import { describe, expect, test } from 'bun:test';
import { normalizeAndValidateWebUrl } from '@/services/files/web-url';

describe('normalizeAndValidateWebUrl', () => {
  test('returns the canonical https URL when given a valid https URL', () => {
    expect(normalizeAndValidateWebUrl('https://Example.com/path/?q=1#h')).toBe(
      'https://example.com/path/?q=1#h'
    );
  });

  test('returns the canonical http URL when given a valid http URL', () => {
    expect(normalizeAndValidateWebUrl('http://example.com/article')).toBe(
      'http://example.com/article'
    );
  });

  test('trims surrounding whitespace before validating', () => {
    expect(normalizeAndValidateWebUrl('  https://example.com/x  ')).toBe('https://example.com/x');
  });

  test('rejects empty input', () => {
    expect(() => normalizeAndValidateWebUrl('')).toThrow('Enter a URL to save.');
    expect(() => normalizeAndValidateWebUrl('   ')).toThrow('Enter a URL to save.');
  });

  test('rejects non-URL input', () => {
    expect(() => normalizeAndValidateWebUrl('not a url')).toThrow('Enter a valid http(s) URL.');
  });

  test('rejects non-http(s) protocols', () => {
    expect(() => normalizeAndValidateWebUrl('file:///etc/passwd')).toThrow(
      'Only http(s) URLs are supported.'
    );
    expect(() => normalizeAndValidateWebUrl('javascript:alert(1)')).toThrow(
      'Only http(s) URLs are supported.'
    );
    expect(() => normalizeAndValidateWebUrl('ftp://example.com/')).toThrow(
      'Only http(s) URLs are supported.'
    );
  });
});
