import { useEffect, useState, useCallback } from "react";
import {
  Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Tag, FlaskConical, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface PriceRule {
  id: number;
  name: string;
  ruleType: "PERCENTAGE_OFF" | "FIXED_PRICE";
  value: string;
  priority: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  scopeVariantIds: number[] | null;
  scopeCategoryIds: number[] | null;
  createdAt: string;
  updatedAt: string;
}

interface SimulationResult {
  variantId: number;
  productId: number;
  basePriceUsd: string;
  effectiveUnitPriceUsd: string;
  appliedStack: { type: string; id: number | null; label: string; savedUsd: string }[];
  isFlashSale: boolean;
}

const EMPTY_FORM = {
  name: "",
  ruleType: "PERCENTAGE_OFF" as "PERCENTAGE_OFF" | "FIXED_PRICE",
  value: "",
  priority: 100,
  isActive: true,
  validFrom: "",
  validTo: "",
  scopeVariantIds: "",
  scopeCategoryIds: "",
};

export default function AdminPriceRulesPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [rules, setRules] = useState<PriceRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Simulator state
  const [showSim, setShowSim] = useState(false);
  const [simVariantId, setSimVariantId] = useState("");
  const [simQty, setSimQty] = useState("1");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);

  const limit = 50;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRules = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    fetch(`${API}/admin/price-rules?${params}`, { headers })
      .then((r) => r.json())
      .then((d) => { setRules(d.rules ?? []); setTotal(d.total ?? 0); })
      .catch(() => toast({ title: "Failed to load rules", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, page, search]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (r: PriceRule) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      ruleType: r.ruleType,
      value: r.value,
      priority: r.priority,
      isActive: r.isActive,
      validFrom: r.validFrom ? r.validFrom.slice(0, 16) : "",
      validTo: r.validTo ? r.validTo.slice(0, 16) : "",
      scopeVariantIds: r.scopeVariantIds?.join(", ") ?? "",
      scopeCategoryIds: r.scopeCategoryIds?.join(", ") ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const parseIds = (s: string): number[] | null => {
    const nums = s.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return nums.length > 0 ? nums : null;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    const val = parseFloat(form.value);
    if (isNaN(val) || val <= 0) { toast({ title: "Value must be a positive number", variant: "destructive" }); return; }

    setSaving(true);
    const body = {
      name: form.name.trim(),
      ruleType: form.ruleType,
      value: val.toFixed(2),
      priority: Number(form.priority),
      isActive: form.isActive,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      scopeVariantIds: parseIds(form.scopeVariantIds),
      scopeCategoryIds: parseIds(form.scopeCategoryIds),
    };

    const url = editingId ? `${API}/admin/price-rules/${editingId}` : `${API}/admin/price-rules`;
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast({ title: editingId ? "Rule updated" : "Rule created" });
      closeForm();
      fetchRules();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const toggleRule = async (id: number) => {
    await fetch(`${API}/admin/price-rules/${id}/toggle`, { method: "PATCH", headers });
    fetchRules();
  };

  const deleteRule = async (id: number) => {
    if (!confirm("Delete this price rule?")) return;
    const res = await fetch(`${API}/admin/price-rules/${id}`, { method: "DELETE", headers });
    if (res.ok) { toast({ title: "Rule deleted" }); fetchRules(); }
  };

  // ── Simulator ──────────────────────────────────────────────────────────────

  const runSimulation = async () => {
    const id = parseInt(simVariantId);
    if (isNaN(id) || id <= 0) { toast({ title: "Enter a valid Variant ID", variant: "destructive" }); return; }
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch(`${API}/admin/price-rules/simulate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ variantId: id, qty: parseInt(simQty) || 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");
      setSimResult(data.simulation);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSimLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="h-6 w-6 text-blue-400" />
          Price Rules
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSim(!showSim)}>
            <FlaskConical className="h-4 w-4 mr-1" />
            Simulator
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Simulator panel */}
      {showSim && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-blue-300 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Price Simulator
              <span className="text-xs font-normal text-blue-400/70">(always runs engine regardless of flag)</span>
            </h2>
            <button onClick={() => { setShowSim(false); setSimResult(null); }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Variant ID</label>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                placeholder="e.g. 42"
                value={simVariantId}
                onChange={(e) => setSimVariantId(e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                min="1"
                value={simQty}
                onChange={(e) => setSimQty(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={runSimulation} disabled={simLoading}>
              {simLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
            </Button>
          </div>
          {simResult && (
            <div className="rounded border border-white/10 bg-black/30 p-3 space-y-2 text-sm">
              <div className="flex gap-6">
                <div>
                  <span className="text-muted-foreground text-xs">Base price</span>
                  <p className="font-mono">€{simResult.basePriceUsd}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Effective price</span>
                  <p className="font-mono text-green-400 font-bold">€{simResult.effectiveUnitPriceUsd}</p>
                </div>
                {simResult.isFlashSale && (
                  <div>
                    <Badge className="bg-red-500 text-white text-xs">Flash Sale</Badge>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Applied stack:</p>
                <div className="space-y-1">
                  {simResult.appliedStack.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-[10px] shrink-0">{entry.type}</Badge>
                      <span className="text-muted-foreground">{entry.label}</span>
                      {parseFloat(entry.savedUsd) > 0 && (
                        <span className="text-green-400 ml-auto shrink-0">−€{entry.savedUsd}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Edit Rule" : "New Price Rule"}</h2>
            <button onClick={closeForm}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                placeholder="e.g. Summer Sale 20% Off"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
              <select
                className="w-full rounded border px-3 py-2 text-sm bg-[#1a2035]"
                value={form.ruleType}
                onChange={(e) => setForm({ ...form, ruleType: e.target.value as any })}
              >
                <option value="PERCENTAGE_OFF">Percentage Off</option>
                <option value="FIXED_PRICE">Fixed Price</option>
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                {form.ruleType === "PERCENTAGE_OFF" ? "Discount %" : "Fixed Price $"} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                placeholder={form.ruleType === "PERCENTAGE_OFF" ? "10.00" : "9.99"}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Priority <span className="text-blue-400">(lower = applied first)</span>
              </label>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })}
              />
            </div>

            {/* Active */}
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="rule-active"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="rule-active" className="text-sm">Active</label>
            </div>

            {/* Valid From */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valid From</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>

            {/* Valid To */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valid To</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                value={form.validTo}
                onChange={(e) => setForm({ ...form, validTo: e.target.value })}
              />
            </div>

            {/* Scope Variant IDs */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Scope — Variant IDs <span className="text-blue-400">(comma-separated, blank = all)</span>
              </label>
              <input
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                placeholder="1, 5, 12"
                value={form.scopeVariantIds}
                onChange={(e) => setForm({ ...form, scopeVariantIds: e.target.value })}
              />
            </div>

            {/* Scope Category IDs */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Scope — Category IDs <span className="text-blue-400">(comma-separated, blank = all)</span>
              </label>
              <input
                className="w-full rounded border px-3 py-2 text-sm bg-transparent"
                placeholder="3, 7"
                value={form.scopeCategoryIds}
                onChange={(e) => setForm({ ...form, scopeCategoryIds: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={closeForm}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingId ? "Save Changes" : "Create Rule"}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3 rounded-lg border bg-white/5 p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full rounded border pl-9 pr-3 py-2 text-sm bg-transparent"
            placeholder="Search rules by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{total} rule{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-lg border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left" style={{ background: "#1a2035" }}>
                <th className="px-3 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Value</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Scope</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Valid</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 font-medium text-muted-foreground w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const now = new Date();
                const expired = r.validTo && new Date(r.validTo) < now;
                const notStarted = r.validFrom && new Date(r.validFrom) > now;
                const effectively = r.isActive && !expired && !notStarted;

                return (
                  <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="px-3 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-xs">
                        {r.ruleType === "PERCENTAGE_OFF" ? "% Off" : "Fixed $"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-green-400">
                      {r.ruleType === "PERCENTAGE_OFF" ? `${r.value}%` : `€${r.value}`}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block rounded bg-white/10 px-2 py-0.5 text-xs font-mono">{r.priority}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {r.scopeVariantIds?.length
                        ? `${r.scopeVariantIds.length} variant(s)`
                        : r.scopeCategoryIds?.length
                        ? `${r.scopeCategoryIds.length} category(s)`
                        : <span className="text-blue-400">All products</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {r.validFrom || r.validTo ? (
                        <>
                          {r.validFrom ? new Date(r.validFrom).toLocaleDateString() : "∞"}
                          {" — "}
                          {r.validTo ? new Date(r.validTo).toLocaleDateString() : "∞"}
                        </>
                      ) : "Always"}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => toggleRule(r.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                          effectively
                            ? "bg-green-500/20 text-green-400"
                            : "bg-white/10 text-muted-foreground"
                        }`}
                        title={expired ? "Expired" : notStarted ? "Not started yet" : ""}
                      >
                        {effectively
                          ? <><ToggleRight className="h-3 w-3" /> Active</>
                          : <><ToggleLeft className="h-3 w-3" /> {expired ? "Expired" : notStarted ? "Pending" : "Off"}</>}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1 rounded hover:bg-white/10"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 text-blue-400" />
                        </button>
                        <button
                          onClick={() => deleteRule(r.id)}
                          className="p-1 rounded hover:bg-red-500/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">
                    No price rules yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
