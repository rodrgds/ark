export const RAG_HASH_EMBEDDING_MODEL_ID = 'ark-hash-v2';
export const RAG_HASH_EMBEDDING_DIMENSIONS = 256;

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
  const tokens = tokenizeForEmbedding(text);

  for (const token of expandDomainAliases(tokens)) {
    addFeature(vector, `tok:${token}`, 1.2);
    for (const gram of characterGrams(token)) {
      addFeature(vector, `chr:${gram}`, 0.22);
    }
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    addFeature(vector, `bi:${tokens[index]} ${tokens[index + 1]}`, 0.85);
  }

  for (let index = 0; index < tokens.length - 2; index += 1) {
    addFeature(vector, `tri:${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`, 0.55);
  }

  return normalize(vector);
}

export function serializeEmbedding(vector: number[]) {
  return new Uint8Array(Float32Array.from(vector).buffer);
}

export function deserializeEmbedding(blob: unknown) {
  return deserializeEmbeddingWithDimensions(blob, RAG_HASH_EMBEDDING_DIMENSIONS);
}

export function deserializeEmbeddingWithDimensions(blob: unknown, dimensions: number) {
  const bytes =
    blob instanceof Uint8Array
      ? blob
      : blob instanceof ArrayBuffer
        ? new Uint8Array(blob)
        : ArrayBuffer.isView(blob)
          ? new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength)
          : null;
  if (!bytes || bytes.byteLength !== dimensions * 4) return null;
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
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !EMBEDDING_STOPWORDS.has(token));
}

function normalizeToken(token: string) {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ied')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function expandDomainAliases(tokens: string[]) {
  const expanded = [...tokens];
  for (const token of tokens) {
    const aliases = DOMAIN_ALIASES[token];
    if (aliases) expanded.push(...aliases);
  }
  return expanded;
}

function characterGrams(token: string) {
  if (token.length <= 4) return [token];
  const grams: string[] = [];
  for (let index = 0; index <= token.length - 3; index += 1) {
    grams.push(token.slice(index, index + 3));
  }
  return grams;
}

function addFeature(vector: number[], feature: string, weight: number) {
  const hash = hashToken(feature);
  const index = hash % RAG_HASH_EMBEDDING_DIMENSIONS;
  const sign = hash & 1 ? 1 : -1;
  vector[index] += sign * weight;
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

const DOMAIN_ALIASES: Record<string, string[]> = {
  bleed: ['hemorrhage', 'wound', 'pressure'],
  hemorrhage: ['bleed', 'wound', 'pressure'],
  potable: ['water', 'drink', 'safe'],
  purify: ['filter', 'boil', 'water'],
  dehydration: ['water', 'fluid', 'thirst'],
  hypothermia: ['cold', 'exposure', 'warm'],
  hyperthermia: ['heat', 'exposure', 'cool'],
  fever: ['temperature', 'illness'],
  fracture: ['bone', 'splint'],
  burn: ['cool', 'wound'],
  shelter: ['cover', 'warmth', 'weather'],
  compass: ['bearing', 'navigation'],
  route: ['navigation', 'path'],
};
