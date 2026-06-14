const ICON_PATH_PATTERNS: RegExp[] = [
  /(^|\/)icons?\b/i,
  /(^|\/)icon\//i,
  /(^|\/)sprite[s]?\b/i,
  /(^|\/)print(er|able)?\b/i,
  /(^|\/)share[ds]?\b/i,
  /(^|\/)social\b/i,
  /(^|\/)logo[s]?\b/i,
  /(^|\/)nav[-_]?icon/i,
  /facebook|twitter|instagram|youtube|pinterest|tiktok/i,
  /(^|\/)email\b/i,
  /(^|\/)chevron(|-up|-down|-left|-right)\b/i,
  /(^|\/)arrow(|-up|-down|-left|-right)\b/i,
  /(^|\/)menu(|-icon)\b/i,
  /(^|\/)close(|-icon)\b/i,
  /(^|\/)search(|-icon)\b/i,
  /(^|\/)favicon\b/i,
  /\/sites\/[^/]+\/files\/[^/]*img\b/i,
  /\/static\/[^/]+\/img\b/i,
];

const UI_CLASS_PATTERNS: RegExp[] = [
  /\bshare[-_]?(icon|btn|button|link|this)\b/i,
  /\bsocial[-_]?(icon|media|share|links?)\b/i,
  /\bmeta[-_]?(nav|bar|header|footer|links?)\b/i,
  /\btoolbar\b/i,
  /\bicon\b/i,
  /\bui[-_]?icon\b/i,
  /\bbtn\b/i,
  /\bbutton\b/i,
];

const UI_ALT_PATTERNS: RegExp[] = [
  /^(print|share|email|facebook|twitter|instagram|youtube|pinterest|tiktok|menu|close|search|navigation|nav|home|back|next|previous|prev|forward|back)$/i,
  /^(icon|logo)$/i,
];

const CHROME_CONTAINER_TAGS = ['header', 'nav', 'footer', 'aside', 'form'];
const CHROME_ICON_MIN_SIZE = 64;

function isIconUrl(value: string): boolean {
  const cleaned = value.split('?')[0].toLowerCase();
  if (!cleaned) return false;
  return ICON_PATH_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isUiClass(value: string): boolean {
  return UI_CLASS_PATTERNS.some((pattern) => pattern.test(value));
}

function isUiAlt(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return UI_ALT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function toAbsoluteUrl(value: string, baseUrl: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(#|mailto:|tel:|javascript:|data:)/i.test(trimmed)) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = tag.match(re);
  return match ? match[2] : null;
}

function isSmallImageTag(tag: string): boolean {
  const width = getAttr(tag, 'width');
  const height = getAttr(tag, 'height');
  if (!width || !height) return false;
  const w = parseInt(width, 10);
  const h = parseInt(height, 10);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return false;
  return w < CHROME_ICON_MIN_SIZE && h < CHROME_ICON_MIN_SIZE;
}

function isInsideChromeContainer(html: string, imgStart: number): boolean {
  const before = html.slice(0, imgStart);
  const openTags: string[] = [];
  const tagRegex = /<(\/?)(header|nav|footer|aside|form)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(before)) !== null) {
    if (match[1]) {
      const closing = openTags.lastIndexOf(match[2].toLowerCase());
      if (closing !== -1) openTags.splice(closing, 1);
    } else {
      openTags.push(match[2].toLowerCase());
    }
  }
  return openTags.length > 0;
}

function shouldDropImgTag(tag: string, baseUrl: string, html: string, imgStart: number): boolean {
  const src = getAttr(tag, 'src') ?? '';
  const alt = getAttr(tag, 'alt') ?? '';
  const cls = getAttr(tag, 'class') ?? '';
  const id = getAttr(tag, 'id') ?? '';

  const absoluteUrl = toAbsoluteUrl(src, baseUrl);
  const url = (absoluteUrl ?? src).toLowerCase();

  if (url && isIconUrl(url)) return true;
  if (isUiClass(cls) || isUiClass(id)) return true;
  if (isUiAlt(alt)) return true;
  if (isSmallImageTag(tag)) return true;
  if (isInsideChromeContainer(html, imgStart)) return true;
  return false;
}

function findImgTagRange(html: string, start: number): { end: number } | null {
  const selfClose = html.indexOf('/>', start);
  const tagClose = html.indexOf('>', start);
  if (tagClose === -1) return null;
  if (selfClose !== -1 && selfClose < tagClose) {
    return { end: selfClose + 2 };
  }
  return { end: tagClose + 1 };
}

function dropIconImages(html: string, baseUrl: string): string {
  const imgRegex = /<img\b[^>]*>/gi;
  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const tagStart = match.index;
    const range = findImgTagRange(html, tagStart);
    if (!range) continue;
    result += html.slice(cursor, tagStart);
    if (shouldDropImgTag(match[0], baseUrl, html, tagStart)) {
      const trailing = html.slice(tagStart, range.end).match(/^[\s\n]*/);
      if (trailing) {
        result += trailing[0];
      }
    } else {
      result += html.slice(tagStart, range.end);
    }
    cursor = range.end;
    imgRegex.lastIndex = range.end;
  }
  result += html.slice(cursor);
  return result;
}

function stripIconBackgrounds(html: string): string {
  return html.replace(/(\sstyle\s*=\s*(["']))([\s\S]*?)\2/gi, (full, prefix, quote, body) => {
    const filtered = body.replace(
      /background(-image)?\s*:\s*url\((["']?)(.*?)\2\)\s*;?/gi,
      (styleMatch: string, _bgi: string, _q: string, url: string) =>
        isIconUrl(url) ? '' : styleMatch
    );
    const trimmed = filtered.replace(/(?:;\s*)+/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '');
    if (!trimmed) return '';
    return `${prefix}${trimmed}${quote}`;
  });
}

export function filterSnapshotChrome(html: string, baseUrl: string): string {
  if (!html) return '';
  return stripIconBackgrounds(dropIconImages(html, baseUrl));
}
