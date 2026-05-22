export function chunkText(text: string, chunkSize = 900) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
