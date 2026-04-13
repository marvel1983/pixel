import { useLayoutEffect } from "react";
import { useLocation } from "wouter";

/** Nav link /new-arrivals → shop with newest-first (default API sort). */
export default function NewArrivalsRedirect() {
  const [, setLocation] = useLocation();
  useLayoutEffect(() => {
    setLocation("/shop?sort=newest", { replace: true });
  }, [setLocation]);
  return null;
}
