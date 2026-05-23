import * as Crypto from 'expo-crypto';
import { Sha256 } from '@/services/files/sha256';

export const MAX_IN_MEMORY_SHA256_BYTES = 64 * 1024 * 1024;
const SHA256_STREAM_CHUNK_BYTES = 512 * 1024;
const CHECKSUM_SIDECAR_TIMEOUT_MS = 8000;

type DigestOptions = {
  shouldCancel?: () => boolean;
};

function arrayBufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fileUriToNativePath(uri: string) {
  return uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function assertNotCanceled(options?: DigestOptions) {
  if (options?.shouldCancel?.()) throw new Error('Verification canceled.');
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

  static async sha256FileIfReasonable(
    uri: string,
    sizeBytes?: number | null,
    options?: DigestOptions
  ) {
    assertNotCanceled(options);
    const nativeHash = await this.sha256FileNative(uri).catch(() => null);
    if (nativeHash) {
      assertNotCanceled(options);
      return {
        checksumSha256: nativeHash,
        skippedReason: null,
      };
    }

    const { File } = await import('expo-file-system');
    const file = new File(uri);
    const resolvedSizeBytes = sizeBytes ?? file.info().size;
    if (!resolvedSizeBytes || resolvedSizeBytes > MAX_IN_MEMORY_SHA256_BYTES) {
      return {
        checksumSha256: await this.sha256FileStreaming(uri, SHA256_STREAM_CHUNK_BYTES, options),
        skippedReason: null,
      };
    }

    const bytes = await file.bytes();
    assertNotCanceled(options);
    if (bytes.byteLength > MAX_IN_MEMORY_SHA256_BYTES) {
      return {
        checksumSha256: await this.sha256FileStreaming(uri, SHA256_STREAM_CHUNK_BYTES, options),
        skippedReason: null,
      };
    }

    return {
      checksumSha256: await this.sha256Bytes(bytes),
      skippedReason: null,
    };
  }

  static async sha256FileStreaming(
    uri: string,
    chunkBytes = SHA256_STREAM_CHUNK_BYTES,
    options?: DigestOptions
  ) {
    const { File } = await import('expo-file-system');
    const handle = new File(uri).open();
    const sha256 = new Sha256();
    let chunksRead = 0;
    try {
      while (true) {
        assertNotCanceled(options);
        const chunk = handle.readBytes(chunkBytes);
        if (!chunk.byteLength) break;
        sha256.update(chunk);
        chunksRead += 1;
        if (chunksRead % 2 === 0) await yieldToEventLoop();
      }
      assertNotCanceled(options);
      return sha256.digestHex();
    } finally {
      handle.close();
    }
  }

  private static async sha256FileNative(uri: string) {
    const module = await import('react-native-blob-util');
    const digest = await module.default.fs.hash(fileUriToNativePath(uri), 'sha256');
    return this.normalizeSha256(digest);
  }
}
