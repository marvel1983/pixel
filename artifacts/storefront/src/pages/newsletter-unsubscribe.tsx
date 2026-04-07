import { useEffect, useState } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function NewsletterUnsubscribePage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { setStatus("error"); setMessage("Missing token."); return; }

    fetch(`${API}/newsletter/unsubscribe?token=${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Unsubscribe failed");
      });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Breadcrumbs crumbs={[{ label: "Home", href: "/" }, { label: "Unsubscribe" }]} />

      <div className="mt-8 rounded-lg border bg-white p-8 text-center">
        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-blue-600" />
            <p className="text-muted-foreground">Processing...</p>
          </div>
        )}
        {status === "success" && (
          <div className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-xl font-bold">{message}</h1>
            <p className="text-sm text-muted-foreground">We're sorry to see you go.</p>
          </div>
        )}
        {status === "error" && (
          <div className="space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-red-600">{message}</h1>
          </div>
        )}
      </div>
    </div>
  );
}
