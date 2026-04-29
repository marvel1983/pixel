import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { GripVertical, X, Search, Loader2, Save } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const TABS = [
  { value: "operating-systems",   label: "Operating Systems" },
  { value: "office-productivity", label: "Office & Productivity" },
  { value: "antivirus-security",  label: "Antivirus & Security" },
  { value: "games",               label: "Games" },
  { value: "servers-development", label: "Servers & Dev" },
];

interface SlimProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  categorySlug: string | null;
  priceUsd: string;
}

interface ApiVariant { id: number; priceUsd: string; }
interface ApiProduct {
  id: number; name: string; imageUrl: string | null;
  categorySlug: string | null; variants: ApiVariant[];
}

function toSlim(p: ApiProduct): SlimProduct {
  return {
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    categorySlug: p.categorySlug,
    priceUsd: p.variants[0]?.priceUsd ?? "0",
  };
}

function useAuthHeaders() {
  const token = useAuthStore((s) => s.token);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

interface TabPanelProps {
  tabValue: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  allProducts: SlimProduct[];
  loadingProducts: boolean;
}

function TabPanel({ tabValue, selectedIds, onChange, allProducts, loadingProducts }: TabPanelProps) {
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);

  const selected = selectedIds
    .map((id) => allProducts.find((p) => p.id === id))
    .filter((p): p is SlimProduct => !!p);

  const available = allProducts.filter(
    (p) => (p.categorySlug === tabValue) && !selectedIds.includes(p.id) &&
      (query.trim() === "" || p.name.toLowerCase().includes(query.toLowerCase()))
  );

  const unfiltered = allProducts.filter(
    (p) => !selectedIds.includes(p.id) && query.trim() !== "" &&
      p.categorySlug !== tabValue && p.name.toLowerCase().includes(query.toLowerCase())
  );

  function add(id: number) {
    onChange([...selectedIds, id]);
  }

  function remove(id: number) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function handleDragStart(id: number) {
    setDragging(id);
  }

  function handleDrop(targetId: number) {
    if (dragging === null || dragging === targetId) return;
    const from = selectedIds.indexOf(dragging);
    const to = selectedIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...selectedIds];
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    onChange(next);
    setDragging(null);
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Selected ({selected.length})</p>
        {selected.length === 0 && (
          <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
            No products selected — add from the right.
          </p>
        )}
        <ul className="space-y-1">
          {selected.map((p) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(p.id)}
              className="flex items-center gap-2 rounded border bg-white p-2 text-sm"
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
              {p.imageUrl && <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />}
              <span className="flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">€{Number(p.priceUsd).toFixed(2)}</span>
              <button onClick={() => remove(p.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        {loadingProducts ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {available.map((p) => (
              <li
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded border bg-white p-2 text-sm hover:border-primary"
                onClick={() => add(p.id)}
              >
                {p.imageUrl && <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                <span className="flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">€{Number(p.priceUsd).toFixed(2)}</span>
              </li>
            ))}
            {query && unfiltered.map((p) => (
              <li
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded border border-dashed bg-muted/30 p-2 text-sm hover:border-primary"
                onClick={() => add(p.id)}
              >
                {p.imageUrl && <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />}
                <span className="flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.categorySlug}</span>
              </li>
            ))}
            {available.length === 0 && unfiltered.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">No products found.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function HomepageSlotsPage() {
  const headers = useAuthHeaders();
  const [slots, setSlots] = useState<Record<string, number[]>>({});
  const [allProducts, setAllProducts] = useState<SlimProduct[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/homepage-slots`, { headers })
      .then((r) => r.json())
      .then((d: { slots: Record<string, number[]> }) => setSlots(d.slots ?? {}))
      .finally(() => setLoadingSlots(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/products?limit=500&stock=1`, { headers })
      .then((r) => r.json())
      .then((d: { items?: ApiProduct[] }) => setAllProducts((d.items ?? []).map(toSlim)))
      .finally(() => setLoadingProducts(false));
  }, []);

  const setTabSlots = useCallback((tab: string, ids: number[]) => {
    setSlots((prev) => ({ ...prev, [tab]: ids }));
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true);
    await fetch(`${API}/admin/homepage-slots`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ slots }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loadingSlots) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Category Slots</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Curate which products appear in each tab on the homepage. Drag to reorder. Leave a tab empty to show all products from that category.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue={TABS[0].value}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {(slots[t.value]?.length ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                  {slots[t.value].length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <TabPanel
              tabValue={t.value}
              selectedIds={slots[t.value] ?? []}
              onChange={(ids) => setTabSlots(t.value, ids)}
              allProducts={allProducts}
              loadingProducts={loadingProducts}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
