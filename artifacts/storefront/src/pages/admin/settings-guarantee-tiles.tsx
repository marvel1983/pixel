import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { INFO_ICON_OPTIONS, INFO_ICON_MAP, ACCENT_BY_ICON } from "@/lib/info-tile-icons";
import { Plus, Trash2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

type Tile = { icon: string; label: string; sub: string };

const DEFAULTS: Tile[] = [
  { icon: "shield", label: "Secure Payment", sub: "256-bit SSL encrypted" },
  { icon: "zap", label: "Instant Delivery", sub: "Digital key via email" },
  { icon: "refresh", label: "Money-Back", sub: "30-day guarantee" },
  { icon: "headphones", label: "24/7 Support", sub: "Live chat & email" },
];

export default function SettingsGuaranteeTilesTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [tiles, setTiles] = useState<Tile[]>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [newTile, setNewTile] = useState<Tile>({ icon: "shield", label: "", sub: "" });

  useEffect(() => {
    fetch(`${API}/admin/settings/guarantee-tiles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d.tiles) && d.tiles.length > 0) setTiles(d.tiles); }).catch(() => {});
  }, [token]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/settings/guarantee-tiles`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tiles }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Saved", description: "Guarantee tiles updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  function removeTile(i: number) { setTiles((ts) => ts.filter((_, j) => j !== i)); }

  function addTile() {
    if (!newTile.label.trim()) return;
    setTiles((ts) => [...ts, { ...newTile }]);
    setNewTile({ icon: "shield", label: "", sub: "" });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Guarantee Tiles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Trust badges shown on every product page and checkout. Drag to reorder by removing and re-adding.
        </p>

        <div className="space-y-2 mb-4">
          {tiles.map((t, i) => {
            const Icon = INFO_ICON_MAP[t.icon];
            const accent = ACCENT_BY_ICON[t.icon]?.accent ?? "#3b82f6";
            return (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.sub}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeTile(i)} className="text-destructive hover:text-destructive shrink-0 px-2">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add tile</p>
          <div className="flex gap-2">
            <select
              className="text-sm border rounded px-2 py-1 bg-background"
              value={newTile.icon}
              onChange={(e) => setNewTile((t) => ({ ...t, icon: e.target.value }))}
            >
              {INFO_ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Input placeholder="Label (e.g. Secure Payment)" value={newTile.label} onChange={(e) => setNewTile((t) => ({ ...t, label: e.target.value }))} className="flex-1" />
          </div>
          <div className="flex gap-2">
            <Input placeholder="Subtitle (e.g. 256-bit SSL)" value={newTile.sub} onChange={(e) => setNewTile((t) => ({ ...t, sub: e.target.value }))} className="flex-1" />
            <Button size="sm" onClick={addTile} disabled={!newTile.label.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
    </div>
  );
}
