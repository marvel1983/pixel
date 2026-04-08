import { useState } from "react";
import { Building2, Users, Receipt, ShieldCheck, ChevronRight, Send, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

const API = import.meta.env.VITE_API_URL ?? "/api";

const BENEFITS = [
  { icon: Receipt, title: "Volume Discounts", desc: "Save up to 15% with tiered pricing on bulk orders. Custom quotes for 50+ units." },
  { icon: Users, title: "Dedicated Account Manager", desc: "Get personalized support and priority assistance for your business needs." },
  { icon: ShieldCheck, title: "Net 30 Payment Terms", desc: "Approved business accounts enjoy invoice payment with net 30 terms." },
  { icon: Package, title: "Instant Delivery", desc: "License keys delivered instantly via email. No shipping delays." },
];

const TIERS = [
  { range: "5–9 units", discount: "5% off" },
  { range: "10–24 units", discount: "10% off" },
  { range: "25–49 units", discount: "15% off" },
  { range: "50+ units", discount: "Custom quote" },
];

interface ProductLine {
  productId: number;
  productName: string;
  quantity: number;
}

export default function BusinessPage() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactName: "", contactEmail: "", phone: "", message: "" });
  const [lines, setLines] = useState<ProductLine[]>([{ productId: 0, productName: "", quantity: 10 }]);

  const updateLine = (i: number, field: keyof ProductLine, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };
  const addLine = () => setLines((prev) => [...prev, { productId: 0, productName: "", quantity: 10 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.productId > 0 && l.quantity > 0).map((l) => ({
      productId: l.productId,
      productName: MOCK_PRODUCTS.find((p) => p.id === l.productId)?.name ?? l.productName,
      quantity: l.quantity,
    }));
    if (validLines.length === 0) { toast({ title: "Please select at least one product", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, products: validLines }),
      });
      if (!res.ok) throw new Error("Submit failed");
      setSubmitted(true);
      toast({ title: "Quote request submitted!", description: "We'll get back to you within 24 hours." });
    } catch {
      toast({ title: "Failed to submit", description: "Please try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-6">
            <Building2 className="h-4 w-4" />
            <span className="text-sm font-medium">Business Purchase Program</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Volume Licensing for Business</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            Get the best prices on software licenses for your team. Volume discounts, invoice payment terms, and dedicated support.
          </p>
        </div>
      </section>

      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">Why Choose Our Business Program?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-background rounded-xl border p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <b.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-2">Volume Pricing Tiers</h2>
          <p className="text-center text-muted-foreground mb-8">The more you buy, the more you save</p>
          <div className="max-w-lg mx-auto">
            <div className="grid grid-cols-2 gap-3">
              {TIERS.map((t) => (
                <div key={t.range} className="border rounded-lg p-4 text-center bg-card hover:border-blue-500 transition-colors">
                  <p className="font-semibold text-lg">{t.discount}</p>
                  <p className="text-sm text-muted-foreground">{t.range}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: "1", title: "Submit a Quote Request", desc: "Tell us what software your team needs and the quantity." },
              { step: "2", title: "Receive Custom Pricing", desc: "Our team reviews your request and sends a tailored quote within 24 hours." },
              { step: "3", title: "Purchase & Deploy", desc: "Approve the quote, pay via card or invoice, and receive keys instantly." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 font-bold">{s.step}</div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold text-center mb-8">What Our Clients Say</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { name: "Sarah M.", company: "TechFlow Inc.", text: "PixelCodes saved us over 30% on our Microsoft licenses. The dedicated account manager made the entire process seamless." },
              { name: "James R.", company: "DataScale Solutions", text: "Net 30 payment terms and instant delivery — exactly what we needed. Great experience all around." },
            ].map((t) => (
              <div key={t.name} className="border rounded-xl p-5 bg-card">
                <p className="text-sm italic text-muted-foreground mb-3">"{t.text}"</p>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.company}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuoteFormSection
        form={form}
        setForm={setForm}
        lines={lines}
        updateLine={updateLine}
        addLine={addLine}
        removeLine={removeLine}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitted={submitted}
      />
    </div>
  );
}

interface FormState {
  companyName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  message: string;
}

interface QuoteFormProps {
  form: FormState;
  setForm: (fn: (prev: FormState) => FormState) => void;
  lines: ProductLine[];
  updateLine: (i: number, field: keyof ProductLine, value: string | number) => void;
  addLine: () => void;
  removeLine: (i: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  submitted: boolean;
}

function QuoteFormSection({ form, setForm, lines, updateLine, addLine, removeLine, onSubmit, submitting, submitted }: QuoteFormProps) {
  if (submitted) {
    return (
      <section className="py-16 bg-green-50 dark:bg-green-950" id="quote">
        <div className="container mx-auto px-4 text-center max-w-lg">
          <ShieldCheck className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Quote Request Received!</h2>
          <p className="text-muted-foreground">Our team will review your request and get back to you within 24 hours with a custom quote.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="py-16 bg-muted/30" id="quote">
      <div className="container mx-auto px-4 max-w-2xl">
        <h2 className="text-2xl font-bold text-center mb-8">Request a Quote</h2>
        <form onSubmit={onSubmit} className="bg-card border rounded-xl p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Company Name *</label>
              <Input required value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Contact Name *</label>
              <Input required value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <Input type="email" required value={form.contactEmail} onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Products & Quantities *</label>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    className="flex-1 border rounded-md px-3 py-2 text-sm bg-background"
                    value={line.productId}
                    onChange={(e) => updateLine(i, "productId", parseInt(e.target.value, 10))}
                  >
                    <option value={0}>Select product...</option>
                    {MOCK_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input type="number" min={1} className="w-20" value={line.quantity} onChange={(e) => updateLine(i, "quantity", parseInt(e.target.value, 10) || 1)} />
                  {lines.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)} className="text-red-500 px-2">✕</Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addLine}>+ Add Product</Button>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm bg-background min-h-[80px] resize-y"
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Any special requirements, deployment timeline, etc."
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Submitting..." : "Submit Quote Request"}
          </Button>
        </form>
      </div>
    </section>
  );
}
