import type { Note } from '@/types/db';

type NoteTextInput = {
  body?: string | null;
  contentHtml?: string | null;
  contentJson?: string | null;
};

const PLACEHOLDER_TEXTS = new Set(['write your note...', 'write your note…']);

export function getNotePlainText(input: NoteTextInput) {
  const candidates = [
    normalizePlainText(input.body ?? ''),
    normalizePlainText(extractTiptapJsonText(input.contentJson)),
    normalizePlainText(htmlToPlainText(input.contentHtml ?? '')),
  ].filter(Boolean);

  const meaningfulCandidates = candidates.filter((candidate) => !isPlaceholderArtifact(candidate));
  const pool = meaningfulCandidates.length ? meaningfulCandidates : candidates;
  return pool.sort((left, right) => scorePlainText(right) - scorePlainText(left))[0] ?? '';
}

export function getNotePreviewText(note: Note) {
  return getNotePlainText(note) || 'No content';
}

export function getNoteRagText(note: Note) {
  return [note.title, getNotePlainText(note), note.tags.join(' ')].filter(Boolean).join('\n');
}

function scorePlainText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed === '...' || trimmed === '…') return 1;
  return trimmed.length;
}

function isPlaceholderArtifact(value: string) {
  return PLACEHOLDER_TEXTS.has(value.trim().toLowerCase());
}

function normalizePlainText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTiptapJsonText(contentJson: string | null | undefined) {
  if (!contentJson) return '';
  try {
    const parsed = JSON.parse(contentJson) as unknown;
    const parts: string[] = [];
    visitTiptapNode(parsed, parts);
    return parts.join('').replace(/[ \t]+\n/g, '\n');
  } catch {
    return '';
  }
}

function visitTiptapNode(node: unknown, parts: string[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const child of node) visitTiptapNode(child, parts);
    return;
  }
  if (typeof node !== 'object') return;

  const record = node as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : '';
  if (type === 'text' && typeof record.text === 'string') {
    parts.push(record.text);
    return;
  }
  if (type === 'hardBreak') {
    parts.push('\n');
    return;
  }

  const blockStart = parts.length;
  if (Array.isArray(record.content)) {
    for (const child of record.content) visitTiptapNode(child, parts);
  }

  if (isBlockNode(type) && parts.length > blockStart && !endsWithNewline(parts)) {
    parts.push('\n');
  }
}

function isBlockNode(type: string) {
  return [
    'blockquote',
    'bulletList',
    'codeBlock',
    'heading',
    'listItem',
    'orderedList',
    'paragraph',
    'taskItem',
    'taskList',
  ].includes(type);
}

function endsWithNewline(parts: string[]) {
  return parts[parts.length - 1]?.endsWith('\n') ?? false;
}

function htmlToPlainText(html: string) {
  if (!html.trim()) return '';
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}
