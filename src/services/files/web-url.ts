export function normalizeAndValidateWebUrl(rawUrl: string) {
  const value = rawUrl.trim();
  if (!value) throw new Error('Enter a URL to save.');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Enter a valid http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported.');
  }
  return parsed.toString();
}
