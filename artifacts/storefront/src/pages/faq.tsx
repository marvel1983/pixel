import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FaqPageJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  categoryLabel: string | null;
}

export default function FaqPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API}/faqs`)
      .then((r) => r.json())
      .then((d) => setFaqs(d.faqs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const breadcrumbs = [{ label: "Home", href: "/" }, { label: "FAQ" }];

  const categories = [...new Set(faqs.map((f) => f.categoryLabel || "General"))];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <FaqPageJsonLd faqs={faqs} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <Breadcrumbs crumbs={breadcrumbs} />
      <h1 className="text-3xl font-bold mb-8">Frequently Asked Questions</h1>

      {faqs.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No FAQs available yet.</p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              {categories.length > 1 && <h2 className="text-lg font-semibold mb-3 text-blue-700">{cat}</h2>}
              <div className="space-y-2">
                {faqs.filter((f) => (f.categoryLabel || "General") === cat).map((faq) => (
                  <div key={faq.id} className="border rounded-lg bg-white">
                    <button
                      className="w-full flex items-center justify-between p-4 text-left font-medium hover:bg-gray-50 transition-colors"
                      onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                    >
                      <span>{faq.question}</span>
                      {openId === faq.id ? <ChevronUp className="h-4 w-4 shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 shrink-0 ml-2" />}
                    </button>
                    {openId === faq.id && (
                      <div className="px-4 pb-4 text-muted-foreground whitespace-pre-wrap">{faq.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
