import { useCallback, useEffect, useState } from "react";
import { GitMerge, Link2, Plus, X, AlertOctagon } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Conflict {
  id: number;
  conflictType: string;
  metenziProductId: string;
  metenziSku: string | null;
  metenziName: string | null;
  candidatePixelProductId: number | null;
  candidateMappingId: number | null;
  similarityScore: string | null;
  createdAt: string;
  candidateName: string | null;
  candidateSlug: string | null;
}

const TYPE_LABEL: Record<string, { label: string; explainer: string }> = {
  uuid_rotation: {
    label: "UUID rotation",
    explainer: "A Metenzi product with a known SKU arrived under a NEW UUID. Could be Metenzi rotating IDs (link), or two distinct products sharing a SKU (create new / dismiss).",
  },
  fuzzy_name_match: {
    label: "Possible duplicate",
    explainer: "A new Metenzi product looks similar to an existing pixel product. Link if it's the same thing, create new if it's genuinely different, dismiss to ignore.",
  },
  sku_collision: {
    label: "SKU collision",
    explainer: "Two Metenzi products with the same SKU were seen in the same sync run. Pick one as authoritative.",
  },
};

export function MappingConflictsPanel() {
  const token = useAuthStore((s) => s.token);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Conflict[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`${API}/admin/metenzi/mapping-conflicts`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setItems(d.conflicts ?? []); setCount(d.count ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  const resolve = async (id: number, action: "link_existing" | "create_new" | "dismiss") => {
    const verb = action === "link_existing" ? "link this Metenzi product to the candidate" : action === "create_new" ? "let sync create a brand-new pixel product on the next run" : "dismiss this conflict";
    if (!confirm(`Confirm: ${verb}?`)) return;
    setBusyId(id);
    try {
      const r = await fetch(`${API}/admin/metenzi/mapping-conflicts/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? "Failed"); return; }
      refresh();
    } catch { alert("Request failed"); }
    setBusyId(null);
  };

  if (count === 0 && !open) return null;

  return (
    <div className="rounded-lg border border-violet-500/40 bg-[#1a1228]">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <AlertOctagon className="h-4 w-4 text-violet-300 shrink-0" />
        <span className="text-[13px] font-bold text-violet-200">Mapping Conflicts</span>
        {count > 0 && <span className="ml-2 rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-bold text-white">{count}</span>}
        <span className="text-[11.5px] text-violet-300/70 ml-2">Sync paused on these — needs your decision</span>
        <span className="ml-auto text-[11px] text-violet-400">{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="border-t border-violet-500/20 px-4 pb-4 pt-3 space-y-3">
          {loading && <p className="text-[12px] text-[#5a6a84]">Loading…</p>}
          {!loading && items.length === 0 && <p className="text-[12px] text-[#5a6a84]">No pending conflicts.</p>}
          {items.map((c) => {
            const meta = TYPE_LABEL[c.conflictType] ?? { label: c.conflictType, explainer: "" };
            return (
              <div key={c.id} className="rounded border border-violet-500/20 bg-[#1f1530] p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded border border-violet-400/50 bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-200">{meta.label}</span>
                  <span className="text-[12.5px] font-semibold text-violet-100">{c.metenziName ?? "(unnamed)"}</span>
                  {c.metenziSku && <span className="text-[11px] text-[#8fa0bb] font-mono">SKU: {c.metenziSku}</span>}
                  <span className="text-[10.5px] text-[#5a6a84] font-mono ml-auto">{c.metenziProductId.slice(0, 8)}…</span>
                </div>
                <p className="text-[11.5px] text-violet-300/80">{meta.explainer}</p>
                {c.candidatePixelProductId && (
                  <div className="rounded bg-[#15101f] px-2.5 py-1.5 text-[12px]">
                    <span className="text-[#8fa0bb]">Candidate pixel product: </span>
                    <span className="text-sky-300 font-medium">{c.candidateName ?? `#${c.candidatePixelProductId}`}</span>
                    {c.candidateSlug && <span className="text-[#5a6a84] font-mono ml-2">/{c.candidateSlug}</span>}
                    {c.similarityScore && <span className="ml-2 text-violet-300">{Math.round(parseFloat(c.similarityScore) * 100)}% match</span>}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {c.candidatePixelProductId && (
                    <button onClick={() => resolve(c.id, "link_existing")} disabled={busyId === c.id}
                      className="flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-900/30 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-40">
                      <Link2 className="h-3 w-3" /> Link to candidate
                    </button>
                  )}
                  <button onClick={() => resolve(c.id, "create_new")} disabled={busyId === c.id}
                    className="flex items-center gap-1 rounded border border-sky-500/50 bg-sky-900/30 px-2.5 py-1 text-[11.5px] font-semibold text-sky-300 hover:bg-sky-900/60 disabled:opacity-40">
                    <Plus className="h-3 w-3" /> Create new
                  </button>
                  <button onClick={() => resolve(c.id, "dismiss")} disabled={busyId === c.id}
                    className="flex items-center gap-1 rounded border border-[#4b5568] bg-[#252a38] px-2.5 py-1 text-[11.5px] font-semibold text-[#8fa0bb] hover:bg-[#2f3445] disabled:opacity-40">
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                  <span className="ml-auto text-[10.5px] text-[#5a6a84]"><GitMerge className="inline h-2.5 w-2.5" /> {new Date(c.createdAt).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
