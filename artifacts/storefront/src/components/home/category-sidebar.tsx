import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  ChevronRight, ChevronDown,
  Monitor, FileText, Shield, Gamepad2, Server,
  Wifi, Palette, GraduationCap, Package, Wrench, BarChart3,
} from "lucide-react";

const CATEGORIES = [
  { name: "Operating Systems",   slug: "operating-systems",  icon: Monitor,        hot: false, desc: "Windows, Linux & more" },
  { name: "Office & Productivity", slug: "office-productivity", icon: FileText,      hot: false, desc: "Microsoft Office & suites" },
  { name: "Antivirus & Security",  slug: "antivirus-security",  icon: Shield,        hot: true,  desc: "Norton, Kaspersky, Bitdefender" },
  { name: "PC Games",              slug: "games",               icon: Gamepad2,      hot: true,  desc: "Steam, Epic, Ubisoft keys" },
  { name: "Servers & Development", slug: "servers-development", icon: Server,        hot: false, desc: "Server OS & dev tools" },
  { name: "VPN & Privacy",         slug: "vpn-privacy",         icon: Wifi,          hot: false, desc: "Stay private online" },
  { name: "Design & Creative",     slug: "design-creative",     icon: Palette,       hot: false, desc: "Adobe & creative apps" },
  { name: "Education",             slug: "education",           icon: GraduationCap, hot: false, desc: "Student & academic licenses" },
  { name: "Business Software",     slug: "business",            icon: BarChart3,     hot: false, desc: "CRM, ERP & office suites" },
  { name: "Utilities & Tools",     slug: "utilities",           icon: Wrench,        hot: false, desc: "System tools & cleaners" },
  { name: "Software Bundles",      slug: "bundles",             icon: Package,       hot: true,  desc: "Save more, buy together" },
];

export function CategorySidebar() {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [expanded]);

  return (
    <div ref={panelRef} className="relative hidden lg:flex flex-col rounded-xl border border-border bg-card overflow-visible" style={{ height: 360 }}>

      {/* ── Expanded all-categories panel ──────────────────── */}
      {expanded && (
        <div className="absolute top-0 left-[calc(100%+8px)] z-50 w-[440px] rounded-xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <span className="text-sm font-bold text-foreground">All Categories</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕ Close
            </button>
          </div>

          {/* Grid of all categories */}
          <div className="grid grid-cols-2 gap-px bg-border">
            {CATEGORIES.map(({ name, slug, icon: Icon, hot, desc }) => (
              <Link
                key={slug}
                href={`/category/${slug}`}
                onClick={() => setExpanded(false)}
                className="group flex items-center gap-3 bg-card px-4 py-3 hover:bg-primary/5 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 border border-primary/15 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                      {name}
                    </span>
                    {hot && (
                      <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-red-500/15 text-red-500 leading-none">
                        Hot
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border bg-muted/30">
            <Link
              href="/shop"
              onClick={() => setExpanded(false)}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Browse all software <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Sidebar header ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-primary rounded-t-xl shrink-0">
        <div className="grid grid-cols-2 gap-0.5 w-4 h-4 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[1px] bg-primary-foreground/80" />
          ))}
        </div>
        <span className="text-sm font-bold text-primary-foreground tracking-wide">All Categories</span>
      </div>

      {/* ── Category list ────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col divide-y divide-border/50 overflow-hidden">
        {CATEGORIES.map(({ name, slug, icon: Icon, hot }) => (
          <Link
            key={slug}
            href={`/category/${slug}`}
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

      {/* ── Footer toggle ────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 border-t border-border transition-colors rounded-b-xl"
      >
        View all categories
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}
