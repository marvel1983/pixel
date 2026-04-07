import { useEffect, useState, useCallback } from "react";
import { Save, RefreshCw, AlertTriangle, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface SeoSettings {
  googleAnalyticsId: string; gtmId: string; facebookPixelId: string;
  googleVerificationCode: string; socialShareImage: string;
  robotsTxt: string; customHeadScripts: string; customBodyScripts: string;
  maintenanceMode: boolean; maintenanceMessage: string;
  maintenanceEstimate: string; maintenanceBypassIps: string[];
}

const defaults: SeoSettings = {
  googleAnalyticsId: "", gtmId: "", facebookPixelId: "",
  googleVerificationCode: "", socialShareImage: "",
  robotsTxt: "User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml",
  customHeadScripts: "", customBodyScripts: "",
  maintenanceMode: false, maintenanceMessage: "We are currently performing maintenance. Please check back soon.",
  maintenanceEstimate: "", maintenanceBypassIps: [],
};

export default function SettingsSeoTrackingTab() {
  const [form, setForm] = useState<SeoSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newIp, setNewIp] = useState("");
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) return null;
    return r.json();
  }, [token]);

  useEffect(() => {
    api("/admin/settings/seo-tracking").then((d) => {
      if (d?.settings) {
        const s = d.settings;
        setForm({
          googleAnalyticsId: s.googleAnalyticsId ?? "", gtmId: s.gtmId ?? "",
          facebookPixelId: s.facebookPixelId ?? "", googleVerificationCode: s.googleVerificationCode ?? "",
          socialShareImage: s.socialShareImage ?? "", robotsTxt: s.robotsTxt ?? defaults.robotsTxt,
          customHeadScripts: s.customHeadScripts ?? "", customBodyScripts: s.customBodyScripts ?? "",
          maintenanceMode: s.maintenanceMode ?? false, maintenanceMessage: s.maintenanceMessage ?? defaults.maintenanceMessage,
          maintenanceEstimate: s.maintenanceEstimate ?? "", maintenanceBypassIps: s.maintenanceBypassIps ?? [],
        });
      }
      setLoaded(true);
    });
  }, [api]);

  const set = <K extends keyof SeoSettings>(k: K, v: SeoSettings[K]) => setForm((p) => ({ ...p, [k]: v }));

  const addIp = () => {
    const ip = newIp.trim();
    if (ip && !form.maintenanceBypassIps.includes(ip)) {
      set("maintenanceBypassIps", [...form.maintenanceBypassIps, ip]);
      setNewIp("");
    }
  };

  const removeIp = (ip: string) => set("maintenanceBypassIps", form.maintenanceBypassIps.filter((i) => i !== ip));

  const regenerateSitemap = async () => {
    const d = await api("/admin/settings/seo-tracking/regenerate-sitemap", { method: "POST" });
    if (d?.success) alert("Sitemap regeneration queued!");
  };

  const save = async () => {
    setSaving(true);
    await api("/admin/settings/seo-tracking", { method: "PUT", body: JSON.stringify(form) });
    setSaving(false);
    alert("SEO & Tracking settings saved!");
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <Section title="Tracking Codes">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Google Analytics ID"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.googleAnalyticsId} onChange={(e) => set("googleAnalyticsId", e.target.value)} placeholder="G-XXXXXXXXXX" /></Field>
          <Field label="Google Tag Manager ID"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.gtmId} onChange={(e) => set("gtmId", e.target.value)} placeholder="GTM-XXXXXXX" /></Field>
          <Field label="Facebook Pixel ID"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.facebookPixelId} onChange={(e) => set("facebookPixelId", e.target.value)} placeholder="123456789012345" /></Field>
          <Field label="Google Verification Code"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.googleVerificationCode} onChange={(e) => set("googleVerificationCode", e.target.value)} placeholder="google-site-verification=..." /></Field>
        </div>
      </Section>

      <Section title="Social & SEO">
        <Field label="Social Share Image URL"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.socialShareImage} onChange={(e) => set("socialShareImage", e.target.value)} placeholder="https://..." /></Field>
        {form.socialShareImage && <img src={form.socialShareImage} alt="Preview" className="h-20 rounded border mt-1" />}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={regenerateSitemap}><RefreshCw className="h-4 w-4 mr-1" /> Regenerate Sitemap</Button>
        </div>
      </Section>

      <Section title="Robots.txt">
        <textarea className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[120px] resize-y" value={form.robotsTxt} onChange={(e) => set("robotsTxt", e.target.value)} />
      </Section>

      <Section title="Custom Script Injection">
        <Field label="Head Scripts (before </head>)">
          <textarea className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[80px] resize-y" value={form.customHeadScripts} onChange={(e) => set("customHeadScripts", e.target.value)} placeholder="<script>...</script>" />
        </Field>
        <Field label="Body Scripts (before </body>)">
          <textarea className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[80px] resize-y" value={form.customBodyScripts} onChange={(e) => set("customBodyScripts", e.target.value)} placeholder="<script>...</script>" />
        </Field>
      </Section>

      <Section title="Maintenance Mode">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox checked={form.maintenanceMode} onCheckedChange={(v) => set("maintenanceMode", !!v)} />
            <span className="text-sm font-medium">Enable Maintenance Mode</span>
          </label>
          {form.maintenanceMode && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> ACTIVE</Badge>}
        </div>
        {form.maintenanceMode && (
          <div className="space-y-3 mt-2 p-3 rounded-lg border border-orange-200 bg-orange-50">
            <Field label="Maintenance Message">
              <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y" value={form.maintenanceMessage} onChange={(e) => set("maintenanceMessage", e.target.value)} />
            </Field>
            <Field label="Estimated Completion">
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.maintenanceEstimate} onChange={(e) => set("maintenanceEstimate", e.target.value)} placeholder="e.g., 2 hours, 3:00 PM EST" />
            </Field>
            <Field label="Bypass IPs">
              <div className="flex flex-wrap gap-2 mb-2">
                {form.maintenanceBypassIps.map((ip) => (
                  <span key={ip} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs border">
                    {ip} <button type="button" onClick={() => removeIp(ip)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="192.168.1.1" value={newIp}
                  onChange={(e) => setNewIp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIp())} />
                <Button variant="outline" size="sm" type="button" onClick={addIp}><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
            </Field>
          </div>
        )}
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-white p-5 space-y-3"><h3 className="font-semibold">{title}</h3>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}
