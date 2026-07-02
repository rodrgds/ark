function isNavigableUrl(value: string) {
  return !/^(#|mailto:|tel:|javascript:|data:)/i.test(value);
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (!value.trim() || !isNavigableUrl(value.trim())) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function stripFailedImageTags(
  html: string,
  baseUrl: string,
  failedUrls: Set<string>
): string {
  if (!failedUrls.size) return html;
  return html.replace(/<img\b[^>]*>/gi, (full) => {
    const srcMatch = full.match(/\bsrc=(["'])(.*?)\1/i);
    if (!srcMatch) return full;
    const absoluteUrl = toAbsoluteUrl(srcMatch[2] ?? '', baseUrl);
    if (absoluteUrl && failedUrls.has(absoluteUrl)) {
      return '';
    }
    return full;
  });
}
