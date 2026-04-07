import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthStore } from "@/stores/auth-store";
import { DEFAULT_PERMS, type Permissions } from "@/pages/admin/admin-users";

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
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteAdminModal({ open, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [perms, setPerms] = useState<Permissions>({ ...DEFAULT_PERMS });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = useAuthStore((s) => s.token);

  const toggle = (key: keyof Permissions) => setPerms((p) => ({ ...p, [key]: !p[key] }));

  const handleSubmit = async () => {
    if (!email.trim()) { setError("Email is required"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/admin/admin-users/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim() || undefined, lastName: lastName.trim() || undefined, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to invite"); return; }
      onSuccess();
      onClose();
      setEmail(""); setFirstName(""); setLastName(""); setPerms({ ...DEFAULT_PERMS });
    } catch { setError("Network error"); } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Admin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
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
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Inviting..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
