import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { CategoryRow } from "@/components/admin/category-row";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

interface EditState {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  parentId: number | null;
}

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", slug: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const token = useAuthStore((s) => s.token);

  const fetchCategories = useCallback(() => {
    setLoading(true);
    fetch(`${API_URL}/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCats(d.categories))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const startEdit = (cat: AdminCategory) => {
    setEditId(cat.id);
    setEditState({
      name: cat.name, slug: cat.slug, description: cat.description ?? "",
      imageUrl: cat.imageUrl ?? "", sortOrder: cat.sortOrder,
      isActive: cat.isActive, parentId: cat.parentId,
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

  const handleToggle = async (id: number) => {
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
      body: JSON.stringify(newCat),
    });
    setSaving(false);
    if (res.ok) {
      setNewCat({ name: "", slug: "", sortOrder: 0 });
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Categories ({cats.length})</h1>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1 h-4 w-4" /> Add Category
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-semibold text-sm">New Category</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Name</label>
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value, slug: autoSlug(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Slug</label>
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={newCat.slug}
                onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Sort Order</label>
              <input type="number" className="w-full rounded-md border px-3 py-2 text-sm" value={newCat.sortOrder}
                onChange={(e) => setNewCat({ ...newCat, sortOrder: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Products</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Slug</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Sort</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Show in Nav</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} isEditing={editId === cat.id}
                  editState={editId === cat.id ? editState : null} allCats={cats}
                  saving={saving}
                  onStartEdit={() => startEdit(cat)} onCancel={cancelEdit}
                  onSave={saveEdit} onToggle={() => handleToggle(cat.id)}
                  onDelete={() => handleDelete(cat.id, cat.name)}
                  onEditChange={(updates) => editState && setEditState({ ...editState, ...updates })} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
