import fs from "fs";
import path from "path";

/**
 * Bot-aware SSR: we don't re-implement the React app server-side. Instead we
 * take the real built index.html (so the hashed JS/CSS asset tags stay
 * correct) and enrich it for crawlers:
 *   - swap <title> + meta description + canonical + OG/Twitter tags
 *   - inject JSON-LD <script> blocks into <head>
 *   - inject server-rendered visible text into #root so non-JS crawlers
 *     (GPTBot, social unfurlers) index real content; JS-capable bots still
 *     hydrate over it normally.
 */

const SITE_URL = (process.env.STORE_PUBLIC_URL ?? "https://pixelcodes.com").replace(/\/$/, "");

// Built storefront index.html. PM2 runs the api-server with
// cwd = /var/www/pixel-storefront (see ecosystem.config.cjs), so the build
// lives at <cwd>/artifacts/storefront/dist/public/index.html. Override with
// STOREFRONT_DIST if the layout ever changes.
const DIST_INDEX =
  process.env.STOREFRONT_DIST
    ? path.join(process.env.STOREFRONT_DIST, "index.html")
    : path.join(process.cwd(), "artifacts", "storefront", "dist", "public", "index.html");

let shellCache: { html: string; mtime: number } | null = null;

function loadShell(): string {
  try {
    const stat = fs.statSync(DIST_INDEX);
    if (!shellCache || shellCache.mtime !== stat.mtimeMs) {
      shellCache = { html: fs.readFileSync(DIST_INDEX, "utf8"), mtime: stat.mtimeMs };
    }
    return shellCache.html;
  } catch {
    // Last-resort minimal shell if the build isn't where we expect.
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>`;
  }
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip HTML tags + collapse whitespace for meta descriptions. */
export function plain(s: unknown, max = 300): string {
  const t = String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export interface SeoDoc {
  title: string;
  description: string;
  /** Path (with leading slash) or absolute URL. */
  canonical: string;
  ogImage?: string | null;
  ogType?: string;
  /** Already-stringified JSON-LD objects. */
  jsonLd?: object[];
  /** Server-rendered visible body HTML injected into #root. */
  bodyHtml: string;
  /** noindex for thin/utility routes. */
  noindex?: boolean;
}

export function renderSeoHtml(doc: SeoDoc): string {
  let html = loadShell();

  const canonical = doc.canonical.startsWith("http")
    ? doc.canonical
    : `${SITE_URL}${doc.canonical.startsWith("/") ? "" : "/"}${doc.canonical}`;
  const ogImage = doc.ogImage
    ? (doc.ogImage.startsWith("http") ? doc.ogImage : `${SITE_URL}${doc.ogImage}`)
    : `${SITE_URL}/opengraph.jpg?v=2`;
  const title = esc(doc.title);
  const desc = esc(doc.description);

  // --- <title> ---
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  // --- meta description ---
  html = html.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${desc}" />`,
  );

  // --- OG / Twitter (replace existing) ---
  const repl = (re: RegExp, tag: string) => {
    html = re.test(html) ? html.replace(re, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
  };
  repl(/<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${esc(canonical)}" />`);
  repl(/<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${title}" />`);
  repl(/<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${desc}" />`);
  repl(/<meta\s+property="og:type"[^>]*>/i, `<meta property="og:type" content="${esc(doc.ogType ?? "website")}" />`);
  repl(/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${esc(ogImage)}" />`);
  repl(/<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${title}" />`);
  repl(/<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${desc}" />`);
  repl(/<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${esc(ogImage)}" />`);

  // --- canonical + robots ---
  const head: string[] = [`<link rel="canonical" href="${esc(canonical)}" />`];
  if (doc.noindex) head.push(`<meta name="robots" content="noindex,follow" />`);
  for (const obj of doc.jsonLd ?? []) {
    head.push(
      `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`,
    );
  }
  html = html.replace("</head>", `    ${head.join("\n    ")}\n  </head>`);

  // --- server-rendered body into #root ---
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/i,
    `<div id="root">${doc.bodyHtml}</div>`,
  );

  return html;
}

export { SITE_URL };
