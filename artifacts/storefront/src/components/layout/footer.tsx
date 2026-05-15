import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Mail, Loader2, Check, Cookie, ShieldCheck, Zap, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TrustpilotMicro } from "@/components/trustpilot/trustpilot-micro";
import { useCookieConsentStore } from "@/stores/cookie-consent-store";
import "./footer.css";

const API = import.meta.env.VITE_API_URL ?? "/api";


/* ── Social SVG icons ─────────────────────────────────────── */
function IconX() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" /></svg>;
}
function IconFacebook() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>;
}
function IconDiscord() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.013.04.031.051a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>;
}
function IconYouTube() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>;
}

/* ── Link columns ─────────────────────────────────────────── */
const COLS = [
  {
    title: "Shop",
    links: [
      { label: "Operating Systems", href: "/category/operating-systems" },
      { label: "Office & Productivity", href: "/category/office-productivity" },
      { label: "Antivirus & Security", href: "/category/antivirus-security" },
      { label: "PC Games", href: "/category/games" },
      { label: "VPN & Privacy", href: "/category/vpn-privacy" },
      { label: "Design & Creative", href: "/category/design-creative" },
      { label: "Software Bundles", href: "/category/bundles" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about-us" },
      { label: "Blog", href: "/blog" },
      { label: "Affiliate Program", href: "/affiliates" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/support" },
      { label: "Contact Us", href: "/contact" },
      { label: "How to Activate", href: "/how-to-activate" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "FAQ", href: "/faq" },
      { label: "Track Order", href: "/order-lookup" },
    ],
  },
];

const LEGAL = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

/* ── Payment pill ─────────────────────────────────────────── */
function PayPill({ children, bg = "#ffffff10", border = "#ffffff15" }: { children: React.ReactNode; bg?: string; border?: string }) {
  return (
    <div
      className="flex h-8 min-w-[52px] items-center justify-center rounded-lg px-2 text-xs font-bold"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      {children}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="footer-root relative overflow-hidden text-slate-300">
      <div aria-hidden className="footer-top-line absolute inset-x-0 top-0 h-px" />

      {/* Content */}
      <div className="relative z-10">

        {/* ── Top section: brand + newsletter ─────────────────── */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-10">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">

            {/* Brand */}
            <div className="lg:w-72 shrink-0">
              <div className="mb-4">
                <Link href="/">
                  <picture>
                    <source srcSet="/logo.webp?v=2" type="image/webp" />
                    <img src="/logo.png?v=2" alt="PixelCodes" className="h-10 w-auto" width="185" height="40" />
                  </picture>
                </Link>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                {t("footer.tagline")}
              </p>

              {/* Trust badges */}
              <div className="space-y-2 mb-6">
                {[
                  { icon: <ShieldCheck className="h-3.5 w-3.5" />, text: "256-bit SSL encrypted checkout", color: "#22c55e" },
                  { icon: <Zap className="h-3.5 w-3.5" />, text: "Instant key delivery via email", color: "#3b82f6" },
                  { icon: <Lock className="h-3.5 w-3.5" />, text: "Verified & genuine license keys", color: "#a855f7" },
                ].map(({ icon, text, color }) => (
                  <div key={text} className="flex items-center gap-2.5" style={{ color }}>
                    {icon}
                    <span className="text-xs text-slate-400">{text}</span>
                  </div>
                ))}
              </div>

              {/* Socials */}
              <div className="flex gap-2">
                {[
                  { icon: <IconX />, label: "X" },
                  { icon: <IconFacebook />, label: "Facebook" },
                  { icon: <IconDiscord />, label: "Discord" },
                  { icon: <IconYouTube />, label: "YouTube" },
                ].map(({ icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-white transition-all"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            <div className="flex-1 grid grid-cols-2 gap-8 sm:grid-cols-3">
              {COLS.map(({ title, links }) => (
                <div key={title}>
                  <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-white/80">{title}</h3>
                  <ul className="space-y-2.5">
                    {links.map(({ label, href }) => (
                      <li key={href}>
                        <Link href={href} className="text-sm text-slate-500 hover:text-slate-200 transition-colors">
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Newsletter */}
            <div className="lg:w-64 shrink-0">
              <h3 className="mb-1 text-[11px] font-black uppercase tracking-widest text-white/80">Newsletter</h3>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                Get exclusive deals, flash sales & promo codes straight to your inbox.
              </p>
              <FooterNewsletter />
              <p className="text-[11px] text-slate-600 mt-2">No spam. Unsubscribe anytime.</p>
            </div>
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────────── */}
        <div
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        />

        {/* ── Bottom bar ───────────────────────────────────────── */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            {/* Payment methods */}
            <div className="flex flex-wrap items-center gap-2">
              <PayPill bg="#1a1f71" border="#2a35b5">
                <span className="text-white tracking-wide">VISA</span>
              </PayPill>
              <PayPill bg="#1c1c1c" border="#333">
                <span className="flex gap-0.5">
                  <span className="inline-block w-4 h-4 rounded-full bg-[#EB001B] opacity-90" />
                  <span className="inline-block w-4 h-4 rounded-full bg-[#F79E1B] opacity-90 -ml-1.5" />
                </span>
              </PayPill>
              <PayPill bg="#000" border="#333">
                <span className="text-white text-[11px] tracking-tight">⌘ Pay</span>
              </PayPill>
              <PayPill bg="#fff" border="#ddd">
                <span style={{ color: "#4285F4" }}>G</span>
                <span style={{ color: "#EA4335" }}>o</span>
                <span style={{ color: "#FBBC05" }}>o</span>
                <span style={{ color: "#34A853" }}>g</span>
                <span style={{ color: "#4285F4" }}>le</span>
                <span className="text-slate-500 ml-0.5">Pay</span>
              </PayPill>
            </div>

            {/* Trustpilot */}
            <TrustpilotMicro />

            {/* Legal */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL.map(({ label, href }) => (
                <Link key={href} href={href} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  {label}
                </Link>
              ))}
              <button
                onClick={() => useCookieConsentStore.getState().openModal()}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1"
              >
                <Cookie className="h-3 w-3" /> Cookies
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-700">
            &copy; {new Date().getFullYear()} PixelCodes. All rights reserved. All trademarks are property of their respective owners.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterNewsletter() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(data.message);
      setEmail("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (message) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-sm text-emerald-400">
        <Check className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10 w-full rounded-xl border-white/10 bg-white/6 text-white placeholder:text-slate-600 focus-visible:border-blue-500/50 focus-visible:ring-0"
        onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as unknown as React.FormEvent)}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !email}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}
      >
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <><Mail className="h-4 w-4" /> Subscribe</>}
      </button>
    </div>
  );
}
