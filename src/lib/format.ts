import { formatDistanceToNow } from 'date-fns';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function utf8ByteLength(str: string): number {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) length += 1;
    else if (code <= 0x7ff) length += 2;
    else if (code >= 0xd800 && code <= 0xdfff) {
      length += 4;
      i++;
    } else length += 3;
  }
  return length;
}

export function formatProgressPercent(progress: number | null | undefined): string {
  return `${Math.round((progress ?? 0) * 100)}%`;
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function timeAgo(timestamp: number): string {
  return formatDistanceToNow(timestamp, { addSuffix: true });
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
