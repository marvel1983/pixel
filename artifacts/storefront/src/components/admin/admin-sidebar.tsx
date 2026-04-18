import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Layout, Package, Tags, Layers,
  ShoppingCart, ShoppingBag, Mail, Receipt, Users,
  FileText, Image, Settings, Shield, ShieldCheck,
  Bell, BarChart3, Truck, Flag, Ticket, MessageSquare,
  HelpCircle, ClipboardList, Wallet, Gift, Globe,
  Link2, Zap, BookOpen, ListTodo, Activity, ArrowLeft, Tag, Sliders, RefreshCw,
  ChevronDown, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface NavItem { label: string; href: string; icon: LucideIcon; badgeKey?: string; }
interface NavSection { title: string; items: NavItem[]; }

const sections: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard",  href: "/admin",           icon: LayoutDashboard },
      { label: "Analytics",  href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "CATALOGUE",
    items: [
      { label: "Products",        href: "/admin/products",        icon: Package },
      { label: "Metenzi Catalog", href: "/admin/metenzi-catalog", icon: RefreshCw },
      { label: "Bundles",         href: "/admin/bundles",         icon: Package },
      { label: "Categories",      href: "/admin/categories",      icon: Tags },
      { label: "Platforms",       href: "/admin/platforms",       icon: Layers },
      { label: "Reviews",         href: "/admin/reviews",         icon: MessageSquare },
      { label: "Q&A",             href: "/admin/qa",              icon: HelpCircle, badgeKey: "pendingQA" },
      { label: "Attributes",      href: "/admin/attributes",      icon: Sliders },
      { label: "Tags",            href: "/admin/tags",            icon: Tag },
    ],
  },
  {
    title: "SALES",
    items: [
      { label: "Orders",            href: "/admin/orders",                   icon: ShoppingCart },
      { label: "Transactions",      href: "/admin/transactions",             icon: Receipt },
      { label: "Fulfillment",       href: "/admin/fulfillment",              icon: Truck },
      { label: "Claims",            href: "/admin/claims",                   icon: Flag },
      { label: "Refunds",           href: "/admin/refunds",                  icon: Wallet },
      { label: "Flash Sales",       href: "/admin/flash-sales",              icon: Zap },
      { label: "Price Rules",       href: "/admin/price-rules",              icon: Tag },
      { label: "Discounts",         href: "/admin/discounts",                icon: Ticket },
      { label: "Checkout Upsell",   href: "/admin/checkout-upsell",         icon: Gift },
      { label: "Checkout Services", href: "/admin/checkout-services",       icon: ShieldCheck },
      { label: "Gift Cards",        href: "/admin/gift-cards",               icon: Gift },
      { label: "Affiliates",        href: "/admin/affiliates",               icon: Link2 },
      { label: "Affiliate Settings",href: "/admin/affiliate-settings",      icon: Settings },
      { label: "Abandoned Carts",   href: "/admin/abandoned-carts",         icon: ShoppingCart },
      { label: "Cart Recovery",     href: "/admin/abandoned-cart-settings", icon: Settings },
      { label: "Quotes",            href: "/admin/quotes",                   icon: ClipboardList },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { label: "Customers",     href: "/admin/customers",     icon: Users },
      { label: "User Import",   href: "/admin/user-imports",  icon: ClipboardList },
      { label: "Surveys",       href: "/admin/surveys",       icon: BarChart3 },
      { label: "Support",       href: "/admin/support",       icon: HelpCircle },
      { label: "Newsletter",    href: "/admin/newsletter",    icon: Mail },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
  {
    title: "CONTENT",
    items: [
      { label: "Homepage",        href: "/admin/homepage-sections", icon: Layout },
      { label: "Brand Sections",  href: "/admin/brand-sections",   icon: ShoppingBag },
      { label: "Blog Posts",      href: "/admin/blog",             icon: BookOpen },
      { label: "Blog Categories", href: "/admin/blog/categories",  icon: Tags },
      { label: "Pages",           href: "/admin/pages",            icon: FileText },
      { label: "FAQ Editor",      href: "/admin/pages/faq",        icon: HelpCircle },
      { label: "Email Templates", href: "/admin/email-templates",  icon: Mail },
      { label: "Banners",         href: "/admin/banners",          icon: Image },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Admin Users",     href: "/admin/admin-users",    icon: Shield },
      { label: "Tax / VAT",       href: "/admin/tax-settings",   icon: Receipt },
      { label: "Languages",       href: "/admin/i18n",           icon: Globe },
      { label: "Settings",        href: "/admin/settings",       icon: Settings },
      { label: "Audit Log",       href: "/admin/audit-log",      icon: ClipboardList },
      { label: "Metenzi Balance", href: "/admin/metenzi-balance",icon: Wallet },
      { label: "Job Queue",       href: "/admin/jobs",           icon: ListTodo },
      { label: "System Status",   href: "/admin/system-status",  icon: Activity },
    ],
  },
];

const STORAGE_KEY = "admin-sidebar-open";

function isActive(current: string, href: string) {
  if (href === "/admin") return current === "/admin";
  return current.startsWith(href);
}

function getSectionForPath(path: string): string | null {
  for (const section of sections) {
    if (section.items.some((item) => isActive(path, item.href))) return section.title;
  }
  return null;
}

function loadOpenSections(activeSection: string | null): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
    // Always open the active section
    if (activeSection) parsed[activeSection] = true;
    return parsed;
  } catch {
    return activeSection ? { [activeSection]: true } : {};
  }
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const token = useAuthStore((s) => s.token);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    loadOpenSections(getSectionForPath(location)),
  );

  // Auto-open the section containing the current route
  useEffect(() => {
    const active = getSectionForPath(location);
    if (active) {
      setOpen((prev) => {
        if (prev[active]) return prev;
        return { ...prev, [active]: true };
      });
    }
  }, [location]);

  // Persist open state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(open)); } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/admin/qa/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setBadges((p) => ({ ...p, pendingQA: data.pending ?? 0 })); })
      .catch(() => {});
  }, [token]);

  function toggleSection(title: string) {
    setOpen((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "#13161e", borderRight: "1px solid #1f2330" }}>
      {/* Logo */}
      <div className="flex h-10 items-center px-3 shrink-0" style={{ borderBottom: "1px solid #1f2330" }}>
        <Link href="/admin" className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded text-white text-[10px] font-black"
            style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}
          >
            PC
          </div>
          <span className="text-sm font-bold text-white">PixelCodes</span>
          <span
            className="ml-1 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: "#1f2330", color: "#6b7280" }}
          >
            Admin
          </span>
        </Link>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1">
        <nav className="px-2 py-2">
          {sections.map((section) => {
            const isOpen = open[section.title] ?? false;
            const hasActive = section.items.some((item) => isActive(location, item.href));

            return (
              <div key={section.title} className="mb-1">
                {/* Section header — clickable */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="flex w-full items-center justify-between rounded px-2 py-[5px] mb-0.5 transition-colors"
                  style={{ color: hasActive ? "#93c5fd" : "#566070" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = hasActive ? "#93c5fd" : "#566070"; }}
                >
                  <span className="text-[10px] font-bold tracking-widest">{section.title}</span>
                  {isOpen
                    ? <ChevronDown className="h-3 w-3 shrink-0" />
                    : <ChevronRight className="h-3 w-3 shrink-0" />
                  }
                </button>

                {/* Items */}
                {isOpen && section.items.map((item) => {
                  const active = isActive(location, item.href);
                  const badge = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className="flex items-center gap-2 rounded px-2 py-[5px] text-[12px] font-medium transition-colors mb-px"
                      style={{
                        background: active ? "#1e2a4a" : "transparent",
                        color: active ? "#93c5fd" : "#d1d8e8",
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "#1c2030"; e.currentTarget.style.color = "#ffffff"; } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#d1d8e8"; } }}
                    >
                      <item.icon
                        className="h-3.5 w-3.5 shrink-0 ml-1"
                        style={{ color: active ? "#93c5fd" : "#7a8aaa" }}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span
                          className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                          style={{ background: "#ef4444", color: "white" }}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Back to store */}
      <div className="px-2 py-2 shrink-0" style={{ borderTop: "1px solid #1f2330" }}>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded px-2 py-[5px] text-[11px] transition-colors"
          style={{ color: "#7a8aaa" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#7a8aaa"; }}
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Store
        </a>
      </div>
    </div>
  );
}
