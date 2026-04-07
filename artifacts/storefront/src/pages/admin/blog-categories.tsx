import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export default function AdminBlogCategoriesPage() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", sortOrder: "0" });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    try {
      const res = await fetch(`${API}/admin/blog/categories`, { headers, credentials: "include" });
      if (res.ok) { const d = await res.json(); setCategories(d.categories); }
    } catch {} finally { setLoading(false); }
  }

  function startEdit(cat: Category) {
    setEditing(cat.id);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || "", sortOrder: String(cat.sortOrder) });
    setCreating(false);
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
    setForm({ name: "", slug: "", description: "", sortOrder: "0" });
  }

  function cancel() { setEditing(null); setCreating(false); }

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function save() {
    if (!form.name || !form.slug) { toast({ title: "Name and slug required", variant: "destructive" }); return; }
    const body = { ...form, sortOrder: parseInt(form.sortOrder) || 0 };
    try {
      const url = creating ? `${API}/admin/blog/categories` : `${API}/admin/blog/categories/${editing}`;
      const method = creating ? "POST" : "PUT";
      const res = await fetch(url, { method, headers, credentials: "include", body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: creating ? "Category created" : "Category updated" });
      cancel();
      loadCategories();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm("Delete this category? Posts will be uncategorized.")) return;
    const res = await fetch(`${API}/admin/blog/categories/${id}`, { method: "DELETE", headers, credentials: "include" });
    if (res.ok) { toast({ title: "Category deleted" }); loadCategories(); }
    else toast({ title: "Failed to delete", variant: "destructive" });
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Blog Categories</h1>
        <Button onClick={startCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Category</Button>
      </div>

      {(creating || editing !== null) && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-semibold">{creating ? "New Category" : "Edit Category"}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input placeholder="Category name" value={form.name}
              onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); if (creating) setForm((p) => ({ ...p, slug: generateSlug(e.target.value) })); }} />
            <Input placeholder="slug" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} />
            <Input placeholder="Description (optional)" value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <Input type="number" placeholder="Sort order" value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} size="sm" className="gap-1"><Save className="h-3.5 w-3.5" /> Save</Button>
            <Button onClick={cancel} size="sm" variant="outline" className="gap-1"><X className="h-3.5 w-3.5" /> Cancel</Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white overflow-hidden">
        {categories.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No categories yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Order</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{cat.slug}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{cat.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteCategory(cat.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
