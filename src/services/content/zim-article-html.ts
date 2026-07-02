import { sanitizeArticleHtml } from '@/services/content/zim-html-sanitizer';

type ZimArticleHtmlInput = {
  html: string;
};

export function buildZimArticleHtml(article: ZimArticleHtmlInput) {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html {
      background: #0a0a0a;
      color-scheme: dark;
    }
    body {
      background: #0a0a0a;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
      margin: 0;
      padding: 18px;
    }
    img, video { max-width: 100%; height: auto; }
    a { color: #f2b84b !important; }
    table {
      background: #111113 !important;
      border-color: #3f3f46 !important;
      color: #fafafa !important;
      display: block;
      max-width: 100%;
      overflow-x: auto;
    }
    th, td {
      background: transparent !important;
      border-color: #3f3f46 !important;
      color: #fafafa !important;
    }
    th,
    thead td {
      background: #18181b !important;
    }
    blockquote,
    pre,
    code,
    .infobox,
    .metadata,
    .navbox,
    .sidebar,
    .toc,
    .wikitable {
      background: #111113 !important;
      border-color: #3f3f46 !important;
      color: #fafafa !important;
    }
    span,
    div,
    p,
    li {
      color: inherit !important;
    }
  </style>
</head>
<body>
  ${sanitizeArticleHtml(article.html)}
</body>
</html>`;
}
