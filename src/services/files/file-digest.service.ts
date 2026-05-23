import * as Crypto from 'expo-crypto';
import { Sha256 } from '@/services/files/sha256';

export const MAX_IN_MEMORY_SHA256_BYTES = 64 * 1024 * 1024;
const SHA256_STREAM_CHUNK_BYTES = 1024 * 1024;
const CHECKSUM_SIDECAR_TIMEOUT_MS = 8000;

function arrayBufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class FileDigestService {
  static normalizeSha256(value?: string | null) {
    const match = value?.toLowerCase().match(/[a-f0-9]{64}/);
    return match?.[0] ?? null;
  }

  static normalizeMd5(value?: string | null) {
    const match = value?.toLowerCase().match(/[a-f0-9]{32}/);
    return match?.[0] ?? null;
  }

  static parseSha256Sidecar(value: string) {
    return this.normalizeSha256(value);
  }

  static async resolveExpectedSha256(input: {
    checksumSha256?: string | null;
    checksumSha256Url?: string | null;
  }) {
    const direct = this.normalizeSha256(input.checksumSha256);
    if (direct) return direct;
    if (!input.checksumSha256Url) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECKSUM_SIDECAR_TIMEOUT_MS);
    try {
      const response = await fetch(input.checksumSha256Url, { signal: controller.signal });
      if (!response.ok) return null;
      return this.parseSha256Sidecar(await response.text());
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  static async sha256Bytes(bytes: Uint8Array) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, copy.buffer);
    return arrayBufferToHex(digest);
  }

  static async sha256FileIfReasonable(uri: string, sizeBytes?: number | null) {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    const resolvedSizeBytes = sizeBytes ?? file.info().size;
    if (!resolvedSizeBytes || resolvedSizeBytes > MAX_IN_MEMORY_SHA256_BYTES) {
      return {
        checksumSha256: await this.sha256FileStreaming(uri),
        skippedReason: null,
      };
    }

    const bytes = await file.bytes();
    if (bytes.byteLength > MAX_IN_MEMORY_SHA256_BYTES) {
      return {
        checksumSha256: await this.sha256FileStreaming(uri),
        skippedReason: null,
      };
    }

    return {
      checksumSha256: await this.sha256Bytes(bytes),
      skippedReason: null,
    };
  }

  static async sha256FileStreaming(uri: string, chunkBytes = SHA256_STREAM_CHUNK_BYTES) {
    const { File } = await import('expo-file-system');
    const handle = new File(uri).open();
    const sha256 = new Sha256();
    try {
      while (true) {
        const chunk = handle.readBytes(chunkBytes);
        if (!chunk.byteLength) break;
        sha256.update(chunk);
      }
      return sha256.digestHex();
    } finally {
      handle.close();
    }
  }
}
