import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GripVertical, Plus, Pencil, Trash2, Eye, ChevronRight } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Brand {
  id: number; name: string; slug: string; bannerImage: string | null;
  bgColor: string; title: string | null; description: string | null;
  marketingPoints: string[]; productIds: number[];
  isEnabled: boolean; sortOrder: number;
}

function SortableBrand({ brand, onEdit, onDelete, onToggle }: { brand: Brand; onEdit: (b: Brand) => void; onDelete: (id: number) => void; onToggle: (b: Brand) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: brand.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border bg-white p-3">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground"><GripVertical className="h-5 w-5" /></button>
      <div className={`w-10 h-10 rounded-lg ${brand.bgColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>{brand.name.substring(0, 2).toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{brand.name}</p>
        <p className="text-xs text-muted-foreground">{brand.productIds.length} products</p>
      </div>
      <Badge variant="secondary" className={brand.isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>{brand.isEnabled ? "Active" : "Disabled"}</Badge>
      <Switch checked={brand.isEnabled} onCheckedChange={() => onToggle(brand)} />
      <Button variant="ghost" size="icon" onClick={() => onEdit(brand)}><Pencil className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(brand.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
    </div>
  );
}

const BG_COLORS = ["bg-blue-600", "bg-green-600", "bg-purple-600", "bg-red-600", "bg-orange-600", "bg-indigo-600", "bg-teal-600", "bg-pink-600"];

export default function BrandSectionsPage() {
  const token = useAuthStore((s) => s.token);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [preview, setPreview] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", bannerImage: "", bgColor: "bg-blue-600", title: "", description: "", marketingPoints: "", productIds: "" });
  const [saving, setSaving] = useState(false);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchBrands = useCallback(() => {
    fetch(`${API}/admin/brand-sections`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setBrands(d.brands)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = brands.findIndex((b) => b.id === active.id);
    const newIdx = brands.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(brands, oldIdx, newIdx);
    setBrands(reordered);
    await fetch(`${API}/admin/brand-sections/reorder`, { method: "PUT", headers, body: JSON.stringify({ order: reordered.map((b) => b.id) }) });
  };

  const toggleBrand = async (b: Brand) => {
    await fetch(`${API}/admin/brand-sections/${b.id}`, { method: "PUT", headers, body: JSON.stringify({ isEnabled: !b.isEnabled }) });
    fetchBrands();
  };

  const openNew = () => {
    setIsNew(true); setEditing(null);
    setForm({ name: "", slug: "", bannerImage: "", bgColor: "bg-blue-600", title: "", description: "", marketingPoints: "", productIds: "" });
  };

  const openEdit = (b: Brand) => {
    setIsNew(false); setEditing(b);
    setForm({ name: b.name, slug: b.slug, bannerImage: b.bannerImage ?? "", bgColor: b.bgColor, title: b.title ?? "", description: b.description ?? "", marketingPoints: b.marketingPoints.join("\n"), productIds: b.productIds.join(", ") });
  };

  const saveForm = async () => {
    setSaving(true);
    const body = {
      name: form.name, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      bannerImage: form.bannerImage || null, bgColor: form.bgColor, title: form.title || null,
      description: form.description || null,
      marketingPoints: form.marketingPoints.split("\n").filter((l) => l.trim()),
      productIds: form.productIds.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)),
    };
    if (isNew) {
      await fetch(`${API}/admin/brand-sections`, { method: "POST", headers, body: JSON.stringify(body) });
    } else if (editing) {
      await fetch(`${API}/admin/brand-sections/${editing.id}`, { method: "PUT", headers, body: JSON.stringify(body) });
    }
    setSaving(false); setEditing(null); setIsNew(false); fetchBrands();
  };

  const deleteBrand = async (id: number) => {
    if (!confirm("Delete this brand section?")) return;
    await fetch(`${API}/admin/brand-sections/${id}`, { method: "DELETE", headers });
    fetchBrands();
  };

  const showModal = isNew || !!editing;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Sections</h1>
          <p className="text-sm text-muted-foreground">Manage branded product carousels for the homepage</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add Brand</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Brands ({brands.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={brands.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {brands.map((b) => <SortableBrand key={b.id} brand={b} onEdit={openEdit} onDelete={deleteBrand} onToggle={toggleBrand} />)}
            </SortableContext>
          </DndContext>
          {brands.length === 0 && <p className="text-center py-8 text-muted-foreground">No brand sections yet. Add one to get started.</p>}
        </CardContent>
      </Card>
      {preview && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" />Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
              <div className={`${preview.bgColor} rounded-lg p-6 flex flex-col justify-center text-white min-h-[160px]`}>
                <h3 className="text-xl font-bold mb-2">{preview.name}</h3>
                <p className="text-white/80 text-sm mb-4">{preview.description || preview.title || "Explore our collection"}</p>
                <Button variant="outline" className="border-white text-white hover:bg-white/20 w-fit text-sm">Shop {preview.name}<ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="min-w-[160px] rounded-lg border bg-gray-50 p-4 text-center">
                    <div className="w-full h-20 bg-gray-200 rounded mb-2" />
                    <p className="text-xs text-muted-foreground">Product {i}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={showModal} onOpenChange={() => { setEditing(null); setIsNew(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isNew ? "Add Brand Section" : "Edit Brand Section"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" className="mt-1" /></div>
            </div>
            <div><Label>Banner Image URL</Label><Input value={form.bannerImage} onChange={(e) => setForm({ ...form, bannerImage: e.target.value })} placeholder="https://..." className="mt-1" /></div>
            <div>
              <Label>Background Color</Label>
              <div className="flex gap-2 mt-1">
                {BG_COLORS.map((c) => (
                  <button key={c} className={`w-8 h-8 rounded-lg ${c} ${form.bgColor === c ? "ring-2 ring-offset-2 ring-blue-500" : ""}`} onClick={() => setForm({ ...form, bgColor: c })} />
                ))}
              </div>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1" /></div>
            <div><Label>Marketing Points (one per line)</Label><Textarea value={form.marketingPoints} onChange={(e) => setForm({ ...form, marketingPoints: e.target.value })} rows={3} className="mt-1" placeholder="Official partner&#10;Best prices&#10;Instant delivery" /></div>
            <div><Label>Product IDs (comma-separated)</Label><Input value={form.productIds} onChange={(e) => setForm({ ...form, productIds: e.target.value })} placeholder="1, 2, 3" className="mt-1" /></div>
            <Button variant="outline" className="w-full" onClick={() => setPreview({ id: 0, name: form.name, slug: form.slug, bannerImage: form.bannerImage || null, bgColor: form.bgColor, title: form.title || null, description: form.description || null, marketingPoints: form.marketingPoints.split("\n").filter(Boolean), productIds: [], isEnabled: true, sortOrder: 0 })}><Eye className="mr-2 h-4 w-4" />Preview</Button>
          </div>
          <DialogFooter><Button onClick={saveForm} disabled={!form.name || saving}>{saving ? "Saving..." : isNew ? "Create Brand" : "Save Changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
