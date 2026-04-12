import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface TagRow {
  id: number;
  name: string;
  slug: string;
  colorHex: string | null;
  sortOrder: number;
  productCount?: number;
}

const inp: React.CSSProperties = {
  width: "100%", background: "#0f1117", border: "1px solid #1f2330",
  borderRadius: 4, padding: "4px 8px", fontSize: 12, color: "#c8d0e0",
  outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#566070", textTransform: "uppercase",
  letterSpacing: "0.05em", marginBottom: 3, display: "block",
};
const card: React.CSSProperties = {
  background: "#1a1d28", border: "1px solid #252836", borderRadius: 6, padding: "10px 12px",
};
const secTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#566070", textTransform: "uppercase",
  letterSpacing: "0.07em", marginBottom: 8,
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const emptyForm = (): { name: string; slug: string; colorHex: string; sortOrder: number } => ({
  name: "", slug: "", colorHex: "#3b82f6", sortOrder: 0,
});

export default function AdminTagsManagerPage() {
  const token = useAuthStore((s) => s.token) ?? "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TagRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchTags = () => {
    setLoading(true);
    fetch(`${API_URL}/admin/tags`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setTags(Array.isArray(data) ? data : data.tags ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchTags, []);

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setForm(emptyForm());
  };

  const openEdit = (tag: TagRow) => {
    setIsNew(false);
    setEditing(tag);
    setForm({ name: tag.name, slug: tag.slug, colorHex: tag.colorHex ?? "#3b82f6", sortOrder: tag.sortOrder });
  };

  const cancelEdit = () => {
    setIsNew(false);
    setEditing(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const body = { name: form.name.trim(), colorHex: form.colorHex || null, sortOrder: form.sortOrder };
    const url = isNew ? `${API_URL}/admin/tags` : `${API_URL}/admin/tags/${editing!.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) }).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      fetchTags();
      cancelEdit();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this tag?")) return;
    await fetch(`${API_URL}/admin/tags/${id}`, { method: "DELETE", headers });
    setTags((prev) => prev.filter((t) => t.id !== id));
    if (editing?.id === id) cancelEdit();
  };

  const thStyle: React.CSSProperties = {
    padding: "5px 8px", fontSize: 9, fontWeight: 700, color: "#566070",
    textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left",
    borderBottom: "1px solid #1f2330", background: "#13161e",
  };
  const tdStyle: React.CSSProperties = {
    padding: "5px 8px", fontSize: 11, color: "#c8d0e0",
    borderBottom: "1px solid #1a1d28",
  };
  const btnPrimary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    background: "#1e3a8a", border: "1px solid #2563eb", color: "#93c5fd",
    borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
  };
  const btnGhost: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", color: "#566070",
    padding: "2px 5px", display: "flex", alignItems: "center", borderRadius: 3,
  };
  const btnDanger: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", color: "#f87171",
    padding: "2px 5px", display: "flex", alignItems: "center", borderRadius: 3,
  };

  const showForm = isNew || editing !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Tags</h1>
        <button style={btnPrimary} onClick={openNew}>
          <Plus size={12} /> New Tag
        </button>
      </div>

      {/* Tags table */}
      <div style={card}>
        <p style={secTitle}>All Tags</p>
        {loading ? (
          <p style={{ fontSize: 12, color: "#566070" }}>Loading…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Name", "Slug", "Color", "Products", "Sort", "Actions"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tags.length === 0 && (
                  <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#566070", padding: 16 }}>No tags yet.</td></tr>
                )}
                {tags.map((t) => {
                  const isSelected = editing?.id === t.id;
                  return (
                    <tr key={t.id} style={{ background: isSelected ? "#1e2a4a" : "transparent" }}>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: t.colorHex ?? "#3b82f6",
                          color: "#fff", borderRadius: 3, padding: "1px 7px", fontSize: 11, fontWeight: 600,
                        }}>
                          {t.name}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "#566070", fontFamily: "monospace", fontSize: 10 }}>{t.slug}</td>
                      <td style={tdStyle}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 14, height: 14, borderRadius: 3, background: t.colorHex ?? "#3b82f6", display: "inline-block", border: "1px solid #252836" }} />
                          <span style={{ fontSize: 10, color: "#8b94a8" }}>{t.colorHex ?? "—"}</span>
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "#566070", textAlign: "center" }}>{t.productCount ?? "—"}</td>
                      <td style={{ ...tdStyle, color: "#566070", textAlign: "center" }}>{t.sortOrder}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <button style={btnGhost} title="Edit" onClick={() => openEdit(t)}><Pencil size={12} /></button>
                        <button style={btnDanger} title="Delete" onClick={() => handleDelete(t.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={card}>
          <p style={secTitle}>{isNew ? "New Tag" : `Edit: ${editing?.name}`}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={lbl}>Name</label>
              <input
                style={inp}
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: isNew ? slugify(name) : f.slug }));
                }}
              />
            </div>
            <div>
              <label style={lbl}>Slug</label>
              <input style={{ ...inp, color: "#8b94a8" }} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Color Hex</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: 4, background: form.colorHex || "#3b82f6", flexShrink: 0, border: "1px solid #252836" }} />
                <input style={inp} placeholder="#3b82f6" value={form.colorHex} onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={lbl}>Sort Order</label>
              <input type="number" style={inp} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btnPrimary} onClick={handleSave} disabled={saving}>
              <Check size={11} /> {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancelEdit} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
