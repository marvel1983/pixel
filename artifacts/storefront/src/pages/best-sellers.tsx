import { useLayoutEffect } from "react";
import { useLocation } from "wouter";

/** Nav link /best-sellers → shop sorted by popularity (reviews). */
export default function BestSellersRedirect() {
  const [, setLocation] = useLocation();
  useLayoutEffect(() => {
    setLocation("/shop?sort=popular", { replace: true });
  }, [setLocation]);
  return null;
}
