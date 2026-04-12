import { useEffect, useState, useCallback } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { CategoryRow, type AdminCategory, type EditState } from "@/components/admin/category-row";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: 6,
  border: "1.5px solid #3d6499",
  background: "#1e2d47",
  color: "#e2e8f0",
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 600,
  color: "#c0cce0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", slug: "", displayName: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const token = useAuthStore((s) => s.token);

  const fetchCategories = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCats(d.categories ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const startEdit = (cat: AdminCategory) => {
    setEditId(cat.id);
    setEditState({
      name: cat.name, displayName: cat.displayName ?? cat.name,
      slug: cat.slug, description: cat.description ?? "",
      imageUrl: cat.imageUrl ?? "", sortOrder: cat.sortOrder,
      isActive: cat.isActive, showInNav: cat.showInNav, parentId: cat.parentId,
    });
  };

  const cancelEdit = () => { setEditId(null); setEditState(null); };

  const saveEdit = async () => {
    if (!editState || editId === null) return;
    setSaving(true);
    await fetch(`${API_URL}/admin/categories/${editId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(editState),
    });
    setSaving(false);
    cancelEdit();
    fetchCategories();
  };

  const handleToggleNav = async (id: number) => {
    await fetch(`${API_URL}/admin/categories/${id}/toggle`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchCategories();
  };

  const handleCreate = async () => {
    if (!newCat.name.trim() || !newCat.slug.trim()) return;
    setSaving(true);
    const res = await fetch(`${API_URL}/admin/categories`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCat, displayName: newCat.displayName || newCat.name }),
    });
    setSaving(false);
    if (res.ok) {
      setNewCat({ name: "", slug: "", displayName: "", sortOrder: 0 });
      setShowCreate(false);
      fetchCategories();
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`${API_URL}/admin/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) fetchCategories();
    else {
      const data = await res.json();
      alert(data.error ?? "Cannot delete category");
    }
  };

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #1e3a8a, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FolderOpen size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
              Categories
            </h1>
            <p style={{ fontSize: 12, color: "#6b7a99", margin: 0 }}>
              {cats.length} {cats.length === 1 ? "category" : "categories"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
            fontWeight: 600, color: "#fff",
            background: showCreate
              ? "linear-gradient(135deg, #1e3a8a, #4f46e5)"
              : "linear-gradient(135deg, #1e3a8a, #4f46e5)",
            boxShadow: "0 2px 8px #1e3a8a60",
          }}>
          <Plus size={15} />
          Add Category
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={{
          borderRadius: 12, border: "1px solid #2d3a52",
          background: "linear-gradient(135deg, #0d1526 0%, #111828 100%)",
          padding: 20, boxShadow: "0 4px 24px #00000040",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: "linear-gradient(180deg, #4f46e5, #7c3aed)" }} />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>New Category</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Name (source)</label>
              <input
                style={INPUT_STYLE}
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value, slug: autoSlug(e.target.value) })}
                placeholder="e.g. Windows"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Display Name</label>
              <input
                style={INPUT_STYLE}
                value={newCat.displayName}
                onChange={(e) => setNewCat({ ...newCat, displayName: e.target.value })}
                placeholder={newCat.name || "Same as name"}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Slug</label>
              <input
                style={INPUT_STYLE}
                value={newCat.slug}
                onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                placeholder="auto-generated"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Sort Order</label>
              <input
                type="number"
                style={INPUT_STYLE}
                value={newCat.sortOrder}
                onChange={(e) => setNewCat({ ...newCat, sortOrder: Number(e.target.value) })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              disabled={saving || !newCat.name.trim() || !newCat.slug.trim()}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#fff",
                background: "linear-gradient(135deg, #166534, #15803d)",
                opacity: saving || !newCat.name.trim() || !newCat.slug.trim() ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}>
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{
                padding: "8px 20px", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: "#8892a4",
                background: "transparent", border: "1px solid #2d3a52",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#4f6faa"; (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2d3a52"; (e.currentTarget as HTMLButtonElement).style.color = "#8892a4"; }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 52, borderRadius: 8, background: "#111828", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      ) : (
        <div style={{
          borderRadius: 12, border: "1px solid #1e2435",
          background: "#0d1120", overflow: "hidden",
          boxShadow: "0 4px 24px #00000040",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#080c16", borderBottom: "1px solid #1e2435" }}>
                  {["Category Name", "Display Name", "Products", "Slug", "Sort", "Show in Nav", "Actions"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 16px", textAlign: "left", fontWeight: 700,
                      fontSize: 11, color: "#a0b0cc", textTransform: "uppercase", letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cats.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#6b7a99" }}>
                      No categories yet. Click "Add Category" to create one.
                    </td>
                  </tr>
                ) : (
                  cats.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      isEditing={editId === cat.id}
                      editState={editId === cat.id ? editState : null}
                      allCats={cats}
                      saving={saving}
                      onStartEdit={() => startEdit(cat)}
                      onCancel={cancelEdit}
                      onSave={saveEdit}
                      onToggleNav={() => handleToggleNav(cat.id)}
                      onDelete={() => handleDelete(cat.id, cat.name)}
                      onEditChange={(updates) => editState && setEditState({ ...editState, ...updates })}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
