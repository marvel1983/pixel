import { useEffect, useRef } from "react";
import { MockProduct } from "@/lib/mock-data";

function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  const elRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    elRef.current = script;
    return () => { script.remove(); };
  }, [JSON.stringify(data)]);

  return null;
}

const SITE_NAME = "PixelCodes";
const SITE_URL = typeof window !== "undefined" ? window.location.origin : "";

export function ProductJsonLd({ product }: { product: MockProduct }) {
  const variant = product.variants[0];
  if (!variant) return null;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? `Buy ${product.name} digital license key`,
    sku: variant.sku,
    brand: { "@type": "Brand", name: product.platformType ?? SITE_NAME },
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${product.slug}`,
      priceCurrency: "USD",
      price: variant.priceUsd,
      availability: variant.stockCount > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE_NAME },
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (product.imageUrl) {
    data.image = product.imageUrl;
  }

  if (product.reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.avgRating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
    data.review = {
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: product.avgRating, bestRating: 5 },
      author: { "@type": "Person", name: "Verified Buyer" },
      reviewBody: `Great product - ${product.name}`,
    };
  }

  return <JsonLdScript data={data} />;
}

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["English"],
    },
    sameAs: [
      "https://twitter.com/pixelcodes",
      "https://facebook.com/pixelcodes",
      "https://discord.gg/pixelcodes",
      "https://youtube.com/@pixelcodes",
    ],
  };
  return <JsonLdScript data={data} />;
}

export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
  return <JsonLdScript data={data} />;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };
  return <JsonLdScript data={data} />;
}

export function CollectionPageJsonLd({ name, description, slug }: { name: string; description?: string; slug: string }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description: description ?? `Shop ${name} digital license keys at ${SITE_NAME}`,
    url: `${SITE_URL}/category/${slug}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
  return <JsonLdScript data={data} />;
}

interface BlogPostData {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  authorName: string | null;
}

export function ArticleJsonLd({ post }: { post: BlogPostData }) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt ?? undefined,
    author: {
      "@type": "Person",
      name: post.authorName ?? SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.svg` },
    },
  };
  if (post.coverImageUrl) data.image = post.coverImageUrl;
  if (post.excerpt) data.description = post.excerpt;
  return <JsonLdScript data={data} />;
}

interface FaqItem {
  question: string;
  answer: string;
}

export function FaqPageJsonLd({ faqs }: { faqs: FaqItem[] }) {
  if (faqs.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return <JsonLdScript data={data} />;
}

const ROUTE_LABELS: Record<string, string> = {
  shop: "Shop", blog: "Blog", cart: "Cart", checkout: "Checkout",
  support: "Support", account: "Account", wishlist: "Wishlist",
  compare: "Compare", search: "Search", faq: "FAQ", business: "Business",
  login: "Login", register: "Register", affiliates: "Affiliates",
  category: "Category", product: "Product", deals: "Deals",
};

export function RouteBreadcrumbJsonLd({ path }: { path: string }) {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0 || segments[0] === "admin") return null;
  const items = [{ label: "Home", href: "/" }];
  let href = "";
  for (const seg of segments) {
    href += `/${seg}`;
    items.push({ label: ROUTE_LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), href });
  }
  return <BreadcrumbJsonLd items={items} />;
}
