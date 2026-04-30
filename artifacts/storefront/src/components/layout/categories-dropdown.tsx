import { useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  ChevronRight,
  Monitor, FileText, Shield, Gamepad2, Server,
  Wifi, Palette, GraduationCap, Package, Wrench, BarChart3,
} from "lucide-react";

const CATEGORIES = [
  { name: "Operating Systems",     slug: "operating-systems",   icon: Monitor,        hot: false },
  { name: "Office & Productivity", slug: "office-productivity", icon: FileText,       hot: false },
  { name: "Antivirus & Security",  slug: "antivirus-security",  icon: Shield,         hot: true  },
  { name: "PC Games",              slug: "games",               icon: Gamepad2,       hot: true  },
  { name: "Servers & Development", slug: "servers-development", icon: Server,         hot: false },
  { name: "VPN & Privacy",         slug: "vpn-privacy",         icon: Wifi,           hot: false },
  { name: "Design & Creative",     slug: "design-creative",     icon: Palette,        hot: false },
  { name: "Education",             slug: "education",           icon: GraduationCap,  hot: false },
  { name: "Business Software",     slug: "business",            icon: BarChart3,      hot: false },
  { name: "Utilities & Tools",     slug: "utilities",           icon: Wrench,         hot: false },
  { name: "Software Bundles",      slug: "bundles",             icon: Package,        hot: true  },
];

interface CategoriesDropdownProps {
  onClose: () => void;
}

export function CategoriesDropdown({ onClose }: CategoriesDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 w-72 z-[200] flex flex-col rounded-xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-primary shrink-0">
        <div className="grid grid-cols-2 gap-0.5 w-4 h-4 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[1px] bg-primary-foreground/80" />
          ))}
        </div>
        <span className="text-sm font-bold text-primary-foreground tracking-wide">All Categories</span>
      </div>

      <div className="flex flex-col divide-y divide-border/50">
        {CATEGORIES.map(({ name, slug, icon: Icon, hot }) => (
          <Link
            key={slug}
            href={`/category/${slug}`}
            onClick={onClose}
            className="group flex items-center gap-3 px-4 py-[9px] text-sm text-foreground hover:bg-primary/5 hover:text-primary transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="flex-1 leading-tight font-medium">{name}</span>
            {hot && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/20 leading-none">
                Hot
              </span>
            )}
            <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      <Link
        href="/shop"
        onClick={onClose}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 border-t border-border transition-colors shrink-0"
      >
        View all categories
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
