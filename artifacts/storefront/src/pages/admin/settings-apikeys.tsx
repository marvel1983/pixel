import { useEffect, useState, useCallback } from "react";
import { Eye, EyeOff, Save, Zap, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface KeyStatus { metenzi: { hasApiKey: boolean; hasSigningSecret: boolean; hasWebhookSecret: boolean; isActive: boolean }; checkout: { hasPublicKey: boolean; hasSecretKey: boolean; isActive: boolean }; }

export default function SettingsApiKeysTab() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [reveal, setReveal] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<{ provider: string; field: string; label: string } | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  const load = useCallback(() => { api("/admin/settings/api-keys").then((d) => { if (d) setStatus(d); }); }, [api]);
  useEffect(() => { load(); }, [load]);

  const [confirmReveal, setConfirmReveal] = useState<{ provider: string; field: string; label: string } | null>(null);

  const doReveal = async (provider: string, field: string) => {
    const key = `${provider}.${field}`;
    if (reveal[key] !== undefined) { setReveal((p) => { const n = { ...p }; delete n[key]; return n; }); return; }
    const label = `${provider === "metenzi" ? "Metenzi" : "Checkout.com"} ${field === "apiKey" ? "API Key" : field === "hmacSecret" ? "Signing Secret" : field === "webhookSecret" ? "Webhook Signing Secret" : field === "publicKey" ? "Public Key" : "Secret Key"}`;
    setConfirmReveal({ provider, field, label });
  };

  const confirmAndReveal = async () => {
    if (!confirmReveal) return;
    const { provider, field } = confirmReveal;
    const key = `${provider}.${field}`;
    setConfirmReveal(null);
    const d = await api("/admin/settings/api-keys/reveal", { method: "POST", body: JSON.stringify({ provider, field }) });
    if (d) setReveal((p) => ({ ...p, [key]: d.value || "(empty)" }));
  };

  const openUpdate = (provider: string, field: string, label: string) => { setModal({ provider, field, label }); setModalValue(""); };

  const saveKey = async () => {
    if (!modal || !modalValue.trim()) return;
    setSaving(true);
    const r = await api("/admin/settings/api-keys", { method: "PUT", body: JSON.stringify({ provider: modal.provider, field: modal.field, value: modalValue.trim() }) });
    setSaving(false);
    if (r) { setModal(null); setReveal({}); load(); }
  };

  const testConnection = async (provider: string) => {
    setTestResult((p) => ({ ...p, [provider]: { success: false, message: "Testing..." } }));
    const d = await api("/admin/settings/api-keys/test", { method: "POST", body: JSON.stringify({ provider }) });
    if (d) setTestResult((p) => ({ ...p, [provider]: d }));
  };

  if (!status) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div><p className="text-sm font-medium text-blue-800">Encryption at Rest</p><p className="text-xs text-blue-700 mt-0.5">All API keys and secrets are stored encrypted using AES-256-GCM. Keys are only decrypted when needed and never logged.</p></div>
      </div>

      <ProviderCard title="Metenzi API" description="Product catalog and license key fulfillment">
        <KeyRow label="API Key" hasValue={status.metenzi.hasApiKey} revealKey="metenzi.apiKey" reveal={reveal} onReveal={() => doReveal("metenzi", "apiKey")} onUpdate={() => openUpdate("metenzi", "apiKey", "Metenzi API Key")} />
        <KeyRow label="Signing Secret (HMAC)" hasValue={status.metenzi.hasSigningSecret} revealKey="metenzi.hmacSecret" reveal={reveal} onReveal={() => doReveal("metenzi", "hmacSecret")} onUpdate={() => openUpdate("metenzi", "hmacSecret", "Metenzi Signing Secret")} />
        <KeyRow label="Webhook Signing Secret (whsec)" hasValue={status.metenzi.hasWebhookSecret} revealKey="metenzi.webhookSecret" reveal={reveal} onReveal={() => doReveal("metenzi", "webhookSecret")} onUpdate={() => openUpdate("metenzi", "webhookSecret", "Metenzi Webhook Signing Secret")} />
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => testConnection("metenzi")}><Zap className="h-3 w-3 mr-1" /> Test Connection</Button>
          {testResult.metenzi && <span className={`text-xs ${testResult.metenzi.success ? "text-green-600" : "text-red-600"}`}>{testResult.metenzi.message}</span>}
        </div>
      </ProviderCard>

      <ProviderCard title="Checkout.com" description="Payment processing">
        <KeyRow label="Public Key" hasValue={status.checkout.hasPublicKey} revealKey="checkout.publicKey" reveal={reveal} onReveal={() => doReveal("checkout", "publicKey")} onUpdate={() => openUpdate("checkout", "publicKey", "Checkout.com Public Key")} />
        <KeyRow label="Secret Key" hasValue={status.checkout.hasSecretKey} revealKey="checkout.secretKey" reveal={reveal} onReveal={() => doReveal("checkout", "secretKey")} onUpdate={() => openUpdate("checkout", "secretKey", "Checkout.com Secret Key")} />
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => testConnection("checkout")}><Zap className="h-3 w-3 mr-1" /> Test Connection</Button>
          {testResult.checkout && <span className={`text-xs ${testResult.checkout.success ? "text-green-600" : "text-red-600"}`}>{testResult.checkout.message}</span>}
        </div>
      </ProviderCard>

      {confirmReveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmReveal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Reveal Secret</h3><button onClick={() => setConfirmReveal(null)}><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-muted-foreground">Are you sure you want to reveal <strong>{confirmReveal.label}</strong>? This action is logged for security purposes.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmReveal(null)}>Cancel</Button><Button variant="destructive" onClick={confirmAndReveal}><Eye className="h-4 w-4 mr-1" /> Reveal</Button></div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold">Update {modal.label}</h3><button onClick={() => setModal(null)}><X className="h-5 w-5" /></button></div>
            <input type="password" autoComplete="new-password" className="w-full rounded-md border px-3 py-2 text-sm font-mono" placeholder="Paste new value..." value={modalValue} onChange={(e) => setModalValue(e.target.value)} />
            <p className="text-xs text-muted-foreground">The value will be encrypted with AES-256-GCM before storage.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveKey} disabled={saving || !modalValue.trim()}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-5 space-y-3">
      <div><h3 className="font-semibold">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>
      {children}
    </div>
  );
}

function KeyRow({ label, hasValue, revealKey, reveal, onReveal, onUpdate }: { label: string; hasValue: boolean; revealKey: string; reveal: Record<string, string>; onReveal: () => void; onUpdate: () => void }) {
  const revealed = reveal[revealKey];
  return (
    <div className="flex items-center gap-3 py-2 border-t first:border-t-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {revealed !== undefined ? (
          <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded break-all">{revealed}</code>
        ) : hasValue ? (
          <span className="text-xs text-muted-foreground font-mono">••••••••••••••••</span>
        ) : (
          <Badge variant="secondary" className="text-xs">Not configured</Badge>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {hasValue && <Button size="sm" variant="ghost" onClick={onReveal}>{revealed !== undefined ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>}
        <Button size="sm" variant="outline" onClick={onUpdate}>{hasValue ? "Update" : "Set"}</Button>
      </div>
    </div>
  );
}
