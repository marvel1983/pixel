import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Save, Zap, ShieldCheck, X, Copy, CheckCircle, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";
const STRIPE_WEBHOOK_URL = (() => {
  const base = API.startsWith("http") ? API.replace(/\/api$/, "") : window.location.origin;
  return `${base}/api/webhooks/stripe`;
})();

type Provider = "stripe" | "checkout";
type Mode = "sandbox" | "live";

interface ProviderStatus {
  isActive: boolean;
  mode: Mode;
  hasSecretKey: boolean;
  hasPublishableKey: boolean;
  hasWebhookSecret?: boolean;
  webhookUrl?: string;
}

interface PaymentProvidersData {
  activeProvider: Provider | null;
  stripe: ProviderStatus;
  checkout: ProviderStatus;
}

export default function SettingsPaymentProvidersTab() {
  const [data, setData] = useState<PaymentProvidersData | null>(null);
  const [reveal, setReveal] = useState<Record<string, string>>({});
  const [confirmReveal, setConfirmReveal] = useState<{ provider: Provider; field: string; label: string } | null>(null);
  const [keyModal, setKeyModal] = useState<{ provider: Provider; field: string; label: string } | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<Record<Provider, { success: boolean; message: string } | null>>({ stripe: null, checkout: null });
  const [copied, setCopied] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers },
    });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Request failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  const load = useCallback(() => {
    api("/admin/settings/payment-providers").then((d) => { if (d) setData(d); });
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // ── Active provider ──────────────────────────────────────────────────────────

  const setActiveProvider = async (provider: Provider) => {
    const d = await api("/admin/settings/payment-providers/active", {
      method: "PUT", body: JSON.stringify({ provider }),
    });
    if (d) { setReveal({}); load(); }
  };

  // ── Mode toggle ──────────────────────────────────────────────────────────────

  const setMode = async (provider: Provider, mode: Mode) => {
    const d = await api(`/admin/settings/payment-providers/${provider}/mode`, {
      method: "PUT", body: JSON.stringify({ mode }),
    });
    if (d) load();
  };

  // ── Key reveal ───────────────────────────────────────────────────────────────

  const requestReveal = (provider: Provider, field: string, label: string) => {
    const key = `${provider}.${field}`;
    if (reveal[key] !== undefined) {
      setReveal((p) => { const n = { ...p }; delete n[key]; return n; });
      return;
    }
    setConfirmReveal({ provider, field, label });
  };

  const confirmAndReveal = async () => {
    if (!confirmReveal) return;
    const { provider, field } = confirmReveal;
    setConfirmReveal(null);
    const d = await api(`/admin/settings/payment-providers/${provider}/reveal`, {
      method: "POST", body: JSON.stringify({ field }),
    });
    if (d) setReveal((p) => ({ ...p, [`${provider}.${field}`]: d.value || "(empty)" }));
  };

  // ── Key update ───────────────────────────────────────────────────────────────

  const openKeyModal = (provider: Provider, field: string, label: string) => {
    setKeyModal({ provider, field, label }); setKeyValue("");
  };

  const saveKey = async () => {
    if (!keyModal || !keyValue.trim()) return;
    setSaving(true);
    const d = await api(`/admin/settings/payment-providers/${keyModal.provider}/keys`, {
      method: "POST", body: JSON.stringify({ field: keyModal.field, value: keyValue.trim() }),
    });
    setSaving(false);
    if (d) { setKeyModal(null); setReveal({}); load(); }
  };

  // ── Test connection ──────────────────────────────────────────────────────────

  const testConnection = async (provider: Provider) => {
    setTestResult((p) => ({ ...p, [provider]: { success: false, message: "Testing..." } }));
    const d = await api(`/admin/settings/payment-providers/${provider}/test`, { method: "POST" });
    if (d) setTestResult((p) => ({ ...p, [provider]: d }));
  };

  // ── Copy webhook URL ─────────────────────────────────────────────────────────

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (!data) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">

      {/* Encryption notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">Keys stored encrypted at rest</p>
          <p className="text-xs text-blue-700 mt-0.5">All API keys and secrets are encrypted with AES-256-GCM. Only one provider can be active at a time.</p>
        </div>
      </div>

      {/* Stripe */}
      <ProviderCard
        title="Stripe"
        description="Hosted checkout page — customers are redirected to Stripe to enter card details."
        logo="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg"
        isActive={data.activeProvider === "stripe"}
        mode={data.stripe.mode}
        onActivate={() => setActiveProvider("stripe")}
        onModeChange={(m) => setMode("stripe", m)}
      >
        <KeyRow
          label="Secret Key"
          hint={data.stripe.mode === "sandbox" ? "sk_test_..." : "sk_live_..."}
          hasValue={data.stripe.hasSecretKey}
          revealKey="stripe.secretKey"
          reveal={reveal}
          onReveal={() => requestReveal("stripe", "secretKey", "Stripe Secret Key")}
          onUpdate={() => openKeyModal("stripe", "secretKey", "Stripe Secret Key")}
        />
        <KeyRow
          label="Publishable Key"
          hint={data.stripe.mode === "sandbox" ? "pk_test_..." : "pk_live_..."}
          hasValue={data.stripe.hasPublishableKey}
          revealKey="stripe.publishableKey"
          reveal={reveal}
          onReveal={() => requestReveal("stripe", "publishableKey", "Stripe Publishable Key")}
          onUpdate={() => openKeyModal("stripe", "publishableKey", "Stripe Publishable Key")}
        />
        <KeyRow
          label="Webhook Secret"
          hint="whsec_..."
          hasValue={!!data.stripe.hasWebhookSecret}
          revealKey="stripe.webhookSecret"
          reveal={reveal}
          onReveal={() => requestReveal("stripe", "webhookSecret", "Stripe Webhook Secret")}
          onUpdate={() => openKeyModal("stripe", "webhookSecret", "Stripe Webhook Secret")}
        />

        {/* Webhook URL */}
        <div className="pt-3 border-t space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Webhook className="h-3.5 w-3.5" />
              Your Stripe webhook endpoint
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="text-xs font-mono flex-1 break-all">{STRIPE_WEBHOOK_URL}</code>
              <Button size="sm" variant="ghost" className="h-7 px-2 flex-shrink-0" onClick={() => copyWebhookUrl(STRIPE_WEBHOOK_URL)}>
                {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Register this URL in your Stripe Dashboard → Developers → Webhooks. Enable: <code className="bg-muted px-1 rounded">checkout.session.completed</code> and <code className="bg-muted px-1 rounded">checkout.session.expired</code>.</p>
          </div>

        <div className="flex items-center gap-2 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => testConnection("stripe")}>
            <Zap className="h-3 w-3 mr-1" /> Test Connection
          </Button>
          {testResult.stripe && (
            <span className={`text-xs ${testResult.stripe.message === "Testing..." ? "text-muted-foreground" : testResult.stripe.success ? "text-green-600" : "text-red-600"}`}>
              {testResult.stripe.message}
            </span>
          )}
        </div>
      </ProviderCard>

      {/* Checkout.com */}
      <ProviderCard
        title="Checkout.com"
        description="Alternative payment gateway — coming soon or for custom integrations."
        isActive={data.activeProvider === "checkout"}
        mode={data.checkout.mode}
        onActivate={() => setActiveProvider("checkout")}
        onModeChange={(m) => setMode("checkout", m)}
      >
        <KeyRow
          label="Secret Key"
          hint={data.checkout.mode === "sandbox" ? "sk_test_..." : "sk_..."}
          hasValue={data.checkout.hasSecretKey}
          revealKey="checkout.secretKey"
          reveal={reveal}
          onReveal={() => requestReveal("checkout", "secretKey", "Checkout.com Secret Key")}
          onUpdate={() => openKeyModal("checkout", "secretKey", "Checkout.com Secret Key")}
        />
        <KeyRow
          label="Publishable Key"
          hint="pk_..."
          hasValue={data.checkout.hasPublishableKey}
          revealKey="checkout.publishableKey"
          reveal={reveal}
          onReveal={() => requestReveal("checkout", "publishableKey", "Checkout.com Publishable Key")}
          onUpdate={() => openKeyModal("checkout", "publishableKey", "Checkout.com Publishable Key")}
        />

        <div className="flex items-center gap-2 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => testConnection("checkout")}>
            <Zap className="h-3 w-3 mr-1" /> Test Connection
          </Button>
          {testResult.checkout && (
            <span className={`text-xs ${testResult.checkout.message === "Testing..." ? "text-muted-foreground" : testResult.checkout.success ? "text-green-600" : "text-red-600"}`}>
              {testResult.checkout.message}
            </span>
          )}
        </div>
      </ProviderCard>

      {/* Confirm reveal modal */}
      {confirmReveal && (
        <Modal onClose={() => setConfirmReveal(null)}>
          <h3 className="font-bold">Reveal Key</h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to reveal <strong>{confirmReveal.label}</strong>? This action is logged.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmReveal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmAndReveal}>
              <Eye className="h-4 w-4 mr-1" /> Reveal
            </Button>
          </div>
        </Modal>
      )}

      {/* Update key modal */}
      {keyModal && (
        <Modal onClose={() => setKeyModal(null)}>
          <h3 className="font-bold">Update {keyModal.label}</h3>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-md border bg-background text-foreground px-3 py-2 text-sm font-mono"
            placeholder="Paste new value…"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
          />
          <p className="text-xs text-muted-foreground">Encrypted with AES-256-GCM before storage.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setKeyModal(null)}>Cancel</Button>
            <Button onClick={saveKey} disabled={saving || !keyValue.trim()}>
              <Save className="h-4 w-4 mr-1" />{saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProviderCard({
  title, description, logo, isActive, mode, onActivate, onModeChange, children,
}: {
  title: string;
  description: string;
  logo?: string;
  isActive: boolean;
  mode: Mode;
  onActivate: () => void;
  onModeChange: (m: Mode) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border bg-card p-5 space-y-4 transition-colors ${isActive ? "border-blue-400 ring-1 ring-blue-200" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt={title} className="h-6 object-contain" />}
          {!logo && <span className="font-semibold text-base">{title}</span>}
          {logo && <span className="font-semibold">{title}</span>}
          {isActive && <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Active</Badge>}
        </div>

        {/* Sandbox / Live toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${mode === "sandbox" ? "text-amber-600" : "text-muted-foreground"}`}>Sandbox</span>
          <button
            type="button"
            onClick={() => onModeChange(mode === "sandbox" ? "live" : "sandbox")}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${mode === "live" ? "bg-green-500" : "bg-amber-400"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${mode === "live" ? "translate-x-4.5" : "translate-x-0.5"}`} />
          </button>
          <span className={`text-xs font-medium ${mode === "live" ? "text-green-600" : "text-muted-foreground"}`}>Live</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">{description}</p>

      {/* Keys */}
      <div className="space-y-0 divide-y">
        {children}
      </div>

      {/* Activate button */}
      {!isActive && (
        <div className="pt-1">
          <Button size="sm" onClick={onActivate} className="w-full">
            Set as Active Provider
          </Button>
        </div>
      )}
    </div>
  );
}

function KeyRow({
  label, hint, hasValue, revealKey, reveal, onReveal, onUpdate,
}: {
  label: string;
  hint: string;
  hasValue: boolean;
  revealKey: string;
  reveal: Record<string, string>;
  onReveal: () => void;
  onUpdate: () => void;
}) {
  const revealed = reveal[revealKey];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {revealed !== undefined ? (
          <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded break-all">{revealed}</code>
        ) : hasValue ? (
          <span className="text-xs text-muted-foreground font-mono">••••••••••••••••</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">{hint}</span>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {hasValue && (
          <Button size="sm" variant="ghost" onClick={onReveal} title={revealed !== undefined ? "Hide" : "Reveal"}>
            {revealed !== undefined ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onUpdate}>{hasValue ? "Update" : "Set"}</Button>
      </div>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card text-card-foreground rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div />
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
