export const RAG_HASH_EMBEDDING_MODEL_ID = 'ark-hash-v1';
export const RAG_HASH_EMBEDDING_DIMENSIONS = 64;

const EMBEDDING_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'be',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

export function embedText(text: string) {
  const vector = new Array<number>(RAG_HASH_EMBEDDING_DIMENSIONS).fill(0);
  for (const token of tokenizeForEmbedding(text)) {
    const hash = hashToken(token);
    const index = hash % RAG_HASH_EMBEDDING_DIMENSIONS;
    const sign = hash & 1 ? 1 : -1;
    vector[index] += sign;
  }
  return normalize(vector);
}

export function serializeEmbedding(vector: number[]) {
  return new Uint8Array(Float32Array.from(vector).buffer);
}

export function deserializeEmbedding(blob: unknown) {
  const bytes =
    blob instanceof Uint8Array
      ? blob
      : blob instanceof ArrayBuffer
        ? new Uint8Array(blob)
        : ArrayBuffer.isView(blob)
          ? new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength)
          : null;
  if (!bytes || bytes.byteLength !== RAG_HASH_EMBEDDING_DIMENSIONS * 4) return null;
  const copy = new Uint8Array(bytes);
  return Array.from(new Float32Array(copy.buffer));
}

export function cosineSimilarity(left: number[], right: number[]) {
  let score = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    score += left[index] * right[index];
  }
  return score;
}

function tokenizeForEmbedding(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !EMBEDDING_STOPWORDS.has(token));
}

function normalize(vector: number[]) {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!length) return vector;
  return vector.map((value) => value / length);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
