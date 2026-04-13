import type { ReactNode } from "react";
import { TopBar } from "./top-bar";
import { NavBar } from "./nav-bar";
import { Footer } from "./footer";
import { LiveChatWidget } from "./live-chat-widget";
import { CompareBar } from "@/components/compare/compare-bar";
import { FlashSaleBanner } from "@/components/flash-sale/flash-sale-banner";
import { BackToTop } from "@/components/ui/back-to-top";

interface SiteLayoutProps {
  children: ReactNode;
}

export function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <FlashSaleBanner />
      <div className="sticky top-0 z-40">
        <TopBar />
        <NavBar />
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
      <LiveChatWidget />
      <CompareBar />
      <BackToTop />
    </div>
  );
}
