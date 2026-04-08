import { useEffect, useRef, useState } from "react";
import { useCookieConsentStore } from "@/stores/cookie-consent-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface TrackingIds {
  gaId: string | null;
  fbPixelId: string | null;
}

export function ConsentGatedScripts() {
  const consent = useCookieConsentStore((s) => s.consent);
  const [ids, setIds] = useState<TrackingIds | null>(null);
  const loaded = useRef({ analytics: false, marketing: false });

  useEffect(() => {
    fetch(`${API}/consent/tracking-ids`)
      .then((r) => r.json())
      .then(setIds)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!consent || !ids) return;

    if (consent.analytics && ids.gaId && !loaded.current.analytics) {
      loaded.current.analytics = true;
      loadGA(ids.gaId);
    }

    if (consent.marketing && ids.fbPixelId && !loaded.current.marketing) {
      loaded.current.marketing = true;
      loadFBPixel(ids.fbPixelId);
    }
  }, [consent, ids]);

  return null;
}

function loadGA(gaId: string) {
  if (document.querySelector(`script[src*="googletagmanager"]`)) return;
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.async = true;
  document.head.appendChild(script);

  const init = document.createElement("script");
  init.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
  document.head.appendChild(init);
}

function loadFBPixel(pixelId: string) {
  if (document.querySelector(`script[data-fb-pixel]`)) return;
  const script = document.createElement("script");
  script.setAttribute("data-fb-pixel", "true");
  script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
  document.head.appendChild(script);
}
