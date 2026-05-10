import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const inputCls = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const labelCls = "block text-[11.5px] font-medium text-[#8fa0bb] mb-1";
const sectionCls = "border-t border-[#2a2e3a] pt-4 first:border-t-0 first:pt-0";
const sectionTitleCls = "text-[11px] font-bold uppercase tracking-widest text-[#8fa0bb] mb-3";

export type DiscountType = "PERCENTAGE" | "FIXED" | "BUY_X_GET_Y_FREE";

export interface ProductOption { id: number; name: string; imageUrl: string | null; }

export interface BundleFormState {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  sortOrder: number;
  primaryProductId: number | null;
  discountType: DiscountType;
  discountValue: string;
  minPrimaryQty: number;
}

export interface PricingPreview {
  sumOriginalUsd: string;
  finalUsd: string;
  savingsUsd: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: BundleFormState;
  setEditing: (b: BundleFormState) => void;
  saving: boolean;
  onSave: () => void;
  selectedIds: number[];
  toggleProduct: (id: number) => void;
  moveProduct: (idx: number, dir: -1 | 1) => void;
  setPrimary: (id: number) => void;
  products: ProductOption[];
  productCache: Map<number, ProductOption>;
  productSearch: string;
  setProductSearch: (v: string) => void;
  pricing: PricingPreview | null;
}

