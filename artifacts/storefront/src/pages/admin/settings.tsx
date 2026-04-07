import { lazy, Suspense } from "react";
import { useSearch, useLocation } from "wouter";

const SettingsGeneralTab = lazy(() => import("./settings-general"));
const SettingsApiKeysTab = lazy(() => import("./settings-apikeys"));
const SettingsCppFeesTab = lazy(() => import("./settings-cpp-fees"));
const SettingsCurrenciesTab = lazy(() => import("./settings-currencies"));
const SettingsSmtpTab = lazy(() => import("./settings-smtp"));
const SettingsWebhooksTab = lazy(() => import("./settings-webhooks"));
const SettingsLiveChatTab = lazy(() => import("./settings-livechat"));
const SettingsNotificationsTab = lazy(() => import("./settings-notifications"));
const SettingsSeoTrackingTab = lazy(() => import("./settings-seo-tracking"));
const SettingsGoogleTab = lazy(() => import("./settings-google"));

const tabs = [
  { key: "general", label: "General" },
  { key: "notifications", label: "Notifications" },
  { key: "seo-tracking", label: "SEO & Tracking" },
  { key: "cpp-fees", label: "CPP & Fees" },
  { key: "currencies", label: "Currencies" },
  { key: "smtp", label: "SMTP" },
  { key: "api-keys", label: "API Keys" },
  { key: "webhooks", label: "Webhooks" },
  { key: "live-chat", label: "Live Chat" },
  { key: "google-oauth", label: "Google OAuth" },
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
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground p-4">Loading...</div>}>
        {activeTab === "general" && <SettingsGeneralTab />}
        {activeTab === "notifications" && <SettingsNotificationsTab />}
        {activeTab === "seo-tracking" && <SettingsSeoTrackingTab />}
        {activeTab === "cpp-fees" && <SettingsCppFeesTab />}
        {activeTab === "currencies" && <SettingsCurrenciesTab />}
        {activeTab === "smtp" && <SettingsSmtpTab />}
        {activeTab === "api-keys" && <SettingsApiKeysTab />}
        {activeTab === "webhooks" && <SettingsWebhooksTab />}
        {activeTab === "live-chat" && <SettingsLiveChatTab />}
        {activeTab === "google-oauth" && <SettingsGoogleTab />}
      </Suspense>
    </div>
  );
}
