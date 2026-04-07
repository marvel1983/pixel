import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  LayoutGrid,
  GitCompareArrows,
  Heart,
  ShoppingCart,
  User,
  Menu,
  LogOut,
  Package,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCompareStore } from "@/stores/compare-store";
import { useAuthStore } from "@/stores/auth-store";
import { CurrencySelector } from "./currency-selector";
import { LanguageSelector } from "../shop/language-selector";
import { CartDrawer } from "./cart-drawer";
import { MobileDrawer } from "./mobile-drawer";
import { CategoriesDropdown } from "./categories-dropdown";

const NAV_KEYS = [
  { key: "nav.bestSellers", href: "/best-sellers" },
  { key: "nav.bundles", href: "/bundles" },
  { key: "nav.newArrivals", href: "/new-arrivals" },
  { key: "nav.deals", href: "/deals" },
  { key: "nav.blog", href: "/blog" },
  { key: "nav.support", href: "/support" },
];

export function NavBar() {
  const { t } = useTranslation();
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const itemCount = useCartStore((s) => s.getItemCount());
  const wishCount = useWishlistStore((s) => s.productIds.length);
  const compareCount = useCompareStore((s) => s.productIds.length);

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 flex items-center h-12">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-primary-foreground mr-2"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative hidden lg:block">
            <Button
              variant="ghost"
              className="text-primary-foreground gap-2 font-semibold"
              onClick={() => setCatOpen(!catOpen)}
            >
              <LayoutGrid className="h-4 w-4" />
              {t("nav.allCategories")}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {catOpen && (
              <CategoriesDropdown onClose={() => setCatOpen(false)} />
            )}
          </div>

          <div className="hidden lg:flex items-center gap-1 ml-2">
            {NAV_KEYS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground/90 hover:text-primary-foreground"
                >
                  {t(link.key)}
                </Button>
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <LanguageSelector />
            <CurrencySelector />

            <Link href="/compare">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-primary-foreground"
              >
                <GitCompareArrows className="h-5 w-5" />
                {compareCount > 0 && <NavBadge count={compareCount} />}
              </Button>
            </Link>

            <Link href="/wishlist">
              <Button
                variant="ghost"
                size="icon"
                className="relative text-primary-foreground"
              >
                <Heart className="h-5 w-5" />
                {wishCount > 0 && <NavBadge count={wishCount} />}
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="relative text-primary-foreground"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && <NavBadge count={itemCount} />}
            </Button>

            <UserMenu />
          </div>
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function UserMenu() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="ghost" size="icon" className="text-primary-foreground">
          <User className="h-5 w-5" />
        </Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-primary-foreground">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.firstName ?? user.email}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <Link href="/account">
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />{t("nav.myAccount")}
          </DropdownMenuItem>
        </Link>
        <Link href="/account/orders">
          <DropdownMenuItem>
            <Package className="mr-2 h-4 w-4" />{t("nav.myOrders")}
          </DropdownMenuItem>
        </Link>
        <Link href="/account">
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />{t("nav.settings")}
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />{t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}
