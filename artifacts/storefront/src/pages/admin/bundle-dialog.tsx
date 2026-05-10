import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Package, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inp = "w-full rounded border border-[#2e3340] bg-[#0f1117] px-2.5 py-1.5 text-[12.5px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const lbl = "block text-[10.5px] font-medium uppercase tracking-wider text-[#5a6a84] mb-1";
const secTitle = "text-[10.5px] font-bold uppercase tracking-widest text-[#8fa0bb] mb-1.5";
const secDiv = "border-t border-[#2a2e3a] pt-2.5 first:border-t-0 first:pt-0";

export type DiscountType = "PERCENTAGE" | "FIXED" | "BUY_X_GET_Y_FREE";
export interface ProductOption { id: number; name: string; imageUrl: string | null; }
export interface BundleFormState {
  id: number; name: string; slug: string;
  description: string | null; shortDescription: string | null; imageUrl: string | null;
  isActive: boolean; isFeatured: boolean;
  metaTitle: string | null; metaDescription: string | null; sortOrder: number;
  primaryProductId: number | null;
  discountType: DiscountType; discountValue: string; minPrimaryQty: number;
}
export interface PricingPreview { sumOriginalUsd: string; finalUsd: string; savingsUsd: string; }

interface Props {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: BundleFormState; setEditing: (b: BundleFormState) => void;
  saving: boolean; onSave: () => void;
  selectedIds: number[];
  toggleProduct: (id: number) => void;
  moveProduct: (idx: number, dir: -1 | 1) => void;
  setPrimary: (id: number) => void;
  products: ProductOption[];
  productCache: Map<number, ProductOption>;
  productSearch: string; setProductSearch: (v: string) => void;
  pricing: PricingPreview | null;
}

export function BundleDialog(p: Props) {
  const [seoOpen, setSeoOpen] = useState(false);
  const upd = <K extends keyof BundleFormState>(field: K, val: BundleFormState[K]) =>
    p.setEditing({ ...p.editing, [field]: val });

  const showVal = p.editing.discountType !== "BUY_X_GET_Y_FREE";
  const showMinHint = p.editing.minPrimaryQty > 1;

  const companions = useMemo(
    () => p.products.filter((x) => !p.selectedIds.includes(x.id) && x.id !== p.editing.primaryProductId),
    [p.products, p.selectedIds, p.editing.primaryProductId],
  );

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-w-[860px] max-h-[92vh] overflow-y-auto bg-[#181c24] border-[#2e3340] text-[#dde4f0] p-5">
        <DialogHeader className="pb-1"><DialogTitle className="text-[#dde4f0] text-base">{p.editing.id ? "Edit" : "Create"} Bundle</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div className={secDiv}>
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
              <div><label className={lbl}>Name</label><input className={inp} value={p.editing.name} onChange={(e) => upd("name", e.target.value)} /></div>
              <div><label className={lbl}>Slug</label><input className={inp} value={p.editing.slug} onChange={(e) => upd("slug", e.target.value)} /></div>
              <Toggle label="Active" checked={p.editing.isActive} onChange={(v) => upd("isActive", v)} />
              <Toggle label="Featured" checked={p.editing.isFeatured} onChange={(v) => upd("isFeatured", v)} />
            </div>
          </div>

          <div className={secDiv}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={secTitle}>Anchor product</div>
                <AnchorPicker
                  primary={p.editing.primaryProductId ? p.productCache.get(p.editing.primaryProductId) ?? null : null}
                  search={p.productSearch} setSearch={p.setProductSearch}
                  products={p.products}
                  onPick={(id) => { upd("primaryProductId", id); p.setPrimary(id); }}
                  onClear={() => upd("primaryProductId", null)}
                />
              </div>
              <div>
                <div className={secTitle}>Companions ({Math.max(0, p.selectedIds.length - (p.editing.primaryProductId ? 1 : 0))})</div>
                <CompanionsList selectedIds={p.selectedIds} cache={p.productCache} primaryId={p.editing.primaryProductId} onMove={p.moveProduct} onRemove={p.toggleProduct} />
                <input className={inp + " mt-1.5"} placeholder="Search to add…" value={p.productSearch} onChange={(e) => p.setProductSearch(e.target.value)} />
                {p.productSearch && (
                  <div className="mt-1 max-h-24 overflow-y-auto border border-[#2e3340] rounded p-0.5 bg-[#0f1117]">
                    {companions.length === 0 ? <div className="p-1.5 text-[11px] text-[#5a6a84] text-center">No matches</div>
                      : companions.slice(0, 8).map((x) => (
                        <div key={x.id} onClick={() => p.toggleProduct(x.id)} className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-[#1e2128] text-[12px] text-[#dde4f0]">
                          <Package className="h-3 w-3 text-[#5a6a84]" /> {x.name}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={secDiv}>
            <div className={secTitle}>Pricing rule</div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              <RuleCard checked={p.editing.discountType === "PERCENTAGE"} onClick={() => upd("discountType", "PERCENTAGE")} label="Percentage off" hint="e.g. 25%" />
              <RuleCard checked={p.editing.discountType === "FIXED"} onClick={() => upd("discountType", "FIXED")} label="Fixed amount off" hint="e.g. €15" />
              <RuleCard checked={p.editing.discountType === "BUY_X_GET_Y_FREE"} onClick={() => upd("discountType", "BUY_X_GET_Y_FREE")} label="Buy anchor, rest free" hint="anchor at full price" />
            </div>
            <div className="flex items-end gap-3 mb-1.5">
              {showVal && (
                <div className="w-32">
                  <label className={lbl}>{p.editing.discountType === "PERCENTAGE" ? "Discount %" : "Discount €"}</label>
                  <input className={inp} type="number" step="0.01" min="0" value={p.editing.discountValue} onChange={(e) => upd("discountValue", e.target.value)} />
                </div>
              )}
              <div className="w-32">
                <label className={lbl}>Min anchor qty</label>
                <input className={inp} type="number" min="1" step="1" value={p.editing.minPrimaryQty} onChange={(e) => upd("minPrimaryQty", Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              {p.pricing && p.selectedIds.length >= 2 && (
                <div className="flex-1 rounded border border-[#2a2e3a] bg-[#0f1520] px-2.5 py-1.5 text-[11.5px] flex items-center gap-3">
                  <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                  <Stat label="Sum" value={`€${parseFloat(p.pricing.sumOriginalUsd).toFixed(2)}`} />
                  <span className="text-[#5a6a84]">→</span>
                  <Stat label="Bundle" value={`€${parseFloat(p.pricing.finalUsd).toFixed(2)}`} accent />
                  <Stat label="Saves" value={`€${parseFloat(p.pricing.savingsUsd).toFixed(2)}`} positive />
                </div>
              )}
            </div>
            {showMinHint && <p className="text-[10.5px] text-amber-400/80">Storefront will show "minimum {p.editing.minPrimaryQty} required" banner.</p>}
          </div>

          <div className={secDiv}>
            <div className={secTitle}>Marketing</div>
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <ImageUpload imageUrl={p.editing.imageUrl} onChange={(v) => upd("imageUrl", v)} />
              <div className="space-y-1.5">
                <div><label className={lbl}>Short description</label><input className={inp} value={p.editing.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value || null)} /></div>
                <div><label className={lbl}>Description</label><textarea rows={2} className={inp + " resize-y"} value={p.editing.description ?? ""} onChange={(e) => upd("description", e.target.value || null)} /></div>
                <div className="w-32"><label className={lbl}>Sort order</label><input className={inp} type="number" value={p.editing.sortOrder} onChange={(e) => upd("sortOrder", parseInt(e.target.value) || 0)} /></div>
              </div>
            </div>
          </div>

          <div className={secDiv}>
            <button type="button" onClick={() => setSeoOpen((v) => !v)} className={secTitle + " flex items-center gap-1 hover:text-[#dde4f0]"}>
              {seoOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} SEO
            </button>
            {seoOpen && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div><label className={lbl}>SEO Title</label><input className={inp} value={p.editing.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value || null)} /></div>
                <div><label className={lbl}>SEO Description</label><input className={inp} value={p.editing.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value || null)} /></div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => p.onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={p.onSave} disabled={p.saving}>{p.saving ? "Saving…" : "Save Bundle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-1.5 pb-1">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-[10.5px] uppercase tracking-wider text-[#5a6a84]">{label}</span>
    </div>
  );
}

function RuleCard({ checked, onClick, label, hint }: { checked: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded p-1.5 border transition-colors ${checked ? "border-sky-500/60 bg-sky-500/10" : "border-[#2e3340] bg-[#0f1117] hover:border-[#3d5070]"}`}>
      <div className="text-[12px] font-semibold text-[#dde4f0]">{label}</div>
      <div className="text-[10px] text-[#5a6a84]">{hint}</div>
    </button>
  );
}

function Stat({ label, value, accent, positive }: { label: string; value: string; accent?: boolean; positive?: boolean }) {
  const cls = positive ? "text-emerald-400" : accent ? "text-sky-300" : "text-[#dde4f0]";
  return <div><span className="text-[9px] uppercase tracking-wider text-[#5a6a84] mr-1">{label}</span><span className={`font-bold ${cls}`}>{value}</span></div>;
}

function CompanionsList({ selectedIds, cache, primaryId, onMove, onRemove }: { selectedIds: number[]; cache: Map<number, ProductOption>; primaryId: number | null; onMove: (i: number, dir: -1 | 1) => void; onRemove: (id: number) => void }) {
  const companions = selectedIds.filter((id) => id !== primaryId);
  if (companions.length === 0) return <div className="text-[11px] text-[#5a6a84] italic py-1">None yet</div>;
  return (
    <div className="space-y-0.5 p-1 bg-[#0f1117] rounded border border-[#2e3340] max-h-32 overflow-y-auto">
      {companions.map((id, i) => {
        const item = cache.get(id);
        return (
          <div key={id} className="flex items-center justify-between text-[12px] py-0.5 px-1">
            <span className="text-[#dde4f0] truncate">{i + 1}. {item?.name || `#${id}`}</span>
            <div className="flex shrink-0">
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMove(selectedIds.indexOf(id), -1)} disabled={i === 0}><span className="text-[10px]">↑</span></Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMove(selectedIds.indexOf(id), 1)} disabled={i === companions.length - 1}><span className="text-[10px]">↓</span></Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRemove(id)}><X className="h-3 w-3" /></Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnchorPicker({ primary, search, setSearch, products, onPick, onClear }: { primary: ProductOption | null; search: string; setSearch: (v: string) => void; products: ProductOption[]; onPick: (id: number) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (primary) setOpen(false); }, [primary?.id]);

  if (primary) {
    return (
      <div className="flex items-center justify-between p-1.5 rounded border border-sky-500/40 bg-sky-500/10">
        <span className="text-[12px] text-[#dde4f0] flex items-center gap-1.5 truncate">
          <Package className="h-3 w-3 text-sky-400 shrink-0" />{primary.name}
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-[10.5px]" onClick={onClear}>Change</Button>
      </div>
    );
  }
  return (
    <>
      <input className={inp} placeholder="Search anchor product…" value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && (
        <div className="mt-1 max-h-24 overflow-y-auto border border-[#2e3340] rounded p-0.5 bg-[#0f1117]">
          {products.length === 0 ? <div className="p-1.5 text-[11px] text-[#5a6a84] text-center">Type to search</div>
            : products.slice(0, 8).map((x) => (
              <div key={x.id} onClick={() => onPick(x.id)} className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-[#1e2128] text-[12px] text-[#dde4f0]">
                <Package className="h-3 w-3 text-[#5a6a84]" /> {x.name}
              </div>
            ))}
        </div>
      )}
    </>
  );
}

function ImageUpload({ imageUrl, onChange }: { imageUrl: string | null; onChange: (v: string | null) => void }) {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${API}/admin/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data: reader.result, mimeType: file.type }),
        });
        if (!res.ok) { const err = await res.json(); toast({ title: err.error ?? "Upload failed", variant: "destructive" }); return; }
        const { url } = await res.json();
        const apiBase = API.replace(/\/api\/?$/, "");
        onChange(apiBase ? `${apiBase}${url}` : url);
      } catch { toast({ title: "Upload failed", variant: "destructive" }); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div>
      <label className={lbl}>Image</label>
      <div className="rounded border border-[#2e3340] bg-[#0f1117] aspect-square flex items-center justify-center overflow-hidden mb-1.5 relative group">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(null)} className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
          </>
        ) : (
          <Package className="h-8 w-8 text-[#3d5070]" />
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <Button type="button" variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1" disabled={uploading} onClick={() => fileRef.current?.click()}>
        <Upload className="h-3 w-3" />{uploading ? "Uploading…" : "Upload"}
      </Button>
      <input className={inp + " mt-1 text-[11px]"} placeholder="or paste URL" value={imageUrl ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}
