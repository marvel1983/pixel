import { useEffect, useState, useCallback } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface GeneralSettings {
  siteName: string; siteDescription: string; logoUrl: string; faviconUrl: string;
  contactEmail: string; supportEmail: string; fromEmail: string; phone: string;
  companyName: string; tagline: string; copyright: string;
  socialLinks: Record<string, string>;
  announcementBar: string; metaTitleTemplate: string; metaDescription: string;
}

const defaults: GeneralSettings = {
  siteName: "PixelCodes", siteDescription: "", logoUrl: "", faviconUrl: "",
  contactEmail: "", supportEmail: "", fromEmail: "", phone: "",
  companyName: "", tagline: "", copyright: "",
  socialLinks: { facebook: "", twitter: "", instagram: "", youtube: "", discord: "", linkedin: "" },
  announcementBar: "", metaTitleTemplate: "", metaDescription: "",
};

export default function SettingsGeneralTab() {
  const [form, setForm] = useState<GeneralSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const token = useAuthStore((s) => s.token);

  const api = useCallback(async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  }, [token]);

  useEffect(() => {
    api("/admin/settings/general").then((d) => {
      if (d?.settings) {
        setForm({ ...defaults, ...d.settings, socialLinks: { ...defaults.socialLinks, ...d.settings.socialLinks } });
      }
      setLoaded(true);
    });
  }, [api]);

  const set = (key: keyof GeneralSettings, val: unknown) => setForm((p) => ({ ...p, [key]: val }));
  const setSocial = (key: string, val: string) => setForm((p) => ({ ...p, socialLinks: { ...p.socialLinks, [key]: val } }));

  const save = async () => {
    setSaving(true);
    await api("/admin/settings/general", { method: "PUT", body: JSON.stringify(form) });
    setSaving(false);
    alert("Settings saved!");
  };

  if (!loaded) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <h3 className="font-semibold">Site Branding</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Site Name"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.siteName} onChange={(e) => set("siteName", e.target.value)} /></Field>
          <Field label="Company Name"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} /></Field>
        </div>
        <Field label="Tagline"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
        <Field label="Site Description"><textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y" value={form.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Logo URL">
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." />
            {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="h-10 mt-2 rounded border" />}
          </Field>
          <Field label="Favicon URL"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.faviconUrl} onChange={(e) => set("faviconUrl", e.target.value)} /></Field>
        </div>
        <Field label="Copyright"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.copyright} onChange={(e) => set("copyright", e.target.value)} placeholder="&copy; 2025 PixelCodes" /></Field>
      </div>
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <h3 className="font-semibold">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Email"><input type="email" className="w-full rounded-md border px-3 py-2 text-sm" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></Field>
          <Field label="Support Email"><input type="email" className="w-full rounded-md border px-3 py-2 text-sm" value={form.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></Field>
          <Field label="From Email"><input type="email" className="w-full rounded-md border px-3 py-2 text-sm" value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} /></Field>
          <Field label="Phone"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <h3 className="font-semibold">Social Media</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(defaults.socialLinks).map((k) => (
            <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.socialLinks[k] ?? ""} onChange={(e) => setSocial(k, e.target.value)} placeholder={`https://${k}.com/...`} />
            </Field>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <h3 className="font-semibold">SEO Defaults</h3>
        <Field label="Meta Title Template"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.metaTitleTemplate} onChange={(e) => set("metaTitleTemplate", e.target.value)} placeholder="{title} | PixelCodes" /></Field>
        <Field label="Meta Description"><textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px] resize-y" value={form.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} /></Field>
        <Field label="Announcement Bar"><input className="w-full rounded-md border px-3 py-2 text-sm" value={form.announcementBar} onChange={(e) => set("announcementBar", e.target.value)} /></Field>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}</Button></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}
