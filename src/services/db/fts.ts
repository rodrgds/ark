const COMBINING_MARKS = /[\u0300-\u036f]/g;
const FTS_TOKEN_PATTERN = /[a-z0-9_]+/g;

export function tokenizeFtsInput(input: string, maxTerms = 32) {
  const normalized = input.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase();
  const terms: string[] = [];

  for (const match of normalized.matchAll(FTS_TOKEN_PATTERN)) {
    const term = match[0].replace(/^_+|_+$/g, '');
    if (!term) continue;
    terms.push(term);
    if (terms.length >= maxTerms) break;
  }

  return terms;
}

export function toFtsPrefixQuery(input: string, maxTerms?: number) {
  return tokenizeFtsInput(input, maxTerms)
    .map((term) => `${term}*`)
    .join(' ');
}

export function toFtsPrefixQueries(
  input: string,
  options: {
    stopwords?: ReadonlySet<string>;
    meaningfulMinLength?: number;
    maxTerms?: number;
  } = {}
) {
  const terms = tokenizeFtsInput(input, options.maxTerms);
  const stopwords = options.stopwords ?? new Set<string>();
  const meaningfulMinLength = options.meaningfulMinLength ?? 3;
  const precise = terms.map((term) => `${term}*`).join(' ');
  const fallback = terms
    .filter((term) => term.length >= meaningfulMinLength && !stopwords.has(term))
    .map((term) => `${term}*`)
    .join(' OR ');

  return Array.from(new Set([precise, fallback].filter(Boolean)));
}
