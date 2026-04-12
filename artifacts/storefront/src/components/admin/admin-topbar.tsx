import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Menu, Bell, ChevronDown, LogOut, User, ExternalLink } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth-store";

const breadcrumbMap: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/analytics": "Analytics",
  "/admin/products": "Products",
  "/admin/bundles": "Bundles",
  "/admin/categories": "Categories",
  "/admin/platforms": "Platforms",
  "/admin/orders": "Orders",
  "/admin/transactions": "Transactions",
  "/admin/fulfillment": "Fulfillment",
  "/admin/claims": "Claims",
  "/admin/refunds": "Refunds",
  "/admin/flash-sales": "Flash Sales",
  "/admin/discounts": "Discounts",
  "/admin/customers": "Customers",
  "/admin/support": "Support",
  "/admin/newsletter": "Newsletter",
  "/admin/homepage-sections": "Homepage Sections",
  "/admin/blog": "Blog Posts",
  "/admin/pages": "Pages",
  "/admin/email-templates": "Email Templates",
  "/admin/banners": "Banners",
  "/admin/admin-users": "Admin Users",
  "/admin/settings": "Settings",
  "/admin/audit-log": "Audit Log",
  "/admin/system-status": "System Status",
  "/admin/jobs": "Job Queue",
};

function getBreadcrumbs(path: string) {
  const crumbs: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }];
  if (path !== "/admin") {
    crumbs.push({ label: breadcrumbMap[path] ?? path.split("/").pop() ?? "" });
  }
  return crumbs;
}

export function AdminTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [location, setLocation] = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [notifCount] = useState(3);
  const crumbs = getBreadcrumbs(location);
  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "AU"
    : "AU";

  return (
    <header
      className="flex h-10 items-center gap-3 px-4 shrink-0"
      style={{ background: "#13161e", borderBottom: "1px solid #1f2330" }}
    >
      {/* Mobile menu */}
      <button
        className="lg:hidden p-1 rounded transition-colors"
        style={{ color: "#6b7280" }}
        onClick={onMenuClick}
        onMouseEnter={(e) => e.currentTarget.style.color = "#e2e8f0"}
        onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Breadcrumbs */}
      <nav className="hidden sm:flex items-center gap-1 text-[11px]">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span style={{ color: "#2d3344" }}>/</span>}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="transition-colors"
                style={{ color: "#4a5568" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#8b94a8"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#4a5568"}
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-white">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        {/* Store link */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors"
          style={{ color: "#4a5568", background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#1f2330"; e.currentTarget.style.color = "#8b94a8"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a5568"; }}
        >
          <ExternalLink className="h-3 w-3" />
          View Store
        </a>

        {/* Notifications */}
        <button
          className="relative flex h-7 w-7 items-center justify-center rounded transition-colors"
          style={{ color: "#6b7280" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#1f2330"; e.currentTarget.style.color = "#e2e8f0"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6b7280"; }}
        >
          <Bell className="h-3.5 w-3.5" />
          {notifCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
              style={{ background: "#ef4444", color: "white" }}
            >
              {notifCount}
            </span>
          )}
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors"
              style={{ color: "#8b94a8" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#1f2330"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                style={{ background: "#1e2540", color: "#60a5fa" }}
              >
                {initials}
              </div>
              <span className="hidden md:inline text-white">
                {user?.firstName ?? "Admin"}
              </span>
              <ChevronDown className="h-3 w-3" style={{ color: "#4a5568" }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-40 border text-xs"
            style={{ background: "#1a1d28", borderColor: "#2a2d3a", color: "#c8d0e0" }}
          >
            <DropdownMenuItem
              className="text-xs cursor-pointer"
              onClick={() => setLocation("/account")}
              style={{ color: "#c8d0e0" }}
            >
              <User className="mr-2 h-3 w-3" /> My Account
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: "#2a2d3a" }} />
            <DropdownMenuItem
              className="text-xs cursor-pointer"
              style={{ color: "#ef4444" }}
              onClick={() => { logout(); setLocation("/login"); }}
            >
              <LogOut className="mr-2 h-3 w-3" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
