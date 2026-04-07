import { useLocation, Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Layout,
  Package,
  Tags,
  Layers,
  ShoppingCart,
  ShoppingBag,
  Mail,
  Receipt,
  Users,
  FileText,
  Image,
  Settings,
  Shield,
  Bell,
  BarChart3,
  Truck,
  Flag,
  Ticket,
  MessageSquare,
  HelpCircle,
  ClipboardList,
  Wallet,
  Gift,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "CATALOGUE",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Categories", href: "/admin/categories", icon: Tags },
      { label: "Platforms", href: "/admin/platforms", icon: Layers },
      { label: "Reviews", href: "/admin/reviews", icon: MessageSquare },
    ],
  },
  {
    title: "SALES",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { label: "Transactions", href: "/admin/transactions", icon: Receipt },
      { label: "Fulfillment", href: "/admin/fulfillment", icon: Truck },
      { label: "Claims", href: "/admin/claims", icon: Flag },
      { label: "Refunds", href: "/admin/refunds", icon: Wallet },
      { label: "Discounts", href: "/admin/discounts", icon: Ticket },
      { label: "Checkout Upsell", href: "/admin/checkout-upsell", icon: Gift },
      { label: "Gift Cards", href: "/admin/gift-cards", icon: Gift },
      { label: "Affiliates", href: "/admin/affiliates", icon: Link2 },
      { label: "Affiliate Settings", href: "/admin/affiliate-settings", icon: Settings },
    ],
  },
  {
    title: "CUSTOMERS",
    items: [
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
  {
    title: "CONTENT",
    items: [
      { label: "Homepage Sections", href: "/admin/homepage-sections", icon: Layout },
      { label: "Brand Sections", href: "/admin/brand-sections", icon: ShoppingBag },
      { label: "Pages", href: "/admin/pages", icon: FileText },
      { label: "FAQ Editor", href: "/admin/pages/faq", icon: HelpCircle },
      { label: "Email Templates", href: "/admin/email-templates", icon: Mail },
      { label: "Banners", href: "/admin/banners", icon: Image },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Admin Users", href: "/admin/admin-users", icon: Shield },
      { label: "Tax / VAT", href: "/admin/tax-settings", icon: Receipt },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Audit Log", href: "/admin/audit-log", icon: ClipboardList },
      { label: "Metenzi Balance", href: "/admin/metenzi-balance", icon: Wallet },
    ],
  },
];

function isActive(current: string, href: string): boolean {
  if (href === "/admin") return current === "/admin";
  return current.startsWith(href);
}

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const [location] = useLocation();

  return (
    <div className="flex h-full flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
            PC
          </div>
          <span>PixelCodes</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-4 px-2">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(location, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                      )}
                    >
                      <item.icon className={cn("h-4 w-4", active ? "text-blue-700" : "text-gray-400")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          ← Back to Store
        </Link>
      </div>
    </div>
  );
}
