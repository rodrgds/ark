import { describe, expect, test } from 'bun:test';
import { formatBytes } from './format';

describe('formatBytes', () => {
  test('bytes below 1 KiB render as B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  test('KiB boundary uses KB', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 500)).toBe('500 KB');
  });

  test('MiB boundary uses MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 250)).toBe('250 MB');
  });

  test('GiB and beyond use GB with one decimal', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB');
  });
});
