import { describe, expect, mock, test } from 'bun:test';

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: (_algorithm: string, data: Uint8Array) => crypto.subtle.digest('SHA-256', data),
}));

describe('FileDigestService', () => {
  test('parses Kiwix-style SHA-256 sidecar text', async () => {
    const { FileDigestService } = await import('@/services/files/file-digest.service');
    const checksum = '0'.repeat(63) + 'a';

    expect(FileDigestService.parseSha256Sidecar(`${checksum}  archive.zim`)).toBe(checksum);
    expect(FileDigestService.parseSha256Sidecar('not a checksum')).toBeNull();
  });

  test('hashes byte arrays with SHA-256', async () => {
    const { FileDigestService } = await import('@/services/files/file-digest.service');
    const bytes = new TextEncoder().encode('ark');

    expect(await FileDigestService.sha256Bytes(bytes)).toBe(
      '004b372cb547494db2f62d4b28602329781f2b358e5dbb14a62ad7e5767b3b4a'
    );
  });

  test('streams SHA-256 chunks without loading the whole file', async () => {
    const { Sha256 } = await import('@/services/files/sha256');
    const chunks = ['ark ', 'offline ', 'archive'].map((chunk) => new TextEncoder().encode(chunk));
    const hasher = new Sha256();
    for (const chunk of chunks) hasher.update(chunk);

    const expected = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('ark offline archive')
    );
    const expectedHex = Array.from(new Uint8Array(expected), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');

    expect(hasher.digestHex()).toBe(expectedHex);
  });
});
