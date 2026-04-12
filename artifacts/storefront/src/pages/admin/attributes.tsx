import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface AttributeDefinition {
  id: number;
  name: string;
  slug: string;
  type: "SELECT" | "TEXT" | "BOOLEAN" | "NUMBER";
  isFilterable: boolean;
  isVisibleOnPdp: boolean;
  unit: string | null;
  sortOrder: number;
}

interface AttributeOption {
  id: number;
  attributeId: number;
  value: string;
  slug: string;
  colorHex: string | null;
  sortOrder: number;
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

const ATTR_TYPES = ["SELECT", "TEXT", "BOOLEAN", "NUMBER"] as const;

const emptyForm = () => ({
  name: "",
  slug: "",
  type: "SELECT" as AttributeDefinition["type"],
  isFilterable: true,
  isVisibleOnPdp: true,
  unit: "",
  sortOrder: 0,
});

const emptyOptionForm = () => ({
  value: "",
  slug: "",
  colorHex: "",
  sortOrder: 0,
});

export default function AdminAttributesPage() {
  const token = useAuthStore((s) => s.token) ?? "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AttributeDefinition | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [options, setOptions] = useState<AttributeOption[]>([]);
  const [optionForm, setOptionForm] = useState(emptyOptionForm());
  const [savingAttr, setSavingAttr] = useState(false);
  const [savingOption, setSavingOption] = useState(false);

  const fetchAttributes = () => {
    setLoading(true);
    fetch(`${API_URL}/admin/attributes`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setAttributes(Array.isArray(data) ? data : data.attributes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchAttributes, []);

  const fetchOptions = (attrId: number) => {
    fetch(`${API_URL}/admin/attributes/${attrId}/options`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setOptions(Array.isArray(data) ? data : data.options ?? []))
      .catch(() => {});
  };

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setForm(emptyForm());
    setOptions([]);
  };

  const openEdit = (attr: AttributeDefinition) => {
    setIsNew(false);
    setEditing(attr);
    setForm({
      name: attr.name,
      slug: attr.slug,
      type: attr.type,
      isFilterable: attr.isFilterable,
      isVisibleOnPdp: attr.isVisibleOnPdp,
      unit: attr.unit ?? "",
      sortOrder: attr.sortOrder,
    });
    if (attr.type === "SELECT") {
      fetchOptions(attr.id);
    } else {
      setOptions([]);
    }
  };

  const cancelEdit = () => {
    setIsNew(false);
    setEditing(null);
    setOptions([]);
  };

  const handleSaveAttr = async () => {
    setSavingAttr(true);
    const body = {
      name: form.name.trim(),
      type: form.type,
      isFilterable: form.isFilterable,
      isVisibleOnPdp: form.isVisibleOnPdp,
      unit: form.unit.trim() || null,
      sortOrder: form.sortOrder,
    };
    const url = isNew ? `${API_URL}/admin/attributes` : `${API_URL}/admin/attributes/${editing!.id}`;
    const method = isNew ? "POST" : "PUT";
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) }).catch(() => null);
    setSavingAttr(false);
    if (res?.ok) {
      const data = await res.json();
      const saved: AttributeDefinition = data.attribute ?? data;
      if (isNew) {
        setAttributes((prev) => [...prev, saved]);
        setIsNew(false);
        setEditing(saved);
        setForm((f) => ({ ...f, slug: saved.slug }));
        if (saved.type === "SELECT") fetchOptions(saved.id);
      } else {
        setAttributes((prev) => prev.map((a) => a.id === saved.id ? saved : a));
        setEditing(saved);
        if (saved.type !== "SELECT") setOptions([]);
        else if (options.length === 0) fetchOptions(saved.id);
      }
    }
  };

  const handleDeleteAttr = async (id: number) => {
    if (!confirm("Delete this attribute?")) return;
    await fetch(`${API_URL}/admin/attributes/${id}`, { method: "DELETE", headers });
    setAttributes((prev) => prev.filter((a) => a.id !== id));
    if (editing?.id === id) cancelEdit();
  };

  const handleAddOption = async () => {
    if (!editing || !optionForm.value.trim()) return;
    setSavingOption(true);
    const body = {
      value: optionForm.value.trim(),
      colorHex: optionForm.colorHex.trim() || null,
      sortOrder: optionForm.sortOrder,
    };
    const res = await fetch(`${API_URL}/admin/attributes/${editing.id}/options`, {
      method: "POST", headers, body: JSON.stringify(body),
    }).catch(() => null);
    setSavingOption(false);
    if (res?.ok) {
      const data = await res.json();
      const newOpt: AttributeOption = data.option ?? data;
      setOptions((prev) => [...prev, newOpt]);
      setOptionForm(emptyOptionForm());
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    await fetch(`${API_URL}/admin/attribute-options/${optionId}`, { method: "DELETE", headers });
    setOptions((prev) => prev.filter((o) => o.id !== optionId));
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
  const showOptions = showForm && !isNew && editing?.type === "SELECT";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Attributes</h1>
        <button style={btnPrimary} onClick={openNew}>
          <Plus size={12} /> New Attribute
        </button>
      </div>

      {/* Attributes table */}
      <div style={card}>
        <p style={secTitle}>Attribute Definitions</p>
        {loading ? (
          <p style={{ fontSize: 12, color: "#566070" }}>Loading…</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr>
                  {["Name", "Slug", "Type", "Filterable", "PDP", "Options", "Sort", "Actions"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attributes.length === 0 && (
                  <tr><td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#566070", padding: 16 }}>No attributes yet.</td></tr>
                )}
                {attributes.map((a) => {
                  const isSelected = editing?.id === a.id;
                  return (
                    <tr key={a.id} style={{ background: isSelected ? "#1e2a4a" : "transparent" }}>
                      <td style={{ ...tdStyle, color: isSelected ? "#93c5fd" : "#c8d0e0", fontWeight: isSelected ? 600 : 400 }}>{a.name}</td>
                      <td style={{ ...tdStyle, color: "#566070", fontFamily: "monospace", fontSize: 10 }}>{a.slug}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 9, borderRadius: 3, padding: "1px 6px", fontWeight: 700,
                          background: a.type === "SELECT" ? "#1e3a8a" : a.type === "NUMBER" ? "#1a3020" : a.type === "BOOLEAN" ? "#2a1a40" : "#1f2330",
                          color: a.type === "SELECT" ? "#93c5fd" : a.type === "NUMBER" ? "#4ade80" : a.type === "BOOLEAN" ? "#c084fc" : "#8b94a8",
                        }}>{a.type}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{a.isFilterable ? <span style={{ color: "#4ade80", fontSize: 11 }}>✓</span> : <span style={{ color: "#3a4255" }}>–</span>}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{a.isVisibleOnPdp ? <span style={{ color: "#4ade80", fontSize: 11 }}>✓</span> : <span style={{ color: "#3a4255" }}>–</span>}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#566070" }}>{a.type === "SELECT" ? "–" : "N/A"}</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#566070" }}>{a.sortOrder}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <button style={btnGhost} title="Edit" onClick={() => openEdit(a)}><Pencil size={12} /></button>
                        <button style={btnDanger} title="Delete" onClick={() => handleDeleteAttr(a.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Edit / New Form */}
      {showForm && (
        <div style={card}>
          <p style={secTitle}>{isNew ? "New Attribute" : `Edit: ${editing?.name}`}</p>
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
              <input
                style={{ ...inp, color: "#8b94a8" }}
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select style={inp} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AttributeDefinition["type"] }))}>
                {ATTR_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Unit (optional)</label>
              <input style={inp} placeholder="e.g. GB, MHz, px" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Sort Order</label>
              <input type="number" style={inp} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={form.isFilterable} onChange={(e) => setForm((f) => ({ ...f, isFilterable: e.target.checked }))} />
                <span style={{ fontSize: 11, color: "#c8d0e0" }}>Is Filterable</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={form.isVisibleOnPdp} onChange={(e) => setForm((f) => ({ ...f, isVisibleOnPdp: e.target.checked }))} />
                <span style={{ fontSize: 11, color: "#c8d0e0" }}>Show on PDP</span>
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={btnPrimary} onClick={handleSaveAttr} disabled={savingAttr}>
              <Check size={11} /> {savingAttr ? "Saving…" : "Save"}
            </button>
            <button onClick={cancelEdit} style={{ background: "none", border: "1px solid #252836", color: "#8b94a8", borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Options section for SELECT type */}
      {showOptions && editing && (
        <div style={card}>
          <p style={secTitle}>Options — {editing.name}</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 10 }}>
            <thead>
              <tr>
                {["Value", "Slug", "Color", "Sort", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {options.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#566070", padding: 10 }}>No options yet.</td></tr>
              )}
              {options.map((opt) => (
                <tr key={opt.id}>
                  <td style={tdStyle}>{opt.value}</td>
                  <td style={{ ...tdStyle, color: "#566070", fontFamily: "monospace", fontSize: 10 }}>{opt.slug}</td>
                  <td style={tdStyle}>
                    {opt.colorHex ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: opt.colorHex, display: "inline-block", border: "1px solid #252836" }} />
                        <span style={{ fontSize: 10, color: "#8b94a8" }}>{opt.colorHex}</span>
                      </span>
                    ) : <span style={{ color: "#3a4255" }}>–</span>}
                  </td>
                  <td style={{ ...tdStyle, color: "#566070" }}>{opt.sortOrder}</td>
                  <td style={tdStyle}>
                    <button style={btnDanger} onClick={() => handleDeleteOption(opt.id)}><Trash2 size={11} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add option form */}
          <div style={{ background: "#13161e", border: "1px solid #1f2330", borderRadius: 5, padding: "8px 10px" }}>
            <p style={{ ...secTitle, marginBottom: 6 }}>+ Add Option</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 70px auto", gap: 6, alignItems: "flex-end" }}>
              <div>
                <label style={lbl}>Value</label>
                <input
                  style={inp}
                  placeholder="e.g. Lifetime"
                  value={optionForm.value}
                  onChange={(e) => {
                    const value = e.target.value;
                    setOptionForm((f) => ({ ...f, value, slug: slugify(value) }));
                  }}
                />
              </div>
              <div>
                <label style={lbl}>Slug</label>
                <input style={{ ...inp, color: "#8b94a8" }} value={optionForm.slug} onChange={(e) => setOptionForm((f) => ({ ...f, slug: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Color Hex</label>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {optionForm.colorHex && (
                    <span style={{ width: 14, height: 14, borderRadius: 2, background: optionForm.colorHex, flexShrink: 0, border: "1px solid #252836" }} />
                  )}
                  <input style={{ ...inp }} placeholder="#3b82f6" value={optionForm.colorHex} onChange={(e) => setOptionForm((f) => ({ ...f, colorHex: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Sort</label>
                <input type="number" style={inp} value={optionForm.sortOrder} onChange={(e) => setOptionForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
              </div>
              <div>
                <button style={{ ...btnPrimary, whiteSpace: "nowrap" }} onClick={handleAddOption} disabled={savingOption}>
                  {savingOption ? "…" : <><Plus size={11} /> Add</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
