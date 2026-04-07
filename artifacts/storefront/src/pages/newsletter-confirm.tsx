import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function NewsletterConfirmPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [discountCode, setDiscountCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { setStatus("error"); setMessage(t("newsletter.confirmationFailed")); return; }

    fetch(`${API}/newsletter/confirm?token=${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setStatus("success");
        setMessage(data.message);
        if (data.discountCode) setDiscountCode(data.discountCode);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : t("newsletter.confirmationFailed"));
      });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Breadcrumbs crumbs={[{ label: t("nav.support"), href: "/" }, { label: t("newsletter.confirmation") }]} />

      <div className="mt-8 rounded-lg border bg-white p-8 text-center">
        {status === "loading" && (
          <div className="space-y-3">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-blue-600" />
            <p className="text-muted-foreground">{t("common.loading")}</p>
          </div>
        )}
        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h1 className="text-xl font-bold">{message}</h1>
            {discountCode && (
              <div className="bg-green-50 rounded-lg p-4 mt-4">
                <p className="text-2xl font-bold text-green-700 tracking-widest">{discountCode}</p>
              </div>
            )}
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
