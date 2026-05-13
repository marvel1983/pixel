import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ActiveProvider { type: string; trackingId: string; }

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void; load: (id: string) => void; page: () => void };
  }
}

// Singleton — providers fetched once per page load
let providersCache: ActiveProvider[] | null = null;

async function fetchProviders(): Promise<ActiveProvider[]> {
  if (providersCache) return providersCache;
  try {
    const res = await fetch(`${API}/tracking/active`);
    const data = await res.json();
    providersCache = data.providers ?? [];
  } catch {
    providersCache = [];
  }
  return providersCache!;
}

function injectScript(src: string, id: string, onLoad?: () => void) {
  if (document.getElementById(id)) { onLoad?.(); return; }
  const s = document.createElement("script");
  s.id = id;
  s.src = src;
  s.async = true;
  if (onLoad) s.onload = onLoad;
  document.head.appendChild(s);
}

function injectInlineScript(id: string, code: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.textContent = code;
  document.head.appendChild(s);
}

function initGA4(id: string) {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (...args) { window.dataLayer!.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", id, { send_page_view: false });
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${id}`, "tp-ga4");
}

function initGTM(id: string) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  injectScript(`https://www.googletagmanager.com/gtm.js?id=${id}`, "tp-gtm");
}

function initMetaPixel(id: string) {
  if (window.fbq) return;
  injectInlineScript("tp-fbq-init", `
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','${id}');
  `);
}

function initTikTok(id: string) {
  injectInlineScript("tp-ttq-init", `
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
    ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
    for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
    ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
    var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
    ttq.load('${id}');ttq.page();}(window,document,'ttq');
  `);
}

function initClarity(id: string) {
  injectInlineScript("tp-clarity-init", `
    (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");
  `);
}

export function firePageView(path: string) {
  if (!providersCache) return;
  for (const p of providersCache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "page_view", { page_path: path });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "PageView");
    if (p.type === "TIKTOK" && window.ttq) window.ttq.page();
  }
}

export function firePurchase(orderId: string, value: number, currency = "EUR") {
  if (!providersCache) return;
  for (const p of providersCache) {
    if (p.type === "GA4" && window.gtag) {
      window.gtag("event", "purchase", { transaction_id: orderId, value, currency });
    }
    if (p.type === "META_PIXEL" && window.fbq) {
      window.fbq("track", "Purchase", { value, currency });
    }
    if (p.type === "TIKTOK" && window.ttq) {
      window.ttq.track("CompletePayment", { value, currency });
    }
    if (p.type === "GTM" && window.dataLayer) {
      window.dataLayer.push({ event: "purchase", ecommerce: { transaction_id: orderId, value, currency } });
    }
  }
}

export function fireAddToCart(value: number, currency = "EUR") {
  if (!providersCache) return;
  for (const p of providersCache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "add_to_cart", { value, currency });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "AddToCart", { value, currency });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("AddToCart", { value, currency });
  }
}

export function ThirdPartyScripts() {
  const [location] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetchProviders().then((providers) => {
      for (const p of providers) {
        if (p.type === "GA4") initGA4(p.trackingId);
        else if (p.type === "GTM") initGTM(p.trackingId);
        else if (p.type === "META_PIXEL") initMetaPixel(p.trackingId);
        else if (p.type === "TIKTOK") initTikTok(p.trackingId);
        else if (p.type === "CLARITY") initClarity(p.trackingId);
      }
      firePageView(window.location.pathname);
    });
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    firePageView(location);
  }, [location]);

  return null;
}
