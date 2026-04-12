import type { ReactElement } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

/* ── Inline SVG brand logos ──────────────────────────────── */

function LogoMicrosoft() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect x="2"  y="2"  width="19" height="19" fill="#F25022"/>
      <rect x="23" y="2"  width="19" height="19" fill="#7FBA00"/>
      <rect x="2"  y="23" width="19" height="19" fill="#00A4EF"/>
      <rect x="23" y="23" width="19" height="19" fill="#FFB900"/>
    </svg>
  );
}

function LogoKaspersky() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="20" fill="#006D5B"/>
      {/* Stylised K */}
      <rect x="14" y="11" width="4" height="22" rx="1" fill="white"/>
      <path d="M18 22 L28 11 L32 11 L22 22 L32 33 L28 33 Z" fill="white"/>
    </svg>
  );
}

function LogoNorton() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <circle cx="22" cy="22" r="20" fill="#FFD100"/>
      {/* Shield */}
      <path d="M22 8 L34 13 L34 24 C34 31 28 37 22 39 C16 37 10 31 10 24 L10 13 Z" fill="#1A1A1A"/>
      {/* N letter */}
      <path d="M15 17 L15 29 L18 29 L18 21 L26 29 L29 29 L29 17 L26 17 L26 25 L18 17 Z" fill="#FFD100"/>
    </svg>
  );
}

function LogoBitdefender() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="10" fill="#E8192C"/>
      {/* B shape */}
      <rect x="11" y="10" width="4" height="24" rx="1" fill="white"/>
      <path d="M15 10 L23 10 C27 10 30 13 30 17 C30 20 28 22 25 22.5 C28.5 23 31 25.5 31 29 C31 33 27.5 34 23 34 L15 34 Z" fill="white"/>
      <path d="M15 14 L22 14 C25 14 26.5 15.5 26.5 17.5 C26.5 19.5 25 21 22 21 L15 21 Z" fill="#E8192C"/>
      <path d="M15 24 L22 24 C25.5 24 27.5 25.5 27.5 28 C27.5 30.5 25.5 32 22 32 L15 32 Z" fill="#E8192C"/>
    </svg>
  );
}

function LogoSteam() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="10" fill="#1B2838"/>
      {/* Steam swirl — simplified */}
      <path
        d="M22 7 C13.7 7 7 13.7 7 22 C7 29.6 12.5 35.9 19.8 37.4 L14.5 30.5 C13.2 29.1 13.2 26.9 14.5 25.5 C15.9 24.1 18.1 24.1 19.4 25.5 L24.5 31.2 C24.7 31.1 24.8 31 25 30.9 C28.3 29.3 30.5 25.9 30.5 22 C30.5 15.1 25.3 7 22 7 Z"
        fill="#66C0F4" opacity="0.9"
      />
      <circle cx="22" cy="19" r="5" fill="#66C0F4"/>
      <circle cx="22" cy="19" r="3" fill="#1B2838"/>
    </svg>
  );
}

function LogoAdobe() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="10" fill="#FF0000"/>
      {/* Adobe A */}
      <path d="M22 9 L34 35 L27 35 L24.5 28 H19.5 L17 35 L10 35 Z M22 16 L20.5 25 H23.5 Z" fill="white"/>
    </svg>
  );
}

function LogoEset() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="10" fill="#1E4D78"/>
      {/* ESET text */}
      <text x="22" y="27" textAnchor="middle" fill="white" fontSize="13" fontWeight="800" fontFamily="Arial, sans-serif" letterSpacing="0.5">ESET</text>
      {/* Thin line under */}
      <rect x="10" y="30" width="24" height="1.5" rx="0.75" fill="#4A90D9" opacity="0.7"/>
    </svg>
  );
}

function LogoMalwarebytes() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <rect width="44" height="44" rx="10" fill="#00AAFF"/>
      {/* M shape */}
      <path
        d="M8 32 L8 14 L14 14 L22 24 L30 14 L36 14 L36 32 L31 32 L31 20 L22 31 L13 20 L13 32 Z"
        fill="white"
      />
    </svg>
  );
}

/* ── Brand data ──────────────────────────────────────────── */

interface Brand {
  name: string;
  href: string;
  sub: string;
  Logo: () => ReactElement;
  tileBg: string;
}

const BRANDS: Brand[] = [
  { name: "Microsoft",    href: "/category/office-productivity", sub: "Office & Windows",  Logo: LogoMicrosoft,   tileBg: "#f8f8f8" },
  { name: "Kaspersky",    href: "/category/antivirus-security",  sub: "Antivirus",          Logo: LogoKaspersky,   tileBg: "#004d3d" },
  { name: "Norton",       href: "/category/antivirus-security",  sub: "Security Suite",     Logo: LogoNorton,      tileBg: "#1a1a1a" },
  { name: "Bitdefender",  href: "/category/antivirus-security",  sub: "Threat Defense",     Logo: LogoBitdefender, tileBg: "#c0001e" },
  { name: "Steam",        href: "/category/games",               sub: "PC Games",           Logo: LogoSteam,       tileBg: "#1b2838" },
  { name: "Adobe",        href: "/category/design-creative",     sub: "Creative Cloud",     Logo: LogoAdobe,       tileBg: "#cc0000" },
  { name: "ESET",         href: "/category/antivirus-security",  sub: "NOD32 Antivirus",    Logo: LogoEset,        tileBg: "#163a5c" },
  { name: "Malwarebytes", href: "/category/antivirus-security",  sub: "Malware Removal",    Logo: LogoMalwarebytes,tileBg: "#0088cc" },
];

export function ShopByBrand() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-0.5">Brands</p>
          <h2 className="text-lg font-bold text-foreground">Shop by Brand</h2>
        </div>
        <Link href="/shop" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
        {BRANDS.map(({ name, href, sub, Logo, tileBg }) => (
          <Link key={name} href={href}>
            <div className="group flex flex-col items-center gap-2 cursor-pointer">
              <div
                className="w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg border border-black/8"
                style={{ background: tileBg, boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}
              >
                <Logo />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                  {name}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">{sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
