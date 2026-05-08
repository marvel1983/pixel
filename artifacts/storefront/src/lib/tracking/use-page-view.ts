import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { track } from "./client";

export function usePageViewTracker(): void {
  const [location] = useLocation();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === location) return;
    last.current = location;
    track("page_view", { path: location });
  }, [location]);
}
