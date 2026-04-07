import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  LayoutGrid,
  GitCompareArrows,
  Heart,
  ShoppingCart,
  User,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCompareStore } from "@/stores/compare-store";
import { useAuthStore } from "@/stores/auth-store";
import { CurrencySelector } from "./currency-selector";
import { CartDrawer } from "./cart-drawer";
import { MobileDrawer } from "./mobile-drawer";
import { CategoriesDropdown } from "./categories-dropdown";

const NAV_LINKS = [
  { label: "Best Sellers", href: "/best-sellers" },
  { label: "New Arrivals", href: "/new-arrivals" },
  { label: "Deals", href: "/deals" },
  { label: "Blog", href: "/blog" },
  { label: "Support", href: "/support" },
];

export function NavBar() {
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const itemCount = useCartStore((s) => s.getItemCount());
  const wishCount = useWishlistStore((s) => s.productIds.length);
  const compareCount = useCompareStore((s) => s.productIds.length);
  const user = useAuthStore((s) => s.user);

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
              All Categories
              <ChevronDown className="h-3 w-3" />
            </Button>
            {catOpen && (
              <CategoriesDropdown onClose={() => setCatOpen(false)} />
            )}
          </div>

          <div className="hidden lg:flex items-center gap-1 ml-2">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground/90 hover:text-primary-foreground"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
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

            <Link href={user ? "/account" : "/login"}>
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground"
              >
                <User className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}
