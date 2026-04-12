import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ShoppingCart, ArrowRight, Tag, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_LINKS = [
  { label: "Windows & Office", href: "/category/operating-systems" },
  { label: "Antivirus", href: "/category/antivirus-security" },
  { label: "PC Games", href: "/category/games" },
  { label: "View all deals", href: "/deals" },
];

export function EmptyCart() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-full bg-primary/8 border-2 border-primary/15 flex items-center justify-center">
          <ShoppingCart className="h-10 w-10 text-primary/60" strokeWidth={1.5} />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
          <span className="text-xs font-bold text-muted-foreground">0</span>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        {t("cart.empty")}
      </h2>
      <p className="text-muted-foreground text-sm mb-8 max-w-sm leading-relaxed">
        {t("cart.emptyDesc")}
      </p>

      <Link href="/shop">
        <Button size="lg" className="gap-2 mb-8">
          {t("cart.returnToShop")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>

      {/* Quick links */}
      <div className="w-full max-w-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Popular categories</p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer group">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{link.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Promo strip */}
      <div className="mt-8 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" /> Use code <strong className="text-foreground">SAVE10</strong> for 10% off</span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Instant key delivery</span>
      </div>
    </div>
  );
}
