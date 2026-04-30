interface SeoMeta {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
}

const DEFAULT_OG_IMAGE = "https://pixelcodes.com/opengraph.jpg?v=2";

export function setSeoMeta(meta: SeoMeta) {
  document.title = meta.title;

  const ogImage = meta.ogImage ?? DEFAULT_OG_IMAGE;
  setMeta("description", meta.description);
  setMeta("og:title", meta.title);
  setMeta("og:description", meta.description);
  setMeta("og:type", meta.ogImage ? "product" : "website");
  setMeta("og:url", meta.canonicalUrl ?? window.location.href);
  setMeta("og:image", ogImage);
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", meta.title);
  setMeta("twitter:description", meta.description);
  setMeta("twitter:image", ogImage);

  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", meta.canonicalUrl ?? window.location.href);
}

export function clearSeoMeta() {
  document.title = "PixelCodes";
  const selectors = [
    'meta[name="description"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[property="og:image"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
  ];
  selectors.forEach((s) => document.querySelector(s)?.remove());
  document.querySelector('link[rel="canonical"]')?.remove();
}

function setMeta(nameOrProperty: string, content: string) {
  const isOg = nameOrProperty.startsWith("og:");
  const attr = isOg ? "property" : "name";
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
