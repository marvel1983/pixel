import { Eye, Package, ShoppingCart, AlertCircle, Sparkles, ShieldCheck, Check } from "lucide-react";
import type { BundleFormState, ProductOption, PricingPreview } from "./bundle-types";

interface Props {
  form: BundleFormState;
  selectedIds: number[];
  productCache: Map<number, ProductOption>;
  pricing: PricingPreview | null;
}

/**
 * Light-themed preview that mimics the public /bundles/<slug> page so the admin
 * sees what customers will get. Pure render — no fetch, no state.
 */
export function BundleEditPreview({ form, selectedIds, productCache, pricing }: Props) {
  const anchor = form.primaryProductId ? productCache.get(form.primaryProductId) ?? null : null;
  const companions = selectedIds.filter((id) => id !== form.primaryProductId).map((id) => productCache.get(id)).filter(Boolean) as ProductOption[];
  const allItems = anchor ? [anchor, ...companions] : companions;

  const sum = pricing ? parseFloat(pricing.sumOriginalUsd) : 0;
  const final = pricing ? parseFloat(pricing.finalUsd) : 0;
  const savings = pricing ? parseFloat(pricing.savingsUsd) : 0;
  const savingsPct = sum > 0 ? Math.round((savings / sum) * 100) : 0;

  const ruleBadge = (() => {
    switch (form.discountType) {
      case "PERCENTAGE":
        return savingsPct > 0 ? `Save ${savingsPct}%` : "Bundle deal";
      case "FIXED":
        return savings > 0 ? `Save €${savings.toFixed(2)}` : "Bundle deal";
      case "BUY_X_GET_Y_FREE":
        if (!anchor) return "Bundle deal";
        return form.minPrimaryQty > 1 ? `Buy ${form.minPrimaryQty}, get ${companions.length} free` : `Buy 1, get ${companions.length} free`;
    }
  })();

  return (
    <aside className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col h-fit sticky top-4">
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-2 text-[12px] text-slate-500">
        <Eye className="h-3.5 w-3.5" />
        <span className="font-medium">Customer preview</span>
        <span className="ml-auto text-[10.5px] uppercase tracking-wider text-slate-400">/bundles/{form.slug || "your-slug"}</span>
      </div>

      <div className="bg-white p-5 space-y-4">
        <div className="aspect-[16/9] rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center relative">
          {form.imageUrl ? (
            <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : anchor?.imageUrl ? (
            <img src={anchor.imageUrl} alt="" className="w-full h-full object-cover opacity-90" />
          ) : (
            <Package className="h-12 w-12 text-slate-300" />
          )}
          {ruleBadge && allItems.length >= 2 && (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-bold shadow-md">
              <Sparkles className="h-3 w-3" />{ruleBadge}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">{form.name || "Bundle name"}</h1>
          {form.shortDescription && (
            <p className="mt-1 text-sm text-slate-600">{form.shortDescription}</p>
          )}
        </div>

        {form.minPrimaryQty > 1 && anchor && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2 text-[12px]">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-900">
              Minimum order: <strong>{form.minPrimaryQty} copies</strong> of {anchor.name} required for this bundle.
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">What's in the bundle ({allItems.length})</div>
          {allItems.length === 0 ? (
            <div className="rounded-md border-2 border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
              Add an anchor + companion products to see the bundle take shape.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {allItems.map((it, i) => {
                const isAnchor = it.id === form.primaryProductId;
                const qty = isAnchor ? form.minPrimaryQty : 1;
                const price = parseFloat(it.priceUsd ?? "0") * qty;
                const isFree = form.discountType === "BUY_X_GET_Y_FREE" && !isAnchor;
                return (
                  <li key={`${it.id}-${i}`} className="flex items-center gap-2.5 text-sm">
                    <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="h-4 w-4 text-slate-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 truncate flex items-center gap-1.5">
                        {it.name}
                        {isAnchor && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">Anchor × {qty}</span>}
                      </div>
                    </div>
                    {isFree ? (
                      <div className="text-emerald-600 font-bold text-[12px]">FREE</div>
                    ) : (
                      <div className="text-slate-700 font-medium text-[13px]">€{price.toFixed(2)}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {pricing && allItems.length >= 2 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            {savings > 0 && (
              <div className="flex items-center justify-between text-[12px] text-slate-500">
                <span>Sum of items</span>
                <span className="line-through">€{sum.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Bundle price</span>
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">€{final.toFixed(2)}</span>
            </div>
            {savings > 0 && (
              <div className="text-[11.5px] font-semibold text-emerald-600 text-right">You save €{savings.toFixed(2)}</div>
            )}
          </div>
        )}

        <button
          type="button"
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white font-semibold text-sm py-2.5 opacity-90"
        >
          <ShoppingCart className="h-4 w-4" /> Add bundle to cart
        </button>

        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500">
          <Trust icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Secure" />
          <Trust icon={<Check className="h-3.5 w-3.5" />} label="Genuine keys" />
          <Trust icon={<Sparkles className="h-3.5 w-3.5" />} label="Instant" />
        </div>
      </div>
    </aside>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
