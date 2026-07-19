const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_CHUNK_OVERLAP = 120;
const PREFERRED_BOUNDARIES = ['\n\n', '\n', '. ', '; ', ', ', ' '];

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

  return splitAtNaturalBoundaries(normalized, chunkSize, chunkOverlap);
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function splitAtNaturalBoundaries(text: string, chunkSize: number, chunkOverlap: number) {
  const safeChunkSize = Math.max(32, Math.floor(chunkSize));
  const safeOverlap = Math.max(0, Math.min(Math.floor(chunkOverlap), safeChunkSize - 1));
  const minimumBoundary = Math.floor(safeChunkSize * 0.55);
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const hardEnd = Math.min(text.length, start + safeChunkSize);
    let end = hardEnd;

    if (hardEnd < text.length) {
      for (const boundary of PREFERRED_BOUNDARIES) {
        const candidate = text.lastIndexOf(boundary, hardEnd - boundary.length);
        if (candidate >= start + minimumBoundary) {
          end = candidate + boundary.length;
          break;
        }
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;

    const nextStart = Math.max(start + 1, end - safeOverlap);
    start = skipLeadingWhitespace(text, nextStart);
  }

  return chunks;
}

function skipLeadingWhitespace(text: string, start: number) {
  let index = start;
  while (index < text.length && /\s/.test(text[index] ?? '')) index += 1;
  return index;
}
