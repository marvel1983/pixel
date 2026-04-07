import { Link } from "wouter";
import {
  Monitor,
  FileText,
  Shield,
  Gamepad2,
  Server,
  TrendingUp,
  Sparkles,
  Tag,
  BookOpen,
  HelpCircle,
  User,
  LogIn,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { name: "Operating Systems", slug: "operating-systems", icon: Monitor },
  { name: "Office & Productivity", slug: "office-productivity", icon: FileText },
  { name: "Antivirus & Security", slug: "antivirus-security", icon: Shield },
  { name: "Games", slug: "games", icon: Gamepad2 },
  { name: "Servers & Development", slug: "servers-development", icon: Server },
];

const NAV_LINKS = [
  { label: "Best Sellers", href: "/best-sellers", icon: TrendingUp },
  { label: "New Arrivals", href: "/new-arrivals", icon: Sparkles },
  { label: "Deals", href: "/deals", icon: Tag },
  { label: "Blog", href: "/blog", icon: BookOpen },
  { label: "Support", href: "/support", icon: HelpCircle },
];

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto">
          <div className="px-2 pb-2">
            <Link
              href={user ? "/account" : "/login"}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-muted"
            >
              {user ? (
                <>
                  <User className="h-4 w-4 text-primary" />
                  My Account
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 text-primary" />
                  Sign In
                </>
              )}
            </Link>
          </div>

          <Separator />

          <div className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categories
            </p>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-muted"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {cat.name}
                </Link>
              );
            })}
          </div>

          <Separator />

          <div className="p-2">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
