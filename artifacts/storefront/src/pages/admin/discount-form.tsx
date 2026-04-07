import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, RefreshCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FormData {
  code: string; description: string; discountType: "PERCENTAGE" | "FIXED";
  discountValue: string; minOrderUsd: string; maxDiscountUsd: string;
  usageLimit: string; isActive: boolean; singleUsePerCustomer: boolean;
  excludeSaleItems: boolean; productIds: number[]; categoryIds: number[];
  startsAt: string; expiresAt: string;
}

const EMPTY: FormData = {
  code: "", description: "", discountType: "PERCENTAGE", discountValue: "",
  minOrderUsd: "", maxDiscountUsd: "", usageLimit: "", isActive: true,
  singleUsePerCustomer: false, excludeSaleItems: false,
  productIds: [], categoryIds: [], startsAt: "", expiresAt: "",
};

export default function DiscountFormPage() {
  const params = useParams<{ id: string }>();
  const isEdit = params.id && params.id !== "new";
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState<boolean | null>(null);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    fetch(`${API}/admin/keys/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setProducts(d.products)).catch(() => {});
    fetch(`${API}/admin/categories`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setCategories(d.categories ?? d)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!isEdit) return;
    fetch(`${API}/admin/discounts/${params.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const disc = d.discount;
        setForm({
          code: disc.code, description: disc.description ?? "",
          discountType: disc.discountType, discountValue: disc.discountValue,
          minOrderUsd: disc.minOrderUsd ?? "", maxDiscountUsd: disc.maxDiscountUsd ?? "",
          usageLimit: disc.usageLimit?.toString() ?? "", isActive: disc.isActive,
          singleUsePerCustomer: disc.singleUsePerCustomer ?? false,
          excludeSaleItems: disc.excludeSaleItems ?? false,
          productIds: disc.productIds ?? [], categoryIds: disc.categoryIds ?? [],
          startsAt: disc.startsAt?.slice(0, 16) ?? "", expiresAt: disc.expiresAt?.slice(0, 16) ?? "",
        });
      }).catch(() => {});
  }, [isEdit, params.id, token]);

  const checkCode = async (code: string) => {
    if (!code.trim()) { setCodeAvailable(null); return; }
    const qs = `code=${encodeURIComponent(code)}${isEdit ? `&excludeId=${params.id}` : ""}`;
    const r = await fetch(`${API}/admin/discounts/check-code?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    setCodeAvailable(d.available);
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm((prev) => ({ ...prev, code }));
    checkCode(code);
  };

  const save = async () => {
    if (!form.code || !form.discountValue) return;
    setSaving(true);
    const body = {
      ...form,
      productIds: form.productIds.length > 0 ? form.productIds : null,
      categoryIds: form.categoryIds.length > 0 ? form.categoryIds : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      minOrderUsd: form.minOrderUsd || null,
      maxDiscountUsd: form.maxDiscountUsd || null,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
    };
    const url = isEdit ? `${API}/admin/discounts/${params.id}` : `${API}/admin/discounts`;
    const method = isEdit ? "PUT" : "POST";
    await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    navigate("/admin/discounts");
  };

  const set = (key: keyof FormData, val: unknown) => setForm((p) => ({ ...p, [key]: val }));
  const previewDiscount = calcPreview(form);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/discounts")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Discount Code" : "Create Discount Code"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Code & Type">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Code *</label>
                <div className="relative">
                  <input className="w-full rounded-md border px-3 py-2 text-sm font-mono uppercase" value={form.code}
                    onChange={(e) => { set("code", e.target.value.toUpperCase()); setCodeAvailable(null); }}
                    onBlur={() => checkCode(form.code)} />
                  {codeAvailable !== null && (
                    <span className="absolute right-2 top-2.5">{codeAvailable ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />}</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={generateCode}><RefreshCw className="h-4 w-4 mr-1" /> Random</Button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.discountType === "PERCENTAGE"} onChange={() => set("discountType", "PERCENTAGE")} /> Percentage (%)</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.discountType === "FIXED"} onChange={() => set("discountType", "FIXED")} /> Fixed ($)</label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium mb-1">Value *</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1">Min Order ($)</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={form.minOrderUsd} onChange={(e) => set("minOrderUsd", e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1">Max Discount ($)</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={form.maxDiscountUsd} onChange={(e) => set("maxDiscountUsd", e.target.value)} /></div>
            </div>
          </Section>

          <Section title="Limits & Schedule">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium mb-1">Max Uses</label><input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} placeholder="Unlimited" /></div>
              <div><label className="block text-sm font-medium mb-1">Starts At</label><input type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></div>
              <div><label className="block text-sm font-medium mb-1">Expires At</label><input type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.singleUsePerCustomer} onChange={(e) => set("singleUsePerCustomer", e.target.checked)} /> Single use per customer</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.excludeSaleItems} onChange={(e) => set("excludeSaleItems", e.target.checked)} /> Exclude sale items</label>
            </div>
          </Section>

          <Section title="Restrictions">
            <div>
              <label className="block text-sm font-medium mb-1">Applies to Products</label>
              <select multiple className="w-full rounded-md border px-3 py-2 text-sm h-24"
                value={form.productIds.map(String)} onChange={(e) => set("productIds", Array.from(e.target.selectedOptions, (o) => Number(o.value)))}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Hold Ctrl/Cmd to select multiple. Leave empty for all products.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Applies to Categories</label>
              <select multiple className="w-full rounded-md border px-3 py-2 text-sm h-24"
                value={form.categoryIds.map(String)} onChange={(e) => set("categoryIds", Array.from(e.target.selectedOptions, (o) => Number(o.value)))}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </Section>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !form.code || !form.discountValue}>{saving ? "Saving..." : isEdit ? "Update Code" : "Create Code"}</Button>
            <Button variant="outline" onClick={() => navigate("/admin/discounts")}>Cancel</Button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 rounded-lg border bg-white p-4 space-y-3">
            <h3 className="font-semibold text-sm">Live Preview</h3>
            <div className="text-xs space-y-2 text-muted-foreground">
              <div className="flex justify-between"><span>Order subtotal:</span><span>$100.00</span></div>
              <div className="flex justify-between text-green-600 font-medium"><span>Discount ({form.code || "CODE"}):</span><span>-${previewDiscount.toFixed(2)}</span></div>
              <div className="border-t pt-2 flex justify-between font-bold text-foreground"><span>Total:</span><span>${(100 - previewDiscount).toFixed(2)}</span></div>
              {form.minOrderUsd && Number(form.minOrderUsd) > 100 && <p className="text-orange-500 text-xs">⚠ Min order ${ form.minOrderUsd} not met</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-white p-4 space-y-3"><h3 className="font-semibold text-sm mb-2">{title}</h3>{children}</div>;
}

function calcPreview(form: FormData): number {
  const val = Number(form.discountValue) || 0;
  const orderTotal = 100;
  let discount = form.discountType === "PERCENTAGE" ? (orderTotal * val) / 100 : val;
  const maxDisc = Number(form.maxDiscountUsd);
  if (maxDisc > 0 && discount > maxDisc) discount = maxDisc;
  return Math.min(discount, orderTotal);
}
