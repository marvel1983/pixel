import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Eye, EyeOff, Copy, Flag, ChevronLeft, ChevronRight, Key, Plus, Upload, Download, Trash2, X, Check } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

/* ── Types ── */
interface KeyRow {
  id: number; maskedKey: string; status: string; source: string;
  productName: string; variantName: string; sku: string;
  orderNumber: string | null; customerEmail: string | null;
  soldAt: string | null; createdAt: string;
}
interface Stats { total: number; delivered: number; pending: number; claimed: number }
interface VariantOption { id: number; sku: string; name: string; productName: string }

/* ── Shared styles ── */
const card: React.CSSProperties = { background: "#1a1d28", border: "1px solid #252836", borderRadius: 6, padding: "10px 14px" };
const inp: React.CSSProperties = {
  background: "#0f1117", border: "1px solid #1f2330", borderRadius: 4,
  padding: "6px 10px", fontSize: 12, color: "#c8d0e0", outline: "none", width: "100%", boxSizing: "border-box",
};
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "#566070", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3, display: "block" };
const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 5, background: bg, border: `1px solid ${border}`,
  color, borderRadius: 4, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
});

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  AVAILABLE: { background: "linear-gradient(180deg,#052e1a 0%,#041f14 100%)", color: "#4ade80", border: "1px solid #15803d", boxShadow: "0 0 0 1px rgba(74,222,128,0.12)" },
  SOLD:      { background: "linear-gradient(180deg,#172554 0%,#0f172a 100%)", color: "#93c5fd", border: "1px solid #2563eb", boxShadow: "0 0 0 1px rgba(96,165,250,0.15)" },
  RESERVED:  { background: "linear-gradient(180deg,#422006 0%,#291c0a 100%)", color: "#fcd34d", border: "1px solid #b45309" },
  REVOKED:   { background: "linear-gradient(180deg,#450a0a 0%,#2a0909 100%)", color: "#fca5a5", border: "1px solid #b91c1c" },
};

const SOURCE_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  MANUAL: { bg: "linear-gradient(180deg,#1e3a5f 0%,#152a45 100%)", fg: "#7dd3fc", border: "#3b82f6" },
  BULK_IMPORT: { bg: "linear-gradient(180deg,#14532d 0%,#0f3d22 100%)", fg: "#86efac", border: "#22c55e" },
  DEFAULT: { bg: "linear-gradient(180deg,#3b0764 0%,#2a0548 100%)", fg: "#e9d5ff", border: "#a855f7" },
};

