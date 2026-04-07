import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldCheck, UserPlus, Pencil, Trash2, Package, ShoppingCart, Users, Tag, FileText, Settings, BarChart3, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { InviteAdminModal } from "@/components/admin/invite-admin-modal";
import { EditPermissionsModal } from "@/components/admin/edit-permissions-modal";

const API = import.meta.env.VITE_API_URL ?? "/api";

export interface Permissions {
  manageProducts: boolean; manageOrders: boolean; manageCustomers: boolean;
  manageDiscounts: boolean; manageContent: boolean; manageSettings: boolean;
  manageAdmins: boolean; viewAnalytics: boolean;
}

export interface AdminUser {
  id: number; email: string; firstName: string | null; lastName: string | null;
  role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string;
  permissions: Permissions | null;
}

const PERM_ICONS: { key: keyof Permissions; icon: typeof Package; label: string }[] = [
  { key: "manageProducts", icon: Package, label: "Products" },
  { key: "manageOrders", icon: ShoppingCart, label: "Orders" },
  { key: "manageCustomers", icon: Users, label: "Customers" },
  { key: "manageDiscounts", icon: Tag, label: "Discounts" },
  { key: "manageContent", icon: FileText, label: "Content" },
  { key: "manageSettings", icon: Settings, label: "Settings" },
  { key: "manageAdmins", icon: UserCog, label: "Admins" },
  { key: "viewAnalytics", icon: BarChart3, label: "Analytics" },
];

export const DEFAULT_PERMS: Permissions = {
  manageProducts: true, manageOrders: true, manageCustomers: false,
  manageDiscounts: true, manageContent: false, manageSettings: false,
  manageAdmins: false, viewAnalytics: true,
};

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const fetchAdmins = useCallback(() => {
    setLoading(true);
    fetch(`${API}/admin/admin-users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAdmins(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleRevoke = async (user: AdminUser) => {
    if (!confirm(`Revoke admin access for ${user.email}?`)) return;
    await fetch(`${API}/admin/admin-users/${user.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    fetchAdmins();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-muted-foreground">Manage administrator accounts and permissions</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite Admin
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">User</th>
            <th className="px-4 py-3 text-left font-medium">Role</th>
            <th className="px-4 py-3 text-left font-medium">Permissions</th>
            <th className="px-4 py-3 text-left font-medium">Last Login</th>
            {isSuperAdmin && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b"><td colSpan={5} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
            )) : admins.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{a.firstName || ""} {a.lastName || ""}</div>
                  <div className="text-muted-foreground text-xs">{a.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={a.role === "SUPER_ADMIN" ? "default" : "secondary"} className={a.role === "SUPER_ADMIN" ? "bg-purple-600" : ""}>
                    {a.role === "SUPER_ADMIN" ? <ShieldCheck className="mr-1 h-3 w-3" /> : <Shield className="mr-1 h-3 w-3" />}
                    {a.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {a.role === "SUPER_ADMIN" ? (
                    <span className="text-xs text-muted-foreground">All permissions</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {PERM_ICONS.map(({ key, icon: Icon, label }) => (
                        <span key={key} title={label} className={`inline-flex items-center justify-center w-6 h-6 rounded ${a.permissions?.[key] ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-300"}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : "Never"}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3 text-right">
                    {a.role !== "SUPER_ADMIN" && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditUser(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleRevoke(a)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!loading && admins.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No admin users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <InviteAdminModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSuccess={fetchAdmins} />
      {editUser && <EditPermissionsModal user={editUser} onClose={() => setEditUser(null)} onSuccess={fetchAdmins} />}
    </div>
  );
}
