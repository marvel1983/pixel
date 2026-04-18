import { useState, useEffect, useCallback } from "react";
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2, ToggleLeft, ToggleRight, Zap, ShieldCheck, Clock, Headphones, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

const iconMap: Record<string, React.ElementType> = {
  zap: Zap, "shield-check": ShieldCheck, clock: Clock, headphones: Headphones, shield: Shield,
};
const iconOptions = ["zap", "shield-check", "clock", "headphones", "shield"];

interface Service {
  id: number; name: string; description: string; shortDescription: string;
  priceUsd: string; icon: string; enabled: boolean; sortOrder: number;
}

export default function AdminCheckoutServicesPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [saving, setSaving] = useState(false);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${API}/admin/checkout-services`, { headers });
    const d = await res.json();
    setServices(d.services || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function seedDefaults() {
    await fetch(`${API}/admin/checkout-services/seed`, { method: "POST", headers });
    toast({ title: "Default services seeded" });
    load();
  }

  async function handleSave() {
    if (!editing?.name || !editing.priceUsd) { toast({ title: "Name and price required", variant: "destructive" }); return; }
    setSaving(true);
    const url = editing.id ? `${API}/admin/checkout-services/${editing.id}` : `${API}/admin/checkout-services`;
    const method = editing.id ? "PUT" : "POST";
    const res = await fetch(url, { method, headers, body: JSON.stringify(editing) });
    if (!res.ok) { const d = await res.json(); toast({ title: d.error, variant: "destructive" }); setSaving(false); return; }
    toast({ title: editing.id ? "Service updated" : "Service created" });
    setEditing(null); setSaving(false); load();
  }

  async function toggleEnabled(svc: Service) {
    await fetch(`${API}/admin/checkout-services/${svc.id}`, {
      method: "PUT", headers, body: JSON.stringify({ enabled: !svc.enabled }),
    });
    load();
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const newOrder = [...services];
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[index], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[index]];
    setServices(newOrder);
    await fetch(`${API}/admin/checkout-services/reorder`, {
      method: "POST", headers, body: JSON.stringify({ order: newOrder.map((s) => s.id) }),
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this service?")) return;
    await fetch(`${API}/admin/checkout-services/${id}`, { method: "DELETE", headers });
    toast({ title: "Service deleted" }); load();
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checkout Services</h1>
          <p className="text-muted-foreground">Manage optional add-on services shown at checkout</p>
        </div>
        <div className="flex gap-2">
          {services.length === 0 && (
            <Button variant="outline" onClick={seedDefaults}>Seed Defaults</Button>
          )}
          <Button onClick={() => setEditing({ name: "", description: "", shortDescription: "", priceUsd: "0.99", icon: "shield", enabled: true, sortOrder: services.length })}>
            <Plus className="h-4 w-4 mr-1" /> Add Service
          </Button>
        </div>
      </div>

      <div className="border rounded-lg divide-y">
        {services.map((svc, idx) => {
          const Icon = iconMap[svc.icon] || Shield;
          return (
            <div key={svc.id} className="flex items-center gap-4 p-4">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button className="p-0.5 hover:bg-muted rounded disabled:opacity-30" disabled={idx === 0} onClick={() => handleMove(idx, "up")}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button className="p-0.5 hover:bg-muted rounded disabled:opacity-30" disabled={idx === services.length - 1} onClick={() => handleMove(idx, "down")}><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${svc.enabled ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{svc.name}</span>
                  {!svc.enabled && <span className="text-xs bg-muted px-2 py-0.5 rounded">Disabled</span>}
                </div>
                <p className="text-sm text-muted-foreground truncate">{svc.shortDescription}</p>
              </div>
              <span className="font-semibold">€{svc.priceUsd}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => toggleEnabled(svc)} title={svc.enabled ? "Disable" : "Enable"}>
                  {svc.enabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(svc)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(svc.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </div>
          );
        })}
        {services.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No checkout services yet. Click "Seed Defaults" to add the standard ones.</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{editing.id ? "Edit Service" : "New Service"}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Short Description</label>
                <Input value={editing.shortDescription || ""} onChange={(e) => setEditing({ ...editing, shortDescription: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Full Description</label>
                <textarea className="w-full border rounded-md p-2 text-sm min-h-[80px]" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Price (USD)</label>
                  <Input type="number" step="0.01" min="0" value={editing.priceUsd || ""} onChange={(e) => setEditing({ ...editing, priceUsd: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Icon</label>
                  <select className="w-full border rounded-md p-2 text-sm h-9" value={editing.icon || "shield"} onChange={(e) => setEditing({ ...editing, icon: e.target.value })}>
                    {iconOptions.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
