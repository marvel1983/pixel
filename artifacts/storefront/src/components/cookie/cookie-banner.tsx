import { useEffect } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCookieConsentStore } from "@/stores/cookie-consent-store";
import { CookiePreferencesModal } from "./cookie-preferences-modal";

export function CookieBanner() {
  const { showBanner, showModal, acceptAll, rejectAll, openModal, loadFromCookie } = useCookieConsentStore();

  useEffect(() => {
    loadFromCookie();
  }, []);

  if (!showBanner && !showModal) return null;

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
          <div className="container mx-auto max-w-4xl">
            <div className="bg-white border rounded-xl shadow-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 rounded-lg bg-blue-50 shrink-0 mt-0.5">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">We value your privacy</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We use cookies to enhance your browsing experience, serve personalized content, and analyze
                    our traffic. By clicking "Accept All", you consent to our use of cookies.{" "}
                    <a href="/privacy" className="underline text-primary hover:text-primary/80">Privacy Policy</a>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={rejectAll} className="flex-1 sm:flex-none">
                  Reject All
                </Button>
                <Button variant="outline" size="sm" onClick={openModal} className="flex-1 sm:flex-none">
                  Customize
                </Button>
                <Button size="sm" onClick={acceptAll} className="flex-1 sm:flex-none">
                  Accept All
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && <CookiePreferencesModal />}
    </>
  );
}
