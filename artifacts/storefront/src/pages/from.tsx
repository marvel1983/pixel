import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

const KEY = "px_attr";

export default function FromPage() {
  const { source } = useParams<{ source: string }>();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (source) {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          utm_source: source.slice(0, 100).toLowerCase(),
          _ts: Date.now(),
        }));
      } catch { /* blocked */ }
    }
    navigate("/", { replace: true });
  }, [source]);

  return null;
}