export default function AdminKeysPage() {
  const [rows, setRows]       = useState<KeyRow[]>([]);
  const [stats, setStats]     = useState<Stats>({ total: 0, delivered: 0, pending: 0, claimed: 0 });
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("ALL");
  const [productId, setProductId] = useState("");
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [productOptions, setProductOptions] = useState<{ id: number; name: string }[]>([]);
  const [variants, setVariants]             = useState<VariantOption[]>([]);
  const [revealed, setRevealed]             = useState<Record<number, string>>({});
  const [showAdd, setShowAdd]               = useState(false);
  const [showBulk, setShowBulk]             = useState(false);
  const [claimKey, setClaimKey]             = useState<KeyRow | null>(null);
  const [revealConfirmFor, setRevealConfirmFor] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<{ id: number; mask: string } | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const token = useAuthStore((s) => s.token) ?? "";
  const { toast } = useToast();
  const limit = 50;
  const headers = { Authorization: `Bearer ${token}` };

  /* load products + variants for selectors */
  useEffect(() => {
    fetch(`${API}/admin/keys/products`, { headers }).then((r) => r.json()).then((d) => setProductOptions(d.products ?? [])).catch(() => {});
    fetch(`${API}/admin/keys/variants`, { headers }).then((r) => r.json()).then((d) => setVariants(d.variants ?? [])).catch(() => {});
  }, [token]);

  const fetchKeys = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search)   params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (productId) params.set("productId", productId);
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    fetch(`${API}/admin/keys?${params}`, { headers })
      .then((r) => r.json())
      .then((d) => { setRows(d.keys ?? []); setTotal(d.total ?? 0); setStats(d.stats ?? { total: 0, delivered: 0, pending: 0, claimed: 0 }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, status, productId, from, to]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  /* reveal / hide key */
  const revealKey = (id: number) => {
    if (revealed[id]) {
      setRevealed((p) => { const n = { ...p }; delete n[id]; return n; });
      clearTimeout(timers.current[id]); delete timers.current[id];
      return;
    }
    setRevealConfirmFor(id);
  };

  const confirmRevealKey = async () => {
    if (revealConfirmFor == null) return;
    const id = revealConfirmFor;
    setRevealConfirmFor(null);
    const res = await fetch(`${API}/admin/keys/${id}/reveal`, { method: "POST", headers });
    const data = await res.json();
    if (data.keyValue) {
      setRevealed((p) => ({ ...p, [id]: data.keyValue }));
      timers.current[id] = setTimeout(() => {
        setRevealed((p) => { const n = { ...p }; delete n[id]; return n; });
        delete timers.current[id];
      }, 30000);
    }
  };

  /* copy key */
  const copyKey = (id: number, value: string) => {
    navigator.clipboard.writeText(value);
    fetch(`${API}/admin/keys/${id}/copy-audit`, { method: "POST", headers });
  };

  /* change status */
  const changeStatus = async (id: number, newStatus: string) => {
    await fetch(`${API}/admin/keys/${id}/status`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchKeys();
  };

  /* delete key */
  const deleteKey = (id: number, mask: string) => {
    setDeleteConfirm({ id, mask });
  };

  const confirmDeleteKey = async () => {
    if (!deleteConfirm) return;
    const { id, mask } = deleteConfirm;
    setDeleteConfirm(null);
    const res = await fetch(`${API}/admin/keys/${id}`, { method: "DELETE", headers });
    if (res.ok) {
      fetchKeys();
      toast({ title: "Key removed", description: mask });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: d.error ?? "Could not delete key", variant: "destructive" });
    }
  };

  /* export CSV */
  const exportCsv = () => {
    const params = new URLSearchParams();
    if (search)   params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (productId) params.set("productId", productId);
    if (from) params.set("from", from);
    if (to)   params.set("to", to);
    window.open(`${API}/admin/keys/export?${params}&_token=${token}`, "_blank");
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Key size={16} color="#60a5fa" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", flex: 1 }}>License Keys</span>
        <button onClick={exportCsv} style={btn("#1a1d28", "#252836", "#8b94a8")}><Download size={12} /> Export CSV</button>
        <button onClick={() => setShowBulk(true)} style={btn("#1e2a4a", "#2a3a5a", "#60a5fa")}><Upload size={12} /> Bulk Import</button>
        <button onClick={() => setShowAdd(true)}  style={btn("#1e3a8a", "#2563eb", "#93c5fd")}><Plus   size={12} /> Add Key</button>
      </div>

      {/* ── Stats (kompaktno, rub boje) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, flexShrink: 0 }}>
        {[
          { label: "Total Keys", value: stats.total,    accent: "#94a3b8" },
          { label: "Delivered",  value: stats.delivered, accent: "#3b82f6" },
          { label: "Available",  value: stats.pending,   accent: "#eab308" },
          { label: "Claimed",    value: stats.claimed,   accent: "#f43f5e" },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            style={{
              ...card,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderLeft: `3px solid ${accent}`,
              boxShadow: `inset 0 0 20px ${accent}08`,
            }}
          >
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", margin: 0, lineHeight: 1.1 }}>{value}</p>
              <p style={{ fontSize: 9, fontWeight: 600, color: "#64748b", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0, padding: "8px 10px" }}>
        <div style={{ flex: "1 1 200px", position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#566070" }} />
          <input style={{ ...inp, paddingLeft: 28 }} placeholder="Search order #, product, SKU…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select style={{ ...inp, width: 140 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          {["AVAILABLE","SOLD","RESERVED","REVOKED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select style={{ ...inp, width: 180 }} value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1); }}>
          <option value="">All Products</option>
          {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" style={{ ...inp, width: 130 }} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" style={{ ...inp, width: 130 }} value={to}   onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      {/* ── Table (kompaktan red, jedan red po artiklu) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", ...card, padding: 0 }}>
        <style>{`
          .keys-table tbody tr { transition: background 0.12s ease; }
          .keys-table tbody tr:hover { background: rgba(59, 130, 246, 0.07) !important; }
          .keys-table tbody tr:hover td { border-color: transparent; }
        `}</style>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b", fontSize: 13 }}>Loading…</div>
        ) : (
          <table className="keys-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid #2d3548", position: "sticky", top: 0, background: "linear-gradient(180deg,#161a24 0%,#12151c 100%)", zIndex: 1, boxShadow: "0 1px 0 rgba(59,130,246,0.12)" }}>
                {["Key","Type","Product · SKU","Order #","Customer","Status","Created","Sold","Actions"].map((h) => (
                  <th key={h} style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const src = SOURCE_STYLE[r.source] ?? SOURCE_STYLE.DEFAULT;
                const actionBtn: React.CSSProperties = {
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 6, border: "1px solid transparent", cursor: "pointer", flexShrink: 0,
                  transition: "background 0.12s, border-color 0.12s, color 0.12s",
                };
                return (
                <tr key={r.id} style={{ borderBottom: "1px solid #232733" }}>
                  <td style={{ padding: "4px 8px", verticalAlign: "middle" }}>
                    {revealed[r.id] ? (
                      <span style={{
                        display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 11, fontWeight: 700,
                        color: "#fbbf24", background: "linear-gradient(180deg,#422006 0%,#2d1604 100%)",
                        border: "1px solid #d97706", borderRadius: 4, padding: "3px 8px",
                        boxShadow: "0 0 12px rgba(251,191,36,0.12)",
                      }} title={revealed[r.id]}>{revealed[r.id]}</span>
                    ) : (
                      <span style={{
                        display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 11, fontWeight: 600,
                        color: "#a5b4fc", background: "linear-gradient(180deg,#1e293b 0%,#151b2e 100%)",
                        border: "1px solid #475569", borderRadius: 4, padding: "3px 8px",
                      }} title={r.maskedKey}>{r.maskedKey}</span>
                    )}
                  </td>
                  <td style={{ padding: "4px 8px", verticalAlign: "middle" }}>
                    <span style={{
                      display: "inline-block", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                      background: src.bg, color: src.fg, border: `1px solid ${src.border}`, borderRadius: 4, padding: "3px 7px",
                      whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                    }} title={r.source}>{r.source.replace(/_/g, " ")}</span>
                  </td>
                  <td style={{ padding: "4px 8px", verticalAlign: "middle", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, whiteSpace: "nowrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 11, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto", minWidth: 0 }} title={r.productName}>{r.productName}</span>
                      <span style={{ color: "#475569", fontWeight: 700, flexShrink: 0 }}>·</span>
                      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 600, color: "#64748b", flexShrink: 0, maxWidth: "42%", overflow: "hidden", textOverflow: "ellipsis" }} title={r.sku}>{r.sku}</span>
                    </div>
                  </td>
                  <td style={{ padding: "4px 8px", fontFamily: "ui-monospace, monospace", fontSize: 10, fontWeight: 600, color: r.orderNumber ? "#38bdf8" : "#475569", verticalAlign: "middle" }}>{r.orderNumber ?? "—"}</td>
                  <td style={{ padding: "4px 8px", fontSize: 10, color: r.customerEmail ? "#cbd5e1" : "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }} title={r.customerEmail ?? ""}>{r.customerEmail ?? "—"}</td>
                  <td style={{ padding: "4px 8px", verticalAlign: "middle" }}>
                    <select
                      value={r.status}
                      onChange={(e) => changeStatus(r.id, e.target.value)}
                      style={{
                        ...(STATUS_STYLE[r.status] ?? STATUS_STYLE.AVAILABLE),
                        fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                        borderRadius: 4, padding: "4px 8px", cursor: "pointer", outline: "none", appearance: "none", maxWidth: "100%",
                      }}>
                      {["AVAILABLE","SOLD","RESERVED","REVOKED"].map((s) => <option key={s} value={s} style={{ background: "#1a1d28", color: "#c8d0e0" }}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "4px 8px", color: "#64748b", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", verticalAlign: "middle" }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: "4px 8px", color: r.soldAt ? "#94a3b8" : "#475569", fontSize: 10, whiteSpace: "nowrap", verticalAlign: "middle" }}>{r.soldAt ? new Date(r.soldAt).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: "4px 6px", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <button type="button" onClick={() => revealKey(r.id)} title={revealed[r.id] ? "Hide key" : "Reveal key"}
                        style={{ ...actionBtn, background: revealed[r.id] ? "rgba(251,191,36,0.12)" : "rgba(56,189,248,0.1)", borderColor: revealed[r.id] ? "rgba(251,191,36,0.35)" : "rgba(56,189,248,0.25)", color: revealed[r.id] ? "#fbbf24" : "#38bdf8" }}>
                        {revealed[r.id] ? <EyeOff size={14} strokeWidth={2.25} /> : <Eye size={14} strokeWidth={2.25} />}
                      </button>
                      {revealed[r.id] && (
                        <button type="button" onClick={() => copyKey(r.id, revealed[r.id])} title="Copy key"
                          style={{ ...actionBtn, background: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.3)", color: "#4ade80" }}>
                          <Copy size={14} strokeWidth={2.25} />
                        </button>
                      )}
                      {r.status === "SOLD" && (
                        <button type="button" onClick={() => setClaimKey(r)} title="Submit claim"
                          style={{ ...actionBtn, background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.35)", color: "#fbbf24" }}>
                          <Flag size={14} strokeWidth={2.25} />
                        </button>
                      )}
                      {r.status !== "SOLD" && (
                        <button type="button" onClick={() => deleteKey(r.id, r.maskedKey)} title="Delete key"
                          style={{ ...actionBtn, background: "rgba(244,63,94,0.08)", borderColor: "rgba(244,63,94,0.28)", color: "#fb7185" }}>
                          <Trash2 size={14} strokeWidth={2.25} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: "40px 0", textAlign: "center", color: "#566070", fontSize: 12 }}>
                  No keys found. Click "Add Key" or "Bulk Import" to add license keys.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            style={{ ...btn("#1a1d28", "#252836", page <= 1 ? "#3a4255" : "#8b94a8"), cursor: page <= 1 ? "not-allowed" : "pointer" }}>
            <ChevronLeft size={12} /> Previous
          </button>
          <span style={{ fontSize: 11, color: "#566070" }}>Page {page} of {totalPages} ({total} keys)</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
            style={{ ...btn("#1a1d28", "#252836", page >= totalPages ? "#3a4255" : "#8b94a8"), cursor: page >= totalPages ? "not-allowed" : "pointer" }}>
            Next <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showAdd   && <AddKeyModal    token={token} variants={variants} onClose={() => setShowAdd(false)}   onSaved={() => { setShowAdd(false);   fetchKeys(); }} />}
      {showBulk  && <BulkImportModal token={token} variants={variants} onClose={() => setShowBulk(false)} onSaved={(n) => { setShowBulk(false); fetchKeys(); toast({ title: "Import complete", description: `${n} keys imported.` }); }} />}
      {claimKey  && <KeyClaimModal   token={token} keyRow={claimKey}  onClose={() => setClaimKey(null)} onSubmit={() => { setClaimKey(null); fetchKeys(); }} />}

      {revealConfirmFor != null && (
        <ConfirmModal
          title="Reveal license key"
          message="This will show the full key on screen for 30 seconds. The action is recorded in the audit log."
          confirmLabel="Reveal key"
          onClose={() => setRevealConfirmFor(null)}
          onConfirm={confirmRevealKey}
        />
      )}

      {deleteConfirm && (
        <ConfirmModal
          title="Delete license key"
          message={`Permanently delete ${deleteConfirm.mask}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onClose={() => setDeleteConfirm(null)}
          onConfirm={confirmDeleteKey}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════
   ADD SINGLE KEY MODAL
══════════════════════════════════════ */
function AddKeyModal({ token, variants, onClose, onSaved }: { token: string; variants: VariantOption[]; onClose: () => void; onSaved: () => void }) {
  const [variantId, setVariantId] = useState("");
  const [keyValue, setKeyValue]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const save = async () => {
    if (!variantId || !keyValue.trim()) { setError("Select a variant and enter the key value"); return; }
    setSaving(true); setError("");
    const res = await fetch(`${API}/admin/keys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: Number(variantId), keyValue: keyValue.trim() }),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else { const d = await res.json(); setError(d.error ?? "Failed to add key"); }
  };

  return (
    <Modal title="Add License Key" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={lbl}>Product Variant *</label>
          <select style={inp} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Select variant…</option>
            {variants.map((v) => <option key={v.id} value={v.id}>{v.productName} — {v.name} ({v.sku})</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>License Key *</label>
          <input style={inp} placeholder="e.g. XXXXX-XXXXX-XXXXX-XXXXX" value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        {error && <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0a2015", border: "1px solid #166534", color: "#4ade80", borderRadius: 4, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
            <Check size={11} /> {saving ? "Saving…" : "Add Key"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════
   BULK IMPORT MODAL
══════════════════════════════════════ */
function BulkImportModal({ token, variants, onClose, onSaved }: { token: string; variants: VariantOption[]; onClose: () => void; onSaved: (n: number) => void }) {
  const [variantId, setVariantId] = useState("");
  const [keys, setKeys]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const lineCount = keys.split(/\r?\n/).filter((l) => l.trim()).length;

  const save = async () => {
    if (!variantId || !keys.trim()) { setError("Select a variant and enter at least one key"); return; }
    setSaving(true); setError("");
    const res = await fetch(`${API}/admin/keys/bulk-import`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: Number(variantId), keys }),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); onSaved(d.imported); }
    else { const d = await res.json(); setError(d.error ?? "Import failed"); }
  };

  return (
    <Modal title="Bulk Import Keys" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={lbl}>Product Variant *</label>
          <select style={inp} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Select variant…</option>
            {variants.map((v) => <option key={v.id} value={v.id}>{v.productName} — {v.name} ({v.sku})</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Keys — one per line * {lineCount > 0 && <span style={{ color: "#4ade80" }}>({lineCount} keys)</span>}</label>
          <textarea
            style={{ ...inp, height: 180, resize: "vertical", fontFamily: "monospace", lineHeight: 1.5 }}
            placeholder={"XXXXX-XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY-YYYYY\n..."}
            value={keys}
            onChange={(e) => setKeys(e.target.value)}
          />
        </div>
        <p style={{ fontSize: 10, color: "#566070", margin: 0 }}>Max 1,000 keys per import. Duplicates are accepted (same key can appear multiple times).</p>
        {error && <p style={{ fontSize: 11, color: "#f87171", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={saving || lineCount === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0a2015", border: "1px solid #166534", color: "#4ade80", borderRadius: 4, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: (saving || lineCount === 0) ? "not-allowed" : "pointer", opacity: (saving || lineCount === 0) ? 0.6 : 1 }}>
            <Upload size={11} /> {saving ? "Importing…" : `Import ${lineCount || ""} Keys`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════
   CLAIM MODAL
══════════════════════════════════════ */
const REASONS = ["DEFECTIVE", "ALREADY_USED", "WRONG_PRODUCT", "NOT_RECEIVED", "OTHER"] as const;

function KeyClaimModal({ token, keyRow, onClose, onSubmit }: { token: string; keyRow: KeyRow; onClose: () => void; onSubmit: () => void }) {
  const [email,  setEmail]  = useState(keyRow.customerEmail ?? "");
  const [reason, setReason] = useState<string>("DEFECTIVE");
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setSaving(true);
    await fetch(`${API}/admin/claims`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKeyId: keyRow.id, customerEmail: email, reason, notes }),
    });
    setSaving(false);
    onSubmit();
  };

  return (
    <Modal title="Submit Claim" onClose={onClose}>
      <p style={{ fontSize: 11, color: "#566070", margin: "0 0 10px" }}>Key: <span style={{ fontFamily: "monospace", color: "#8b94a8" }}>{keyRow.maskedKey}</span> — {keyRow.productName}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div><label style={lbl}>Customer Email *</label><input style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" /></div>
        <div>
          <label style={lbl}>Reason *</label>
          <select style={inp} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Notes</label><textarea style={{ ...inp, height: 70, resize: "none" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional details…" /></div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "5px 12px", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} disabled={saving || !email.trim()}
            style={{ background: "#1a0808", border: "1px solid #991b1b", color: "#f87171", borderRadius: 4, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            {saving ? "Submitting…" : "Submit Claim"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════
   CONFIRM (replaces window.confirm)
══════════════════════════════════════ */
function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ fontSize: 12, color: "#8b94a8", margin: "0 0 18px", lineHeight: 1.55 }}>{message}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          style={
            danger
              ? { background: "#450a0a", border: "1px solid #991b1b", color: "#fca5a5", borderRadius: 4, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }
              : { background: "#1e3a8a", border: "1px solid #2563eb", color: "#bfdbfe", borderRadius: 4, padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }
          }
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════
   SHARED MODAL WRAPPER
══════════════════════════════════════ */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}>
      <div style={{ background: "#1a1d28", border: "1px solid #252836", borderRadius: 8, padding: "18px 20px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#566070", display: "flex" }}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
