import { useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/stores/auth-store";

/** GET-style legacy URLs: perform navigation client-side. */
export function RedirectTo({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useLayoutEffect(() => {
    setLocation(to, { replace: true });
  }, [setLocation, to]);
  return null;
}

/** Some bookmarks hit `/logout` as a page; still clear session like the menu action. */
export function LogoutRoute() {
  const logout = useAuthStore((s) => s.logout);
  const [, setLocation] = useLocation();
  useLayoutEffect(() => {
    logout();
    setLocation("/", { replace: true });
  }, [logout, setLocation]);
  return null;
}

export function ToAboutUs() {
  return <RedirectTo to="/about-us" />;
}
export function ToPrivacyPolicy() {
  return <RedirectTo to="/privacy-policy" />;
}
export function ToCookiePolicy() {
  return <RedirectTo to="/cookie-policy" />;
}
export function ToOrderLookup() {
  return <RedirectTo to="/order-lookup" />;
}
export function ToAffiliates() {
  return <RedirectTo to="/affiliates" />;
}
/** Footer linked `/how-to-activate`; CMS seed uses `how-to-buy` — keep both working. */
export function ToHowToBuy() {
  return <RedirectTo to="/how-to-buy" />;
}
