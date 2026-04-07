import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export function LiveChatWidget() {
  const [injected, setInjected] = useState(false);

  useEffect(() => {
    if (injected) return;
    fetch(`${API}/settings/live-chat`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.enabled || !d.code) return;
        const container = document.createElement("div");
        container.id = "live-chat-embed";
        container.innerHTML = d.code;
        const scripts = container.querySelectorAll("script");
        scripts.forEach((orig) => {
          const s = document.createElement("script");
          if (orig.src) { s.src = orig.src; } else { s.textContent = orig.textContent; }
          s.async = true;
          document.body.appendChild(s);
        });
        setInjected(true);
      })
      .catch(() => {});
  }, [injected]);

  return null;
}
