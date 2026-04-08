import { useState } from "react";
import { X, Shield, BarChart3, Megaphone, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCookieConsentStore, type CookieConsent } from "@/stores/cookie-consent-store";

const CATEGORIES = [
  {
    key: "necessary" as const,
    label: "Strictly Necessary",
    icon: Shield,
    description: "These cookies are essential for the website to function properly. They enable core functionality such as security, network management, and account access. You cannot disable these cookies.",
    locked: true,
  },
  {
    key: "analytics" as const,
    label: "Analytics",
    icon: BarChart3,
    description: "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our website experience.",
    locked: false,
  },
  {
    key: "marketing" as const,
    label: "Marketing",
    icon: Megaphone,
    description: "These cookies are used to track visitors across websites. The intention is to display ads that are relevant and engaging for the individual user.",
    locked: false,
  },
  {
    key: "preferences" as const,
    label: "Preferences",
    icon: Settings2,
    description: "These cookies enable the website to provide enhanced functionality and personalization, such as remembering your language preference or region.",
    locked: false,
  },
];

export function CookiePreferencesModal() {
  const { consent, closeModal, setConsent, acceptAll, rejectAll } = useCookieConsentStore();
  const [local, setLocal] = useState<CookieConsent>(
    consent || { necessary: true, analytics: false, marketing: false, preferences: false }
  );

  function toggle(key: keyof CookieConsent) {
    if (key === "necessary") return;
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function savePreferences() {
    setConsent(local, "customize");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-xl">
          <h2 className="font-bold text-lg">Cookie Preferences</h2>
          <button onClick={closeModal} className="p-1 rounded-md hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-1">
          <p className="text-sm text-muted-foreground mb-4">
            Manage your cookie preferences below. Necessary cookies cannot be disabled as they are required
            for the site to function. For more information, see our{" "}
            <a href="/privacy" className="underline text-primary">Privacy Policy</a>.
          </p>

          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-gray-100">
                    <cat.icon className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <span className="font-medium text-sm">{cat.label}</span>
                    {cat.locked && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Always On</span>
                    )}
                  </div>
                </div>
                <Switch
                  checked={local[cat.key]}
                  onCheckedChange={() => toggle(cat.key)}
                  disabled={cat.locked}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{cat.description}</p>
            </div>
          ))}
        </div>

        <div className="p-5 border-t flex gap-2 justify-end sticky bottom-0 bg-white rounded-b-xl">
          <Button variant="outline" size="sm" onClick={rejectAll}>Reject All</Button>
          <Button variant="outline" size="sm" onClick={acceptAll}>Accept All</Button>
          <Button size="sm" onClick={savePreferences}>Save Preferences</Button>
        </div>
      </div>
    </div>
  );
}
