import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/stores/auth-store";
import { DEFAULT_PERMS, type Permissions, type AdminUser } from "@/pages/admin/admin-users";

const API = import.meta.env.VITE_API_URL ?? "/api";

const PERM_LABELS: { key: keyof Permissions; label: string; desc: string }[] = [
  { key: "manageProducts", label: "Manage Products", desc: "Add, edit, delete products and categories" },
  { key: "manageOrders", label: "Manage Orders", desc: "View and manage customer orders" },
  { key: "manageCustomers", label: "Manage Customers", desc: "View and edit customer accounts" },
  { key: "manageDiscounts", label: "Manage Discounts", desc: "Create and manage coupons and promotions" },
  { key: "manageContent", label: "Manage Content", desc: "Edit pages, banners, and homepage" },
  { key: "manageSettings", label: "Manage Settings", desc: "Configure store settings and tax" },
  { key: "manageAdmins", label: "Manage Admins", desc: "Invite and manage other admin users" },
  { key: "viewAnalytics", label: "View Analytics", desc: "Access dashboard and analytics data" },
];

interface Props {
  user: AdminUser;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditPermissionsModal({ user, onClose, onSuccess }: Props) {
  const initPerms: Permissions = user.permissions || { ...DEFAULT_PERMS };
  const [perms, setPerms] = useState<Permissions>({ ...initPerms });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = useAuthStore((s) => s.token);

  const toggle = (key: keyof Permissions) => setPerms((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/admin-users/${user.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to update"); return; }
      onSuccess();
      onClose();
    } catch { setError("Network error"); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Permissions — {user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {PERM_LABELS.map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={perms[key]} onCheckedChange={() => toggle(key)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
