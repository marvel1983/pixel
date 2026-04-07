import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function AuthGoogleSuccessPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { setAuth } = useAuthStore();
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const params = new URLSearchParams(search);
    const code = params.get("code");
    if (!code) {
      setLocation("/login");
      return;
    }

    fetch(`${API}/auth/google/exchange?code=${encodeURIComponent(code)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Exchange failed");
        return r.json();
      })
      .then(({ user, token }) => {
        setAuth(user, token);
        setLocation("/");
      })
      .catch(() => {
        setLocation("/login?error=Google+authentication+failed");
      });
  }, [search, setAuth, setLocation]);

  return (
    <div className="flex justify-center items-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
