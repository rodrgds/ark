import { RecursiveCharacterTextSplitter } from 'react-native-rag';

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 120;
const splitters = new Map<string, RecursiveCharacterTextSplitter>();

export function chunkText(text: string, chunkSize = 900) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
}

export async function splitTextForRag(
  text: string,
  options: { chunkSize?: number; chunkOverlap?: number } = {}
) {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  // For Markdown, we want to keep structural breaks like double newlines.
  // We only normalize horizontal whitespace and excessive vertical whitespace.
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  if (!normalized) return [];

  try {
    const splitter = getSplitter(chunkSize, chunkOverlap);
    const chunks = await splitter.splitText(normalized);
    return chunks.map((chunk) => chunk.trim()).filter(Boolean);
  } catch {
    return chunkText(normalized, chunkSize);
  }
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function getSplitter(chunkSize: number, chunkOverlap: number) {
  const key = `${chunkSize}:${chunkOverlap}`;
  const existing = splitters.get(key);
  if (existing) return existing;

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
  splitters.set(key, splitter);
  return splitter;
}
