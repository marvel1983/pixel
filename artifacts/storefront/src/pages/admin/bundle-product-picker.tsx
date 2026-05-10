import { useEffect, useState } from "react";
import { Search, Package, X, Check, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { slugify, type ProductOption } from "./bundle-types";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ApiAdminProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  variants?: Array<{ priceUsd: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "single" | "multi";
  /** IDs already in the bundle (excluded from results) */
  excludedIds?: number[];
  /** Selected on this picker session — only used for `multi` mode */
  initialSelectedIds?: number[];
  /** Show "+ Create new bundle product" affordance (single mode only — for anchors) */
  allowCreate?: boolean;
  onConfirmSingle?: (product: ProductOption) => void;
  onConfirmMulti?: (products: ProductOption[]) => void;
  title: string;
}

export function BundleProductPicker(p: Props) {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [pickedCache, setPickedCache] = useState<Map<number, ProductOption>>(new Map());
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createImageUrl, setCreateImageUrl] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    if (!p.open) return;
    setPicked(new Set(p.initialSelectedIds ?? []));
    setPickedCache(new Map());
    setQuery("");
    setCreating(false);
    setCreateName(""); setCreateSlug(""); setCreateImageUrl("");
  }, [p.open]);

  useEffect(() => {
    if (!p.open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await fetch(`${API}/admin/products?q=${encodeURIComponent(query)}&limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const data = (await r.json()) as { products: ApiAdminProduct[] };
        const list: ProductOption[] = (data.products ?? []).map((x) => ({
          id: x.id,
          name: x.name,
          imageUrl: x.imageUrl,
          priceUsd: x.variants?.[0]?.priceUsd ?? null,
        }));
        setResults(list);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [p.open, query, token]);

  function toggleId(prod: ProductOption) {
    setPickedCache((prev) => new Map(prev).set(prod.id, prod));
    if (p.mode === "single") {
      p.onConfirmSingle?.(prod);
      p.onClose();
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(prod.id)) next.delete(prod.id);
      else next.add(prod.id);
      return next;
    });
  }

  function confirmMulti() {
    const out: ProductOption[] = [];
    for (const id of picked) {
      const cached = pickedCache.get(id);
      const fromResults = results.find((r) => r.id === id);
      if (cached) out.push(cached);
      else if (fromResults) out.push(fromResults);
    }
    p.onConfirmMulti?.(out);
    p.onClose();
  }

  async function submitCreate() {
    if (!createName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setCreateSubmitting(true);
    const slug = createSlug.trim() || slugify(createName);
    const r = await fetch(`${API}/admin/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createName.trim(),
        slug,
        imageUrl: createImageUrl.trim() || null,
        isBundleAnchor: true,
        isActive: true,
      }),
    });
    setCreateSubmitting(false);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      toast({ title: err.error ?? "Could not create anchor", variant: "destructive" });
      return;
    }
    const created = await r.json();
    toast({ title: "Anchor product created" });
    p.onConfirmSingle?.({ id: created.id, name: created.name, imageUrl: created.imageUrl ?? null, priceUsd: null });
    p.onClose();
  }

  const filtered = results.filter((r) => !(p.excludedIds ?? []).includes(r.id));

  return (
    <Dialog open={p.open} onOpenChange={(v) => !v && p.onClose()}>
      <DialogContent className="bundle-light-scope max-w-2xl max-h-[85vh] flex flex-col bg-white text-slate-900 p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b">
          <DialogTitle className="text-base">{p.title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="Search products by name or SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {p.allowCreate && !creating && (
            <button
              type="button"
              onClick={() => { setCreating(true); setCreateName(query); setCreateSlug(slugify(query)); }}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-slate-300 hover:border-primary/50 hover:bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors"
            >
              <Plus className="h-4 w-4" /> Create new bundle product{query ? ` "${query}"` : ""}
            </button>
          )}
          {p.allowCreate && creating && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Name</label>
                  <input
                    autoFocus
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    value={createName}
                    onChange={(e) => { setCreateName(e.target.value); setCreateSlug(slugify(e.target.value)); }}
                    placeholder="Bundle of 3 best antivirus"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Slug</label>
                  <input
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    value={createSlug}
                    onChange={(e) => setCreateSlug(e.target.value)}
                    placeholder="bundle-of-3-best-antivirus"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Image URL <span className="text-slate-400 font-normal normal-case">(optional)</span></label>
                <input
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  value={createImageUrl}
                  onChange={(e) => setCreateImageUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={createSubmitting}>Cancel</Button>
                <Button size="sm" onClick={submitCreate} disabled={createSubmitting} className="gap-1.5">
                  {createSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create & use as anchor
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && results.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">Searching…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">
              {query ? `No matches for "${query}"` : "Type to search"}
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((prod) => {
                const isPicked = picked.has(prod.id);
                return (
                  <li key={prod.id}>
                    <button
                      type="button"
                      onClick={() => toggleId(prod)}
                      className={`w-full flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${isPicked ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-slate-100"}`}
                    >
                      <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {prod.imageUrl ? (
                          <img src={prod.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{prod.name}</div>
                        {prod.priceUsd && (
                          <div className="text-xs text-slate-500">€{parseFloat(prod.priceUsd).toFixed(2)}</div>
                        )}
                      </div>
                      {p.mode === "multi" && (
                        <div className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center ${isPicked ? "bg-primary border-primary" : "border-slate-300"}`}>
                          {isPicked && <Check className="h-3 w-3 text-white" />}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {p.mode === "multi" && (
          <div className="px-5 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-slate-500">{picked.size} selected</div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={p.onClose}><X className="h-4 w-4 mr-1" />Cancel</Button>
              <Button size="sm" onClick={confirmMulti} disabled={picked.size === 0}>Add {picked.size} {picked.size === 1 ? "product" : "products"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
