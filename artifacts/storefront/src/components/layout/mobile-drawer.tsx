import { Link } from "wouter";
import { useTranslation } from "react-i18next";
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
  { nameKey: "categories.operatingSystems", slug: "operating-systems", icon: Monitor },
  { nameKey: "categories.officeProductivity", slug: "office-productivity", icon: FileText },
  { nameKey: "categories.antivirusSecurity", slug: "antivirus-security", icon: Shield },
  { nameKey: "categories.games", slug: "games", icon: Gamepad2 },
  { nameKey: "categories.serversDevelopment", slug: "servers-development", icon: Server },
];

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const navLinks = [
    { label: t("nav.bestSellers"), href: "/best-sellers", icon: TrendingUp },
    { label: t("nav.newArrivals"), href: "/new-arrivals", icon: Sparkles },
    { label: t("nav.deals"), href: "/deals", icon: Tag },
    { label: t("nav.blog"), href: "/blog", icon: BookOpen },
    { label: t("nav.support"), href: "/support", icon: HelpCircle },
  ];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="text-left">{t("common.menu")}</SheetTitle>
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
                  {t("nav.myAccount")}
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 text-primary" />
                  {t("auth.signIn")}
                </>
              )}
            </Link>
          </div>

          <Separator />

          <div className="p-2">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("nav.allCategories")}
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
                  {t(cat.nameKey)}
                </Link>
              );
            })}
          </div>

          <Separator />

          <div className="p-2">
            {navLinks.map((link) => {
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
