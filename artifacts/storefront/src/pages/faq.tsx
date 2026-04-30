import { useState, useEffect, useMemo } from "react";
import { Search, ChevronDown, HelpCircle, MessageSquare, Zap, Shield, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FaqPageJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { STATIC_FAQS, type FaqItem } from "./faq-data";

const API = import.meta.env.VITE_API_URL ?? "/api";

const HIGHLIGHTS = [
  { icon: Zap, label: "Instant Delivery", sub: "Keys sent within seconds" },
  { icon: Shield, label: "Genuine Keys", sub: "100% authorized sources" },
  { icon: RotateCcw, label: "15-Day Warranty", sub: "Replacement guaranteed" },
];

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    setSeoMeta({ title: "FAQ — PixelCodes Help Center", description: "Find answers to common questions about license keys, orders, payments, and refunds at PixelCodes." });
    return () => clearSeoMeta();
  }, []);

  useEffect(() => {
    fetch(`${API}/faqs`)
      .then((r) => r.json())
      .then((d) => {
        const items: FaqItem[] = d.faqs ?? [];
        setFaqs(items.length > 0 ? items : STATIC_FAQS);
      })
      .catch(() => setFaqs(STATIC_FAQS))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const labels = [...new Set(faqs.map((f) => f.categoryLabel || "General"))];
    return ["All", ...labels];
  }, [faqs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return faqs.filter((f) => {
      const cat = f.categoryLabel || "General";
      const matchesCat = activeCategory === "All" || cat === activeCategory;
      const matchesSearch = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [faqs, activeCategory, search]);

  const breadcrumbs = [{ label: "Home", href: "/" }, { label: "FAQ" }];

  return (
    <div>
      <FaqPageJsonLd faqs={faqs} />
      <BreadcrumbJsonLd items={breadcrumbs} />

      {/* Hero */}
      <div className="bg-primary text-white">
        <div className="max-w-2xl mx-auto px-4 pt-12 pb-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/10 mb-4">
            <HelpCircle className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold mb-2">Help Center</h1>
          <p className="text-white/70 text-sm mb-7">Answers to common questions about keys, orders, and payments</p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveCategory("All"); setOpenId(null); }}
              placeholder="Search questions..."
              aria-label="Search FAQ"
              className="w-full h-11 pl-11 pr-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>

        {/* Highlights strip */}
        <div className="border-t border-white/10 bg-white/5">
          <div className="max-w-2xl mx-auto px-4 py-4 grid grid-cols-3 gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-white/60 shrink-0" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-white leading-none">{label}</p>
                  <p className="text-[11px] text-white/50 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Breadcrumbs crumbs={breadcrumbs} />

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-6 mt-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setOpenId(null); setSearch(""); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search result count */}
        {search && (
          <p className="text-xs text-muted-foreground mb-4">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
          </p>
        )}

        {/* Accordion */}
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <HelpCircle className="h-10 w-10 mx-auto mb-3 opacity-30" aria-hidden />
            <p className="font-medium">No results found</p>
            <p className="text-sm mt-1">Try a different keyword or browse all categories</p>
          </div>
        ) : (
          <div className="space-y-2" role="list">
            {filtered.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  role="listitem"
                  className={`border rounded-xl overflow-hidden transition-colors duration-150 ${
                    isOpen ? "border-primary/30 bg-primary/[0.02]" : "border-border bg-card"
                  }`}
                >
                  <button
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left group"
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors ${
                        isOpen ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      }`} aria-hidden>Q</span>
                      <span className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{faq.question}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                  </button>

                  {/* Smooth accordion via CSS grid */}
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="pl-12 pr-4 pb-4 pt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line border-t border-border/50">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Support CTA */}
        <div className="mt-12 rounded-2xl border border-border bg-muted/30 p-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 mb-4">
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <h2 className="text-base font-semibold mb-1">Couldn&apos;t find your answer?</h2>
          <p className="text-sm text-muted-foreground mb-5">Our support team typically responds within a few hours.</p>
          <Link href="/support">
            <button className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 active:bg-primary/85 transition-colors">
              Open a Support Ticket
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
