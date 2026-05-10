import { useRef, useState } from "react";
import { Package, X, ArrowUp, ArrowDown, Plus, Upload, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import type { BundleFormState, ProductOption, DiscountType } from "./bundle-types";
import { slugify } from "./bundle-types";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inp = "w-full rounded-md border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const lbl = "block text-[11px] font-semibold uppercase tracking-wider text-[#8fa0bb] mb-1.5";

interface Props {
  form: BundleFormState;
  setForm: (f: BundleFormState) => void;
  selectedIds: number[];
  productCache: Map<number, ProductOption>;
  onMoveCompanion: (idx: number, dir: -1 | 1) => void;
  onRemoveCompanion: (id: number) => void;
  onPickAnchor: () => void;
  onAddCompanions: () => void;
}

export function BundleEditForm(p: Props) {
  const upd = <K extends keyof BundleFormState>(field: K, val: BundleFormState[K]) =>
    p.setForm({ ...p.form, [field]: val });

  const anchor = p.form.primaryProductId ? p.productCache.get(p.form.primaryProductId) ?? null : null;
  const companions = p.selectedIds.filter((id) => id !== p.form.primaryProductId);

  return (
    <div className="space-y-4">
      <Card title="Bundle name & URL">
        <div className="grid grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className={lbl}>Name</label>
            <input
              className={inp}
              value={p.form.name}
              onChange={(e) => {
                const name = e.target.value;
                upd("name", name);
                if (!p.form.id && (!p.form.slug || p.form.slug === slugify(p.form.name))) upd("slug", slugify(name));
              }}
              placeholder="e.g. Office Productivity 4-Pack"
            />
          </div>
          <div>
            <label className={lbl}>URL slug</label>
            <input className={inp} value={p.form.slug} onChange={(e) => upd("slug", e.target.value)} placeholder="office-productivity-4-pack" />
          </div>
        </div>
        <div className="flex items-center gap-6 pt-3">
          <ToggleRow label="Active" hint="Visible to customers" checked={p.form.isActive} onChange={(v) => upd("isActive", v)} />
          <ToggleRow label="Featured" hint="Show on landing pages" checked={p.form.isFeatured} onChange={(v) => upd("isFeatured", v)} />
        </div>
      </Card>

      <Card title="Anchor product" hint="The bundle is built around this product. Customers will see it as the headline.">
        {anchor ? (
          <ProductRow item={anchor} badge="Anchor" right={<Button variant="ghost" size="sm" onClick={p.onPickAnchor}>Change</Button>} />
        ) : (
          <button type="button" onClick={p.onPickAnchor} className="w-full rounded-md border-2 border-dashed border-[#2e3340] hover:border-sky-500/40 hover:bg-sky-500/5 px-4 py-6 text-sm text-[#8fa0bb] flex flex-col items-center gap-2 transition-colors">
            <Package className="h-5 w-5" />
            <span>Pick the anchor product</span>
          </button>
        )}
      </Card>

      <Card title={`Companion products (${companions.length})`} hint="What's included alongside the anchor.">
        {companions.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {companions.map((id, i) => {
              const it = p.productCache.get(id);
              if (!it) return null;
              return (
                <li key={id}>
                  <ProductRow
                    item={it}
                    right={<>
                      <IconBtn icon={<ArrowUp className="h-3.5 w-3.5" />} onClick={() => p.onMoveCompanion(i, -1)} disabled={i === 0} />
                      <IconBtn icon={<ArrowDown className="h-3.5 w-3.5" />} onClick={() => p.onMoveCompanion(i, 1)} disabled={i === companions.length - 1} />
                      <IconBtn icon={<X className="h-3.5 w-3.5" />} onClick={() => p.onRemoveCompanion(id)} />
                    </>}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" size="sm" onClick={p.onAddCompanions} className="w-full gap-1.5"><Plus className="h-4 w-4" />Add companion products</Button>
      </Card>

      <Card title="Discount rule" hint="How the bundle saves the customer money.">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <RuleCard checked={p.form.discountType === "PERCENTAGE"} onClick={() => upd("discountType", "PERCENTAGE")} title="Percentage off" subtitle="e.g. 25%" />
          <RuleCard checked={p.form.discountType === "FIXED"} onClick={() => upd("discountType", "FIXED")} title="Fixed amount" subtitle="e.g. €15" />
          <RuleCard checked={p.form.discountType === "BUY_X_GET_Y_FREE"} onClick={() => upd("discountType", "BUY_X_GET_Y_FREE")} title="Buy X, get rest free" subtitle="anchor at full" />
        </div>
        <div className="flex items-end gap-3">
          {p.form.discountType !== "BUY_X_GET_Y_FREE" && (
            <div className="w-32">
              <label className={lbl}>{p.form.discountType === "PERCENTAGE" ? "Discount %" : "Discount €"}</label>
              <input className={inp} type="number" step="0.01" min="0" value={p.form.discountValue} onChange={(e) => upd("discountValue", e.target.value)} />
            </div>
          )}
          <div className="w-32">
            <label className={lbl}>Min anchor qty</label>
            <input className={inp} type="number" min="1" step="1" value={p.form.minPrimaryQty} onChange={(e) => upd("minPrimaryQty", Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          {p.form.minPrimaryQty > 1 && (
            <p className="flex-1 text-[11.5px] text-amber-400/90 leading-snug pb-2">
              <Sparkles className="h-3 w-3 inline mr-1" />
              Storefront will require {p.form.minPrimaryQty} copies of the anchor to qualify.
            </p>
          )}
        </div>
      </Card>

      <Card title="Cover image">
        <ImageDropZone imageUrl={p.form.imageUrl} onChange={(v) => upd("imageUrl", v)} />
      </Card>

      <Card title="Description">
        <div className="space-y-3">
          <div>
            <label className={lbl}>Short hook <span className="text-[#5a6a84] font-normal normal-case tracking-normal">(one line, shows in cards)</span></label>
            <input className={inp} value={p.form.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value || null)} placeholder="Save big on the complete Office suite" />
          </div>
          <div>
            <label className={lbl}>Full description</label>
            <textarea rows={4} className={inp + " resize-y"} value={p.form.description ?? ""} onChange={(e) => upd("description", e.target.value || null)} placeholder="Detailed description shown on the bundle page…" />
          </div>
        </div>
      </Card>

      <Collapsible title="SEO">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>SEO Title</label><input className={inp} value={p.form.metaTitle ?? ""} onChange={(e) => upd("metaTitle", e.target.value || null)} /></div>
          <div><label className={lbl}>SEO Description</label><input className={inp} value={p.form.metaDescription ?? ""} onChange={(e) => upd("metaDescription", e.target.value || null)} /></div>
        </div>
      </Collapsible>

      <Collapsible title="Advanced">
        <div className="w-32">
          <label className={lbl}>Sort order</label>
          <input className={inp} type="number" value={p.form.sortOrder} onChange={(e) => upd("sortOrder", parseInt(e.target.value) || 0)} />
        </div>
      </Collapsible>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2e3340] bg-[#181c24]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
      <header className="px-4 py-2.5 border-b border-[#2a2e3a]">
        <h3 className="text-[12.5px] font-bold text-[#dde4f0]">{title}</h3>
        {hint && <p className="text-[11px] text-[#5a6a84] mt-0.5">{hint}</p>}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-[#2e3340] bg-[#181c24]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full px-4 py-2.5 flex items-center gap-1.5 text-left hover:bg-[#1e2128] transition-colors rounded-xl">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[#8fa0bb]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#8fa0bb]" />}
        <h3 className="text-[12.5px] font-bold text-[#dde4f0]">{title}</h3>
      </button>
      {open && <div className="px-4 pb-3 pt-1 border-t border-[#2a2e3a]">{children}</div>}
    </section>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <div>
        <div className="text-[12px] font-medium text-[#dde4f0]">{label}</div>
        <div className="text-[10.5px] text-[#5a6a84]">{hint}</div>
      </div>
    </div>
  );
}

function ProductRow({ item, badge, right }: { item: ProductOption; badge?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[#2e3340] bg-[#0f1117] px-2.5 py-2">
      <div className="w-10 h-10 rounded bg-[#1e2128] flex items-center justify-center overflow-hidden shrink-0">
        {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="h-4 w-4 text-[#5a6a84]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#dde4f0] truncate">{item.name}</span>
          {badge && <span className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">{badge}</span>}
        </div>
        {item.priceUsd && <div className="text-[11px] text-[#5a6a84]">€{parseFloat(item.priceUsd).toFixed(2)}</div>}
      </div>
      <div className="flex shrink-0 gap-0.5">{right}</div>
    </div>
  );
}

function IconBtn({ icon, onClick, disabled }: { icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8fa0bb] hover:text-[#dde4f0]" onClick={onClick} disabled={disabled}>{icon}</Button>
  );
}

function RuleCard({ checked, onClick, title, subtitle }: { checked: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-md p-2.5 border transition-colors ${checked ? "border-sky-500/60 bg-sky-500/10" : "border-[#2e3340] bg-[#0f1117] hover:border-[#3d5070]"}`}>
      <div className="text-[12.5px] font-semibold text-[#dde4f0]">{title}</div>
      <div className="text-[10.5px] text-[#5a6a84]">{subtitle}</div>
    </button>
  );
}

function ImageDropZone({ imageUrl, onChange }: { imageUrl: string | null; onChange: (v: string | null) => void }) {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
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
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) uploadFile(f);
  }

  if (imageUrl) {
    return (
      <div className="grid grid-cols-[200px_1fr] gap-3 items-start">
        <div className="aspect-square rounded-md overflow-hidden border border-[#2e3340] bg-[#0f1117]">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="space-y-2">
          <div className="text-[11px] text-[#5a6a84] break-all">{imageUrl}</div>
          <Button variant="outline" size="sm" onClick={() => onChange(null)} className="gap-1"><X className="h-3.5 w-3.5" />Remove</Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1"><Upload className="h-3.5 w-3.5" />Replace</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className={`w-full rounded-md border-2 border-dashed px-4 py-8 flex flex-col items-center gap-2 transition-colors ${dragOver ? "border-sky-500/60 bg-sky-500/10" : "border-[#2e3340] hover:border-sky-500/40 hover:bg-sky-500/5"}`}
      >
        <Upload className={`h-6 w-6 ${dragOver ? "text-sky-400" : "text-[#5a6a84]"}`} />
        <div className="text-[12.5px] font-medium text-[#dde4f0]">{uploading ? "Uploading…" : "Drop an image here or click to browse"}</div>
        <div className="text-[10.5px] text-[#5a6a84]">PNG, JPG, WebP up to 5 MB</div>
      </button>
      <input className={inp + " mt-2 text-[11.5px]"} placeholder="…or paste an image URL" value="" onChange={(e) => { if (e.target.value) onChange(e.target.value); }} />
    </div>
  );
}
