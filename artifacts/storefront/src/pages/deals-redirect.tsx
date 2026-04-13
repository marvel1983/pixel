import { useLayoutEffect } from "react";
import { useLocation } from "wouter";

/** Nav link /deals → hot offers listing. */
export default function DealsRedirect() {
  const [, setLocation] = useLocation();
  useLayoutEffect(() => {
    setLocation("/hot-offers", { replace: true });
  }, [setLocation]);
  return null;
}
