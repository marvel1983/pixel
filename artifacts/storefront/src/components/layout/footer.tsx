import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Mail, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrustpilotMicro } from "@/components/trustpilot/trustpilot-micro";

const API = import.meta.env.VITE_API_URL ?? "/api";

const QUICK_LINK_KEYS = [
  { key: "footer.bestSellers", href: "/best-sellers" },
  { key: "footer.newArrivals", href: "/new-arrivals" },
  { key: "footer.dealsOffers", href: "/deals" },
  { key: "footer.giftCards", href: "/gift-cards" },
  { key: "footer.blog", href: "/blog" },
];

const SUPPORT_LINK_KEYS = [
  { key: "footer.helpCenter", href: "/support" },
  { key: "footer.contactUs", href: "/contact" },
  { key: "footer.howToActivate", href: "/how-to-activate" },
  { key: "footer.refundPolicy", href: "/refund-policy" },
  { key: "footer.faq", href: "/faq" },
];

const LEGAL_LINK_KEYS = [
  { key: "footer.termsOfService", href: "/terms" },
  { key: "footer.privacyPolicy", href: "/privacy" },
  { key: "footer.cookiePolicy", href: "/cookies" },
];

const PAYMENT_METHODS = [
  "Visa",
  "Mastercard",
  "PayPal",
  "Apple Pay",
  "Google Pay",
  "Crypto",
];

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PC</span>
              </div>
              <span className="text-lg font-bold text-white">PixelCodes</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {t("footer.tagline")}
            </p>
            <div className="flex gap-3 mt-4">
              <SocialLink label="Twitter" />
              <SocialLink label="Facebook" />
              <SocialLink label="Discord" />
              <SocialLink label="YouTube" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              {t("footer.quickLinks")}
            </h3>
            <ul className="space-y-2.5">
              {QUICK_LINK_KEYS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              {t("footer.support")}
            </h3>
            <ul className="space-y-2.5">
              {SUPPORT_LINK_KEYS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {t(link.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              {t("footer.newsletter")}
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              {t("footer.newsletterDesc")}
            </p>
            <FooterNewsletter />
          </div>
        </div>

        <Separator className="my-8 bg-slate-800" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap justify-center gap-2">
            {PAYMENT_METHODS.map((m) => (
              <span key={m} className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700">
                {m}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            {LEGAL_LINK_KEYS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-300 transition-colors">
                {t(link.key)}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex justify-center mt-6 mb-3">
          <TrustpilotMicro />
        </div>

        <p className="text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} PixelCodes. {t("footer.allRightsReserved")}
        </p>
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
      <div className="flex items-center gap-2 text-sm text-green-400">
        <Check className="h-4 w-4" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <Input
        type="email"
        placeholder={t("footer.emailPlaceholder")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
        required
      />
      <Button size="sm" className="shrink-0" type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      </Button>
    </form>
  );
}

function SocialLink({ label }: { label: string }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs font-semibold"
    >
      {label[0]}
    </a>
  );
}
