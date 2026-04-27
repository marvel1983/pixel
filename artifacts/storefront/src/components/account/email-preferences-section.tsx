import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "email_preferences";

interface EmailPrefs { shippingUpdates: boolean; promotions: boolean; newsletter: boolean }

function loadEmailPrefs(): EmailPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EmailPrefs;
  } catch { /* ignore */ }
  return { shippingUpdates: true, promotions: true, newsletter: false };
}

export function EmailPreferencesSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<EmailPrefs>(loadEmailPrefs);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof EmailPrefs) { setPrefs((prev) => ({ ...prev, [key]: !prev[key] })); setSaved(false); }
  function handleSave() { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); setSaved(true); toast({ title: "Email preferences saved!" }); }

  return (
    <Card className="mt-6">
      <CardHeader><CardTitle className="text-base">Email Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Order confirmations</p>
            <p className="text-xs text-muted-foreground">Receive a confirmation when you place an order</p>
          </div>
          <Switch checked disabled aria-label="Order confirmations" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Shipping updates</p>
            <p className="text-xs text-muted-foreground">Get notified when your order ships or is delivered</p>
          </div>
          <Switch checked={prefs.shippingUpdates} onCheckedChange={() => toggle("shippingUpdates")} aria-label="Shipping updates" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Promotions &amp; deals</p>
            <p className="text-xs text-muted-foreground">Flash sales, discount codes, and special offers</p>
          </div>
          <Switch checked={prefs.promotions} onCheckedChange={() => toggle("promotions")} aria-label="Promotions and deals" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Newsletter</p>
            <p className="text-xs text-muted-foreground">Monthly updates, product news, and tips</p>
          </div>
          <Switch checked={prefs.newsletter} onCheckedChange={() => toggle("newsletter")} aria-label="Newsletter" />
        </div>
        <Button type="button" variant={saved ? "outline" : "default"} size="sm" onClick={handleSave} className="mt-2">
          {saved ? "Preferences saved" : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
