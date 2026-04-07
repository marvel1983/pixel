interface SeoMeta {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
}

export function setSeoMeta(meta: SeoMeta) {
  document.title = meta.title;

  setMeta("description", meta.description);
  setMeta("og:title", meta.title);
  setMeta("og:description", meta.description);
  setMeta("og:type", "product");
  setMeta("og:url", meta.canonicalUrl ?? window.location.href);
  if (meta.ogImage) setMeta("og:image", meta.ogImage);
  setMeta("twitter:card", "summary_large_image");
  setMeta("twitter:title", meta.title);
  setMeta("twitter:description", meta.description);
  if (meta.ogImage) setMeta("twitter:image", meta.ogImage);

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
