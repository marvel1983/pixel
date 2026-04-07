import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GripVertical, Pencil, Layout, Image, ShoppingBag, Sparkles, Star, Type, Package } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Section { id: number; type: string; title: string | null; isEnabled: boolean; sortOrder: number; config: Record<string, unknown> }

const SECTION_ICONS: Record<string, typeof Layout> = {
  HERO_SLIDER: Image, CATEGORY_ROW: Layout, BRAND_SECTIONS: ShoppingBag,
  NEW_ADDITIONS: Sparkles, PRODUCT_SPOTLIGHT: Star, FEATURED_TEXT_BANNER: Type,
  FEATURED_BUNDLES: Package,
};

const SECTION_LABELS: Record<string, string> = {
  HERO_SLIDER: "Hero Slider", CATEGORY_ROW: "Category Row", BRAND_SECTIONS: "Brand Partners",
  NEW_ADDITIONS: "New Additions", PRODUCT_SPOTLIGHT: "Product Spotlight", FEATURED_TEXT_BANNER: "Featured Text Banner",
  FEATURED_BUNDLES: "Featured Bundles",
};

function SortableItem({ section, onEdit, onToggle }: { section: Section; onEdit: (s: Section) => void; onToggle: (s: Section) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = SECTION_ICONS[section.type] ?? Layout;
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 rounded-lg border bg-white p-3">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground"><GripVertical className="h-5 w-5" /></button>
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{section.title || SECTION_LABELS[section.type]}</p>
        <Badge variant="secondary" className="text-xs mt-0.5">{section.type}</Badge>
      </div>
      <Switch checked={section.isEnabled} onCheckedChange={() => onToggle(section)} />
      <Button variant="ghost" size="icon" onClick={() => onEdit(section)}><Pencil className="h-4 w-4" /></Button>
    </div>
  );
}

export default function HomepageSectionsPage() {
  const token = useAuthStore((s) => s.token);
  const [sections, setSections] = useState<Section[]>([]);
  const [editing, setEditing] = useState<Section | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchSections = useCallback(() => {
    fetch(`${API}/admin/homepage-sections`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setSections(d.sections)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sections.findIndex((s) => s.id === active.id);
    const newIdx = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIdx, newIdx);
    setSections(reordered);
    await fetch(`${API}/admin/homepage-sections/reorder`, { method: "PUT", headers, body: JSON.stringify({ order: reordered.map((s) => s.id) }) });
  };

  const toggleSection = async (s: Section) => {
    await fetch(`${API}/admin/homepage-sections/${s.id}`, { method: "PUT", headers, body: JSON.stringify({ isEnabled: !s.isEnabled }) });
    fetchSections();
  };

  const openEdit = (s: Section) => {
    setEditing(s); setEditTitle(s.title ?? "");
    const cfg = s.config ?? {};
    setEditConfig(Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, String(v ?? "")])));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const config: Record<string, unknown> = {};
    Object.entries(editConfig).forEach(([k, v]) => { config[k] = isNaN(Number(v)) || v === "" ? v : Number(v); });
    await fetch(`${API}/admin/homepage-sections/${editing.id}`, { method: "PUT", headers, body: JSON.stringify({ title: editTitle, config }) });
    setSaving(false); setEditing(null); fetchSections();
  };

  const configFields = (type: string): string[] => {
    switch (type) {
      case "NEW_ADDITIONS": return ["limit"];
      case "FEATURED_TEXT_BANNER": return ["text", "link", "buttonText"];
      case "PRODUCT_SPOTLIGHT": return ["productId", "heading"];
      case "HERO_SLIDER": return ["autoplaySpeed", "maxSlides"];
      case "CATEGORY_ROW": return ["maxCategories"];
      case "FEATURED_BUNDLES": return ["limit"];
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Homepage Sections</h1>
        <p className="text-sm text-muted-foreground">Drag to reorder sections. Toggle visibility with the switch.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Section Order</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((s) => <SortableItem key={s.id} section={s} onEdit={openEdit} onToggle={toggleSection} />)}
            </SortableContext>
          </DndContext>
          {sections.length === 0 && <p className="text-center py-8 text-muted-foreground">Loading sections...</p>}
        </CardContent>
      </Card>
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit {editing ? SECTION_LABELS[editing.type] : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Display Title</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" /></div>
            {editing && configFields(editing.type).map((field) => (
              <div key={field}>
                <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input value={editConfig[field] ?? ""} onChange={(e) => setEditConfig({ ...editConfig, [field]: e.target.value })} className="mt-1" />
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
