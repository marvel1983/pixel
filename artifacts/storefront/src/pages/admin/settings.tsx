import { useSearch, useLocation } from "wouter";
import SettingsGeneralTab from "./settings-general";
import SettingsApiKeysTab from "./settings-apikeys";

const tabs = [
  { key: "general", label: "General" },
  { key: "api-keys", label: "API Keys" },
] as const;

export default function AdminSettingsPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const activeTab = params.get("tab") || "general";

  const setTab = (tab: string) => navigate(`/admin/settings?tab=${tab}`);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {activeTab === "general" && <SettingsGeneralTab />}
      {activeTab === "api-keys" && <SettingsApiKeysTab />}
    </div>
  );
}
