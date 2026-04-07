import type { ReactNode } from "react";
import { TopBar } from "./top-bar";
import { NavBar } from "./nav-bar";
import { Footer } from "./footer";
import { LiveChatWidget } from "./live-chat-widget";
import { CompareBar } from "@/components/compare/compare-bar";
import { FlashSaleBanner } from "@/components/flash-sale/flash-sale-banner";

interface SiteLayoutProps {
  children: ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <FlashSaleBanner />
      <TopBar />
      <NavBar />
      <main className="flex-1">{children}</main>
      <Footer />
      <LiveChatWidget />
      <CompareBar />
    </div>
  );
}
