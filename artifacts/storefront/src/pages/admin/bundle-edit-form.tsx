import { useRef, useState } from "react";
import { Package, X, ArrowUp, ArrowDown, Plus, Upload, ChevronDown, ChevronRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import type { BundleFormState, ProductOption } from "./bundle-types";
import { slugify } from "./bundle-types";

const API = import.meta.env.VITE_API_URL ?? "/api";

const inp = "w-full rounded-md border border-[#2e3340] bg-[#0f1117] px-3 py-2 text-[13px] text-[#dde4f0] placeholder:text-[#3d5070] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/30";
const lbl = "block text-[11px] font-semibold uppercase tracking-wider text-[#8fa0bb] mb-1.5";

interface Props {
  form: BundleFormState;
  setForm: (f: BundleFormState) => void;
  componentIds: number[];
  freeIds: Set<number>;
  productCache: Map<number, ProductOption>;
  onToggleFree: (id: number) => void;
  onMoveCompanion: (idx: number, dir: -1 | 1) => void;
  onRemoveCompanion: (id: number) => void;
  onPickAnchor: () => void;
  onAddCompanions: () => void;
}

export function BundleEditForm(p: Props) {
  const upd = <K extends keyof BundleFormState>(field: K, val: BundleFormState[K]) =>
    p.setForm({ ...p.form, [field]: val });

  const anchor = p.form.primaryProductId ? p.productCache.get(p.form.primaryProductId) ?? null : null;

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
              placeholder="e.g. Bundle of 3 best antivirus"
            />
          </div>
          <div>
            <label className={lbl}>URL slug</label>
            <input className={inp} value={p.form.slug} onChange={(e) => upd("slug", e.target.value)} placeholder="bundle-of-3-best-antivirus" />
          </div>
        </div>
        <div className="flex items-center gap-6 pt-3">
          <ToggleRow label="Active" hint="Visible to customers" checked={p.form.isActive} onChange={(v) => upd("isActive", v)} />
          <ToggleRow label="Featured" hint="Show on landing pages" checked={p.form.isFeatured} onChange={(v) => upd("isFeatured", v)} />
        </div>
      </Card>

      <Card title="Bundle product page" hint="The catalog product customers will land on when they click this bundle. Anchor for the URL, image and description.">
        {anchor ? (
          <ProductRow item={anchor} badge="Anchor" right={<Button variant="ghost" size="sm" onClick={p.onPickAnchor}>Change</Button>} />
        ) : (
          <button type="button" onClick={p.onPickAnchor} className="w-full rounded-md border-2 border-dashed border-[#2e3340] hover:border-sky-500/40 hover:bg-sky-500/5 px-4 py-6 text-sm text-[#8fa0bb] flex flex-col items-center gap-2 transition-colors">
            <Package className="h-5 w-5" />
            <span>Pick an existing product as the bundle anchor</span>
          </button>
        )}
      </Card>

      <Card title={`What's in this bundle (${p.componentIds.length})`} hint="The real products whose keys customers receive. Anchor's price = sum of these − discount.">
        {p.componentIds.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {p.componentIds.map((id, i) => {
              const it = p.productCache.get(id);
              if (!it) return null;
              const isFree = p.freeIds.has(id);
              return (
                <li key={id}>
                  <ProductRow
                    item={it}
                    badge={isFree ? "FREE" : undefined}
                    badgeAccent={isFree ? "green" : "sky"}
                    right={<>
                      <button
                        type="button"
                        onClick={() => p.onToggleFree(id)}
                        className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${isFree ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40" : "bg-[#1e2128] text-[#5a6a84] border border-[#2e3340] hover:text-emerald-300 hover:border-emerald-500/30"}`}
                        title="Toggle: this component is free in the bundle"
                      >
                        <Gift className="h-2.5 w-2.5" />
                        Free
                      </button>
                      <IconBtn icon={<ArrowUp className="h-3.5 w-3.5" />} onClick={() => p.onMoveCompanion(i, -1)} disabled={i === 0} />
                      <IconBtn icon={<ArrowDown className="h-3.5 w-3.5" />} onClick={() => p.onMoveCompanion(i, 1)} disabled={i === p.componentIds.length - 1} />
                      <IconBtn icon={<X className="h-3.5 w-3.5" />} onClick={() => p.onRemoveCompanion(id)} />
                    </>}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" size="sm" onClick={p.onAddCompanions} className="w-full gap-1.5"><Plus className="h-4 w-4" />Add components</Button>
      </Card>

      <Card title="Discount rule" hint="How the bundle saves the customer money.">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <RuleCard checked={p.form.discountType === "PERCENTAGE"} onClick={() => upd("discountType", "PERCENTAGE")} title="Percentage off" subtitle="e.g. 25% off the sum" />
          <RuleCard checked={p.form.discountType === "FIXED"} onClick={() => upd("discountType", "FIXED")} title="Fixed amount off" subtitle="e.g. €15 off the sum" />
          <RuleCard checked={p.form.discountType === "BUY_X_GET_Y_FREE"} onClick={() => upd("discountType", "BUY_X_GET_Y_FREE")} title="Free components" subtitle="flagged items are free" />
        </div>
        {p.form.discountType !== "BUY_X_GET_Y_FREE" && (
          <div className="w-32">
            <label className={lbl}>{p.form.discountType === "PERCENTAGE" ? "Discount %" : "Discount €"}</label>
            <input className={inp} type="number" step="0.01" min="0" value={p.form.discountValue} onChange={(e) => upd("discountValue", e.target.value)} />
          </div>
        )}
        {p.form.discountType === "BUY_X_GET_Y_FREE" && p.freeIds.size === 0 && (
          <p className="text-[11.5px] text-amber-400/90 leading-snug">
            Mark at least one component above as <strong>Free</strong> for this rule.
          </p>
        )}
        <label className="mt-3 pt-3 border-t border-[#2a2e3a] flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={p.form.useAnchorPrice} onChange={(e) => upd("useAnchorPrice", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#2e3340] bg-[#0f1117] text-sky-500 focus:ring-sky-500/30" />
          <span className="text-[11.5px] text-[#8fa0bb] leading-snug"><span className="text-[#dde4f0] font-medium">Use anchor's catalog price instead.</span> Override the computed sum-minus-discount with the anchor's own variant price.</span>
        </label>
      </Card>

      <Card title="Cover image">
        <ImageDropZone imageUrl={p.form.imageUrl} onChange={(v) => upd("imageUrl", v)} />
      </Card>

      <Card title="Description">
        <div className="space-y-3">
          <div>
            <label className={lbl}>Short hook <span className="text-[#5a6a84] font-normal normal-case tracking-normal">(one line, shows in cards)</span></label>
            <input className={inp} value={p.form.shortDescription ?? ""} onChange={(e) => upd("shortDescription", e.target.value || null)} placeholder="The complete protection suite" />
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
      <div><div className="text-[12px] font-medium text-[#dde4f0]">{label}</div><div className="text-[10.5px] text-[#5a6a84]">{hint}</div></div>
    </div>
  );
}

function ProductRow({ item, badge, badgeAccent, right }: { item: ProductOption; badge?: string; badgeAccent?: "sky" | "green"; right?: React.ReactNode }) {
  const accent = badgeAccent === "green"
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
    : "bg-sky-500/15 text-sky-300 border-sky-500/30";
  return (
    <div className="flex items-center gap-3 rounded-md border border-[#2e3340] bg-[#0f1117] px-2.5 py-2">
      <div className="w-10 h-10 rounded bg-[#1e2128] flex items-center justify-center overflow-hidden shrink-0">
        {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="h-4 w-4 text-[#5a6a84]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[#dde4f0] truncate">{item.name}</span>
          {badge && <span className={`text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${accent}`}>{badge}</span>}
        </div>
        {item.priceUsd && <div className="text-[11px] text-[#5a6a84]">€{parseFloat(item.priceUsd).toFixed(2)}</div>}
      </div>
      <div className="flex shrink-0 gap-0.5 items-center">{right}</div>
    </div>
  );
}

function IconBtn({ icon, onClick, disabled }: { icon: React.ReactNode; onClick: () => void; disabled?: boolean }) { return <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8fa0bb] hover:text-[#dde4f0]" onClick={onClick} disabled={disabled}>{icon}</Button>; }
function RuleCard({ checked, onClick, title, subtitle }: { checked: boolean; onClick: () => void; title: string; subtitle: string }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-md p-2.5 border transition-colors ${checked ? "border-sky-500/60 bg-sky-500/10" : "border-[#2e3340] bg-[#0f1117] hover:border-[#3d5070]"}`}>
      <div className="text-[12.5px] font-semibold text-[#dde4f0]">{title}</div><div className="text-[10.5px] text-[#5a6a84]">{subtitle}</div>
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
