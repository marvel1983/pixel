import { Pencil, X, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
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

interface RowProps {
  cat: AdminCategory;
  isEditing: boolean;
  editState: EditState | null;
  allCats: AdminCategory[];
  saving: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onEditChange: (updates: Partial<EditState>) => void;
}

export function CategoryRow({ cat, isEditing, editState, allCats, saving, onStartEdit, onCancel, onSave, onToggle, onDelete, onEditChange }: RowProps) {
  if (!isEditing) {
    return (
      <tr className="border-b last:border-0 hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {cat.imageUrl && <img src={cat.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />}
            <span className="font-medium">{cat.name}</span>
          </div>
        </td>
        <td className="px-4 py-3"><Badge variant="secondary">{cat.productCount}</Badge></td>
        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{cat.slug}</td>
        <td className="px-4 py-3 text-muted-foreground">{cat.sortOrder}</td>
        <td className="px-4 py-3"><Switch checked={cat.isActive} onCheckedChange={onToggle} /></td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button onClick={onStartEdit} className="p-1 rounded hover:bg-gray-200">
              <Pencil className="h-4 w-4 text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-100"
              title={cat.productCount > 0 ? "Cannot delete: has products" : "Delete"}>
              <Trash2 className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  if (!editState) return null;

  return (
    <>
      <tr className="border-b bg-blue-50/50">
        <td className="px-4 py-3">
          <input className="w-full rounded-md border px-2 py-1.5 text-sm" value={editState.name}
            onChange={(e) => onEditChange({ name: e.target.value })} />
        </td>
        <td className="px-4 py-3"><Badge variant="secondary">{cat.productCount}</Badge></td>
        <td className="px-4 py-3">
          <input className="w-full rounded-md border px-2 py-1.5 text-sm font-mono" value={editState.slug}
            onChange={(e) => onEditChange({ slug: e.target.value })} />
        </td>
        <td className="px-4 py-3">
          <input type="number" className="w-16 rounded-md border px-2 py-1.5 text-sm" value={editState.sortOrder}
            onChange={(e) => onEditChange({ sortOrder: Number(e.target.value) })} />
        </td>
        <td className="px-4 py-3">
          <Switch checked={editState.isActive} onCheckedChange={(v) => onEditChange({ isActive: v })} />
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button onClick={onSave} disabled={saving} className="p-1 rounded hover:bg-green-100">
              <Check className="h-4 w-4 text-green-600" />
            </button>
            <button onClick={onCancel} className="p-1 rounded hover:bg-gray-200">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </td>
      </tr>
      <tr className="border-b bg-blue-50/30">
        <td colSpan={6} className="px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <textarea className="w-full rounded-md border px-2 py-1.5 text-sm" rows={2}
                value={editState.description} onChange={(e) => onEditChange({ description: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Image URL</label>
              <input className="w-full rounded-md border px-2 py-1.5 text-sm" value={editState.imageUrl}
                onChange={(e) => onEditChange({ imageUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Parent Category</label>
              <select className="w-full rounded-md border px-2 py-1.5 text-sm" value={editState.parentId ?? ""}
                onChange={(e) => onEditChange({ parentId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None (top-level)</option>
                {allCats.filter((c) => c.id !== cat.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
