import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export interface ConsentConfigData {
  bannerTitle: string;
  bannerText: string;
  privacyPolicyUrl: string;
  acceptAllLabel: string;
  rejectAllLabel: string;
  customizeLabel: string;
  savePrefsLabel: string;
  necessaryLabel: string;
  necessaryDesc: string;
  analyticsLabel: string;
  analyticsDesc: string;
  marketingLabel: string;
  marketingDesc: string;
  preferencesLabel: string;
  preferencesDesc: string;
}

const DEFAULTS: ConsentConfigData = {
  bannerTitle: "We value your privacy",
  bannerText: 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.',
  privacyPolicyUrl: "/privacy",
  acceptAllLabel: "Accept All",
  rejectAllLabel: "Reject All",
  customizeLabel: "Customize",
  savePrefsLabel: "Save Preferences",
  necessaryLabel: "Strictly Necessary",
  necessaryDesc: "These cookies are essential for the website to function properly.",
  analyticsLabel: "Analytics",
  analyticsDesc: "These cookies help us understand how visitors interact with our website.",
  marketingLabel: "Marketing",
  marketingDesc: "These cookies are used to track visitors across websites.",
  preferencesLabel: "Preferences",
  preferencesDesc: "These cookies enable enhanced functionality and personalization.",
};

let cached: ConsentConfigData | null = null;

export function useConsentConfig() {
  const [config, setConfig] = useState<ConsentConfigData>(cached ?? DEFAULTS);
  const [loaded, setLoaded] = useState(!!cached);

  useEffect(() => {
    if (cached) { setConfig(cached); setLoaded(true); return; }
    fetch(`${API}/consent/config`)
      .then((r) => r.json())
      .then((data: ConsentConfigData) => {
        cached = { ...DEFAULTS, ...data };
        setConfig(cached);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return { config, loaded };
}
