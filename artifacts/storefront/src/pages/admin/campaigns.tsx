import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Plus, Pencil, Trash2, ExternalLink, ArrowLeft, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Campaign { id: number; title: string; slug: string; headline: string; status: string; endsAt: string | null; couponCode: string | null; productIds: number[]; viewCount: number; createdAt: string }
interface Product { id: number; name: string }

const EMPTY = { title: "", slug: "", headline: "", subtext: "", heroImageUrl: "", heroBgColor: "#0f172a", endsAt: "", couponCode: "", productIds: [] as number[], status: "draft" as "draft" | "active" };
type FormData = typeof EMPTY;

function CampaignForm({ id, token, onDone }: { id: number | null; token: string; onDone: () => void }) {
  const { toast } = useToast();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const [form, setForm] = useState<FormData>(EMPTY);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    fetch(`${API}/admin/keys/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setProducts(d.products ?? [])).catch(() => {});
    if (id) {
      fetch(`${API}/admin/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then(({ campaign: c }) => setForm({
          title: c.title, slug: c.slug, headline: c.headline, subtext: c.subtext ?? "",
          heroImageUrl: c.heroImageUrl ?? "", heroBgColor: c.heroBgColor ?? "#0f172a",
          endsAt: c.endsAt ? c.endsAt.slice(0, 16) : "", couponCode: c.couponCode ?? "",
          productIds: Array.isArray(c.productIds) ? c.productIds : [], status: c.status,
        })).finally(() => setLoading(false));
    }
  }, [id]);

  const set = (k: keyof FormData, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const save = async () => {
    if (!form.title || !form.slug || !form.headline) { toast({ title: "Fill in required fields", variant: "destructive" }); return; }
    setSaving(true);
    const endsAtDate = form.endsAt ? new Date(form.endsAt) : null;
    const endsAt = endsAtDate && !isNaN(endsAtDate.getTime()) ? endsAtDate.toISOString() : null;
    const body = { ...form, endsAt, couponCode: form.couponCode || null, heroImageUrl: form.heroImageUrl || "" };
    const url = id ? `${API}/admin/campaigns/${id}` : `${API}/admin/campaigns`;
    const r = await fetch(url, { method: id ? "PUT" : "POST", headers, body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast({ title: e.error ?? "Save failed", variant: "destructive" }); return; }
    toast({ title: id ? "Campaign updated" : "Campaign created" });
    onDone();
  };

  const filteredProducts = [...products.filter((p) => form.productIds.includes(p.id)), ...products.filter((p) => !form.productIds.includes(p.id))]
    .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onDone}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{id ? "Edit Campaign" : "New Campaign"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <h3 className="font-semibold text-sm">Details</h3>
          <div><label className="block text-xs font-medium mb-1">Admin Title *</label>
            <Input value={form.title} onChange={(e) => { set("title", e.target.value); if (!id) set("slug", slugify(e.target.value)); }} /></div>
          <div><label className="block text-xs font-medium mb-1">Slug * <span className="text-muted-foreground font-normal">(URL: /campaign/slug)</span></label>
            <Input value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} className="font-mono text-sm" /></div>
          <div><label className="block text-xs font-medium mb-1">Headline *</label>
            <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Up to 50% off Windows licenses!" /></div>
          <div><label className="block text-xs font-medium mb-1">Subtext</label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[72px]" value={form.subtext} onChange={(e) => set("subtext", e.target.value)} placeholder="Limited time only. Don't miss out." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Coupon Code</label>
              <Input value={form.couponCode} onChange={(e) => set("couponCode", e.target.value.toUpperCase())} placeholder="OFF50" className="font-mono" /></div>
            <div><label className="block text-xs font-medium mb-1">Ends At</label>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Hero Bg Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={form.heroBgColor} onChange={(e) => set("heroBgColor", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                <Input value={form.heroBgColor} onChange={(e) => set("heroBgColor", e.target.value)} className="font-mono text-sm" />
              </div></div>
            <div><label className="block text-xs font-medium mb-1">Status</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.status} onChange={(e) => set("status", e.target.value as "draft" | "active")}>
                <option value="draft">Draft</option><option value="active">Active</option>
              </select></div>
          </div>
          <div><label className="block text-xs font-medium mb-1">Hero Image URL <span className="text-muted-foreground font-normal">(optional, overrides bg color)</span></label>
            <Input value={form.heroImageUrl} onChange={(e) => set("heroImageUrl", e.target.value)} placeholder="https://..." /></div>
        </div>

        <div className="rounded-lg border bg-white p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">Featured Products</h3>
            <span className="text-xs text-muted-foreground">{form.productIds.length > 0 ? `${form.productIds.length} selected` : "None — shows all"}</span>
          </div>
          <Input placeholder="Search products…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="text-sm" />
          <div className="border rounded-md h-64 overflow-y-auto divide-y text-sm">
            {filteredProducts.map((p) => {
              const checked = form.productIds.includes(p.id);
              return (
                <label key={p.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted ${checked ? "bg-blue-50 font-medium" : ""}`}>
                  <input type="checkbox" checked={checked} onChange={(e) => set("productIds", e.target.checked ? [...form.productIds, p.id] : form.productIds.filter((x) => x !== p.id))} />
                  {p.name}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : id ? "Update Campaign" : "Create Campaign"}</Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        {form.slug && form.status === "active" && (
          <a href={`/campaign/${form.slug}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-1.5"><ExternalLink className="h-4 w-4" />Preview</Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function AdminCampaignsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const headers = { Authorization: `Bearer ${token}` };
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null | "new">(null);

  const load = () => {
    fetch(`${API}/admin/campaigns`, { headers }).then((r) => r.json()).then((d) => setCampaigns(d.campaigns ?? [])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (editId !== null) {
    return <CampaignForm id={editId === "new" ? null : editId} token={token!} onDone={() => { setEditId(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button onClick={() => setEditId("new")} className="gap-2"><Plus className="h-4 w-4" />New Campaign</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div> : campaigns.length === 0 ? (
        <div className="rounded-lg border bg-white p-16 text-center text-muted-foreground">
          <p className="mb-4">No campaigns yet.</p>
          <Button onClick={() => setEditId("new")}><Plus className="h-4 w-4 mr-2" />Create your first campaign</Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>{["Title", "Slug", "Status", "Products", "Views", "Ends At", ""].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">/campaign/{c.slug}</td>
                  <td className="px-4 py-3"><Badge variant={c.status === "active" ? "default" : "secondary"} className={c.status === "active" ? "bg-green-600 text-white" : ""}>{c.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{Array.isArray(c.productIds) ? c.productIds.length : 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.viewCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{c.endsAt ? new Date(c.endsAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditId(c.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {c.status === "active" && <a href={`/campaign/${c.slug}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button></a>}
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => {
                        if (!confirm(`Delete "${c.title}"?`)) return;
                        await fetch(`${API}/admin/campaigns/${c.id}`, { method: "DELETE", headers });
                        toast({ title: "Deleted" }); load();
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
