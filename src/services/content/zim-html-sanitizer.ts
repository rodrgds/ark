const STRIPPED_BLOCK_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
];

const STRIPPED_VOID_TAGS = ['link', 'meta', 'base'];

const STRIP_BLOCK_TAG = new RegExp(
  `<\\s*/?\\s*(${STRIPPED_BLOCK_TAGS.join('|')})\\b[\\s\\S]*?(?:<\\s*/\\s*\\1\\s*>|$)`,
  'gi'
);
const STRIP_VOID_TAG = new RegExp(
  `<\\s*(${STRIPPED_VOID_TAGS.join('|')})\\b[^>]*>`,
  'gi'
);
const STRIP_EVENT_HANDLER = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const STRIP_JAVASCRIPT_URL = /\s+(href|src|action|formaction|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi;

export function sanitizeArticleHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<\!--[\s\S]*?-->/g, '')
    .replace(STRIP_BLOCK_TAG, '')
    .replace(STRIP_VOID_TAG, '')
    .replace(STRIP_EVENT_HANDLER, '')
    .replace(STRIP_JAVASCRIPT_URL, '$1="#"');
}