export function BundleDialog(p: Props) {
  const [seoOpen, setSeoOpen] = useState(false);
  const upd = <K extends keyof BundleFormState>(field: K, val: BundleFormState[K]) =>
    p.setEditing({ ...p.editing, [field]: val });

  const sumOriginal = parseFloat(p.pricing?.sumOriginalUsd ?? "0");
  const finalPrice = parseFloat(p.pricing?.finalUsd ?? "0");
  const savings = parseFloat(p.pricing?.savingsUsd ?? "0");

  const showDiscountValue = p.editing.discountType !== "BUY_X_GET_Y_FREE";
  const showMinQtyHint = p.editing.minPrimaryQty > 1;

  const companionPickerItems = useMemo(
    () => p.products.filter((x) => !p.selectedIds.includes(x.id) && x.id !== p.editing.primaryProductId),
    [p.products, p.selectedIds, p.editing.primaryProductId],
  );

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto bg-[#181c24] border-[#2e3340] text-[#dde4f0]">
        <DialogHeader>
          <DialogTitle className="text-[#dde4f0]">{p.editing.id ? "Edit" : "Create"} Bundle</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="① Basics">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
              <div><label className={labelCls}>Name</label><input className={inputCls} value={p.editing.name} onChange={(e) => upd("name", e.target.value)} /></div>
              <div><label className={labelCls}>Slug</label><input className={inputCls} value={p.editing.slug} onChange={(e) => upd("slug", e.target.value)} /></div>
              <Toggle label="Active" checked={p.editing.isActive} onChange={(v) => upd("isActive", v)} />
              <Toggle label="Featured" checked={p.editing.isFeatured} onChange={(v) => upd("isFeatured", v)} />
            </div>
          </Section>

          <Section title="② Anchor product (the bundle is built around)">
            <AnchorPicker
              primary={p.editing.primaryProductId ? p.productCache.get(p.editing.primaryProductId) ?? null : null}
              search={p.productSearch}
              setSearch={p.setProductSearch}
              products={p.products}
              onPick={(id) => { upd("primaryProductId", id); p.setPrimary(id); }}
              onClear={() => upd("primaryProductId", null)}
            />
          </Section>

          <Section title={`③ Bundle products (${p.selectedIds.length} selected)`}>
            {p.selectedIds.length > 0 && (
              <div className="space-y-1 mb-2 p-2 bg-[#0f1117] rounded border border-[#2e3340]">
                {p.selectedIds.map((id, i) => {
                  const item = p.productCache.get(id);
                  const isPrimary = id === p.editing.primaryProductId;
                  return (
                    <div key={id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-[#dde4f0] flex items-center gap-2">
                        {i + 1}. {item?.name || `Product #${id}`}
                        {isPrimary && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">Anchor</span>}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => p.moveProduct(i, -1)} disabled={i === 0}>↑</Button>
                        <Button variant="ghost" size="sm" onClick={() => p.moveProduct(i, 1)} disabled={i === p.selectedIds.length - 1}>↓</Button>
                        <Button variant="ghost" size="sm" onClick={() => p.toggleProduct(id)} disabled={isPrimary}>✕</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <input className={inputCls + " mb-2"} placeholder="Search products to add…" value={p.productSearch} onChange={(e) => p.setProductSearch(e.target.value)} />
            <div className="max-h-32 overflow-y-auto border border-[#2e3340] rounded p-1 space-y-0.5 bg-[#0f1117]">
              {companionPickerItems.length === 0 ? (
                <div className="p-2 text-xs text-[#5a6a84] text-center">No matches</div>
              ) : companionPickerItems.map((x) => (
                <div key={x.id} onClick={() => p.toggleProduct(x.id)} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[#1e2128] text-sm text-[#dde4f0]">
                  <Package className="h-4 w-4 text-[#5a6a84]" /> {x.name}
                </div>
              ))}
            </div>
          </Section>

          <Section title="④ Pricing rule">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <RuleRadio name="discount" value="PERCENTAGE" checked={p.editing.discountType === "PERCENTAGE"} onChange={() => upd("discountType", "PERCENTAGE")} label="Percentage off" hint="e.g. 25%" />
                <RuleRadio name="discount" value="FIXED" checked={p.editing.discountType === "FIXED"} onChange={() => upd("discountType", "FIXED")} label="Fixed amount off" hint="e.g. €15" />
                <RuleRadio name="discount" value="BUY_X_GET_Y_FREE" checked={p.editing.discountType === "BUY_X_GET_Y_FREE"} onChange={() => upd("discountType", "BUY_X_GET_Y_FREE")} label="Buy anchor, get rest free" hint="anchor at full price" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {showDiscountValue && (
                  <div>
                    <label className={labelCls}>{p.editing.discountType === "PERCENTAGE" ? "Discount (%)" : "Discount (€)"}</label>
                    <input className={inputCls} type="number" step="0.01" min="0" value={p.editing.discountValue} onChange={(e) => upd("discountValue", e.target.value)} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Min. anchor quantity</label>
                  <input className={inputCls} type="number" min="1" step="1" value={p.editing.minPrimaryQty} onChange={(e) => upd("minPrimaryQty", Math.max(1, parseInt(e.target.value) || 1))} />
                  {showMinQtyHint && <p className="mt-1 text-[10.5px] text-amber-400/80">Customers will see a "minimum {p.editing.minPrimaryQty} required" banner.</p>}
                </div>
              </div>
              {p.pricing && p.selectedIds.length >= 2 && (
                <div className="rounded-md border border-[#2a2e3a] bg-[#0f1520] p-3 text-[12.5px]">
                  <div className="flex items-center gap-2 text-[#8fa0bb] mb-2"><Sparkles className="h-3.5 w-3.5 text-amber-400" /> Live preview (one bundle unit)</div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Stat label="Sum of items" value={`€${sumOriginal.toFixed(2)}`} />
                    <Stat label="Bundle price" value={`€${finalPrice.toFixed(2)}`} accent />
                    <Stat label="Customer saves" value={`€${savings.toFixed(2)}`} positive />
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section title="⑤ Marketing">
            <div className="space-y-3">
              <div><label className={labelCls}>Image URL</label><input className={inputCls} placeholder="https://…" value={p.editing.imageUrl ?? ""} onChange={(e) => upd("imageUrl", e.target.value || null)} /></div>
              <div><label className={labelCls}>Short description</label><input className={inputCls} value={p.editing.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value || null)} /></div>
              <div><label className={labelCls}>Description</label><textarea rows={3} className={inputCls + " resize-y"} value={p.editing.description ?? ""} onChange={(e) => upd("description", e.target.value || null)} /></div>
              <div><label className={labelCls}>Sort order</label><input className={inputCls + " max-w-[120px]"} type="number" value={p.editing.sortOrder} onChange={(e) => upd("sortOrder", parseInt(e.target.value) || 0)} /></div>
            </div>
          </Section>

          <div className={sectionCls}>
            <button type="button" onClick={() => setSeoOpen((v) => !v)} className={sectionTitleCls + " flex items-center gap-1 hover:text-[#dde4f0]"}>
              {seoOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} ⑥ SEO
            </button>
            {seoOpen && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>SEO Title</label><input className={inputCls} value={p.editing.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value || null)} /></div>
                <div><label className={labelCls}>SEO Description</label><input className={inputCls} value={p.editing.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value || null)} /></div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancel</Button>
          <Button onClick={p.onSave} disabled={p.saving}>{p.saving ? "Saving…" : "Save Bundle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={sectionCls}>
      <div className={sectionTitleCls}>{title}</div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-[11.5px] text-[#8fa0bb]">{label}</span>
    </div>
  );
}

function RuleRadio({ name, value, checked, onChange, label, hint }: { name: string; value: string; checked: boolean; onChange: () => void; label: string; hint: string }) {
  return (
    <label className={`cursor-pointer rounded-md border p-2 flex flex-col gap-0.5 transition-colors ${checked ? "border-sky-500/60 bg-sky-500/10" : "border-[#2e3340] bg-[#0f1117] hover:border-[#3d5070]"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-[12.5px] font-semibold text-[#dde4f0]">{label}</span>
      <span className="text-[10.5px] text-[#5a6a84]">{hint}</span>
    </label>
  );
}

function Stat({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  const cls = positive ? "text-emerald-400" : accent ? "text-sky-300" : "text-[#dde4f0]";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#5a6a84] mb-1">{label}</div>
      <div className={`text-base font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function AnchorPicker({ primary, search, setSearch, products, onPick, onClear }: {
  primary: ProductOption | null;
  search: string; setSearch: (v: string) => void;
  products: ProductOption[];
  onPick: (id: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  // close picker when an anchor is selected
  useEffect(() => { if (primary) setOpen(false); }, [primary?.id]);

  if (primary) {
    return (
      <div className="flex items-center justify-between p-2 rounded border border-sky-500/40 bg-sky-500/10">
        <span className="text-sm text-[#dde4f0] flex items-center gap-2">
          <Package className="h-4 w-4 text-sky-400" />
          {primary.name}
        </span>
        <Button variant="ghost" size="sm" onClick={onClear}>Change</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Search for the anchor product…" value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && (
        <div className="max-h-36 overflow-y-auto border border-[#2e3340] rounded p-1 space-y-0.5 bg-[#0f1117]">
          {products.length === 0 ? (
            <div className="p-2 text-xs text-[#5a6a84] text-center">Type to search products</div>
          ) : products.map((x) => (
            <div key={x.id} onClick={() => onPick(x.id)} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-[#1e2128] text-sm text-[#dde4f0]">
              <Package className="h-4 w-4 text-[#5a6a84]" /> {x.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
