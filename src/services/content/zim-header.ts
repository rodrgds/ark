import * as FileSystem from 'expo-file-system/legacy';
import { formatBytes } from '@/lib/format';

/**
 * ZIM file format header structure (80 bytes):
 * https://wiki.openzim.org/wiki/ZIM_file_format
 *
 * Offset | Size | Field
 * 0      | 4    | magicNumber (0x44D495A)
 * 4      | 4    | majorVersion
 * 8      | 4    | minorVersion
 * 12     | 16   | uuid
 * 28     | 4    | articleCount
 * 32     | 4    | clusterCount
 * 36     | 8    | urlPtrPos
 * 44     | 8    | titlePtrPos
 * 52     | 8    | clusterPtrPos
 * 60     | 8    | mimeListPos
 * 68     | 4    | mainPage
 * 72     | 4    | layoutPage
 * 76     | 8    | checksumPos
 */

export type ZimHeaderInfo = {
  valid: boolean;
  majorVersion: number;
  minorVersion: number;
  uuid: string;
  articleCount: number;
  clusterCount: number;
  mainPage: number | null;
  mimeTypes: string[];
  fileSize: number | null;
};

const ZIM_MAGIC = 0x44d495a;
const HEADER_SIZE = 80;

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    ((bytes[offset + 3] << 24) >>> 0)
  );
}

function readUint64LE(bytes: Uint8Array, offset: number): number {
  // JavaScript can only safely handle integers up to 2^53,
  // but for file positions this is fine (up to 9 PB)
  const low = readUint32LE(bytes, offset);
  const high = readUint32LE(bytes, offset + 4);
  return low + high * 0x100000000;
}

function bytesToUUID(bytes: Uint8Array, offset: number): string {
  const hex = Array.from(bytes.slice(offset, offset + 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

async function readFileRange(uri: string, position: number, length: number): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return base64ToBytes(base64);
}

function parseMimeList(bytes: Uint8Array): string[] {
  const mimeTypes: string[] = [];
  let start = 0;

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      if (i === start) {
        // Double null terminator = end of MIME list
        break;
      }
      const mimeType = new TextDecoder().decode(bytes.slice(start, i));
      mimeTypes.push(mimeType);
      start = i + 1;
    }
  }

  return mimeTypes;
}

export class ZimHeaderParser {
  /**
   * Reads and parses the ZIM file header from a local file URI.
   * Returns metadata including article count, UUID, version, MIME types.
   */
  static async parse(fileUri: string): Promise<ZimHeaderInfo> {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      return this.invalidResult('File not found.');
    }
    const fileSize = 'size' in fileInfo ? (fileInfo.size ?? null) : null;

    try {
      // Read the 80-byte header
      const headerBytes = await readFileRange(fileUri, 0, HEADER_SIZE);
      if (headerBytes.length < HEADER_SIZE) {
        return this.invalidResult('File too small to be a ZIM archive.');
      }

      // Validate magic number
      const magic = readUint32LE(headerBytes, 0);
      if (magic !== ZIM_MAGIC) {
        return this.invalidResult('Not a valid ZIM file (bad magic number).');
      }

      const majorVersion = readUint32LE(headerBytes, 4);
      const minorVersion = readUint32LE(headerBytes, 8);
      const uuid = bytesToUUID(headerBytes, 12);
      const articleCount = readUint32LE(headerBytes, 28);
      const clusterCount = readUint32LE(headerBytes, 32);
      const mimeListPos = readUint64LE(headerBytes, 60);
      const mainPageRaw = readUint32LE(headerBytes, 68);

      // 0xFFFFFFFF means "no main page"
      const mainPage = mainPageRaw === 0xffffffff ? null : mainPageRaw;

      // Read MIME type list (starts at mimeListPos, variable length)
      // Read a reasonable chunk (MIME types are short strings)
      let mimeTypes: string[] = [];
      try {
        const mimeBytes = await readFileRange(fileUri, mimeListPos, 2048);
        mimeTypes = parseMimeList(mimeBytes);
      } catch {
        // MIME list read failed, not critical
      }

      return {
        valid: true,
        majorVersion,
        minorVersion,
        uuid,
        articleCount,
        clusterCount,
        mainPage,
        mimeTypes,
        fileSize,
      };
    } catch {
      return this.invalidResult('Unable to read ZIM file header.');
    }
  }

  /**
   * Returns a formatted description of the ZIM archive for display.
   */
  static describe(header: ZimHeaderInfo): string {
    if (!header.valid) return 'Invalid ZIM archive.';

    const parts: string[] = [];
    parts.push(`${header.articleCount.toLocaleString()} entries`);
    if (header.clusterCount > 0) {
      parts.push(`${header.clusterCount.toLocaleString()} clusters`);
    }
    parts.push(`ZIM v${header.majorVersion}.${header.minorVersion}`);
    if (header.fileSize) {
      parts.push(formatBytes(header.fileSize));
    }
    return parts.join(' · ');
  }

  /**
   * Determines if the archive contains HTML articles (vs. just metadata).
   */
  static hasHtmlContent(header: ZimHeaderInfo): boolean {
    return header.mimeTypes.some((mime) => mime === 'text/html' || mime.startsWith('text/html;'));
  }

  private static invalidResult(reason: string): ZimHeaderInfo {
    return {
      valid: false,
      majorVersion: 0,
      minorVersion: 0,
      uuid: '',
      articleCount: 0,
      clusterCount: 0,
      mainPage: null,
      mimeTypes: [],
      fileSize: null,
    };
  }
}
