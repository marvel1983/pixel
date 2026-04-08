import { useState } from "react";
import { X, Shield, BarChart3, Megaphone, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCookieConsentStore, type CookieConsent } from "@/stores/cookie-consent-store";
import { useConsentConfig } from "@/hooks/use-consent-config";
import type { ComponentType } from "react";

interface Category {
  key: keyof CookieConsent;
  labelKey: "necessaryLabel" | "analyticsLabel" | "marketingLabel" | "preferencesLabel";
  descKey: "necessaryDesc" | "analyticsDesc" | "marketingDesc" | "preferencesDesc";
  icon: ComponentType<{ className?: string }>;
  locked: boolean;
}

const CATEGORIES: Category[] = [
  { key: "necessary", labelKey: "necessaryLabel", descKey: "necessaryDesc", icon: Shield, locked: true },
  { key: "analytics", labelKey: "analyticsLabel", descKey: "analyticsDesc", icon: BarChart3, locked: false },
  { key: "marketing", labelKey: "marketingLabel", descKey: "marketingDesc", icon: Megaphone, locked: false },
  { key: "preferences", labelKey: "preferencesLabel", descKey: "preferencesDesc", icon: Settings2, locked: false },
];

export function CookiePreferencesModal() {
  const { consent, closeModal, setConsent, acceptAll, rejectAll } = useCookieConsentStore();
  const { config } = useConsentConfig();
  const [local, setLocal] = useState<CookieConsent>(
    consent || { necessary: true, analytics: false, marketing: false, preferences: false }
  );

  function toggle(key: keyof CookieConsent) {
    if (key === "necessary") return;
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }));
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
            <a href={config.privacyPolicyUrl} className="underline text-primary">Privacy Policy</a>.
          </p>

          {CATEGORIES.map((cat) => (
            <div key={cat.key} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-gray-100">
                    <cat.icon className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <span className="font-medium text-sm">{config[cat.labelKey]}</span>
                    {cat.locked && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Always On</span>
                    )}
                  </div>
                </div>
                <Switch checked={local[cat.key]} onCheckedChange={() => toggle(cat.key)} disabled={cat.locked} />
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{config[cat.descKey]}</p>
            </div>
          ))}
        </div>

        <div className="p-5 border-t flex gap-2 justify-end sticky bottom-0 bg-white rounded-b-xl">
          <Button variant="outline" size="sm" onClick={rejectAll}>{config.rejectAllLabel}</Button>
          <Button variant="outline" size="sm" onClick={acceptAll}>{config.acceptAllLabel}</Button>
          <Button size="sm" onClick={() => setConsent(local, "customize")}>{config.savePrefsLabel}</Button>
        </div>
      </div>
    </div>
  );
}
