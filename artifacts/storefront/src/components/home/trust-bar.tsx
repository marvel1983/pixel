import { useTranslation } from "react-i18next";
import { Mail, Lock, BadgeCheck, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    icon: Mail,
    titleKey: "home.trustInstant",
    subKey: "home.trustInstantSub",
    color: "#3b82f6",
  },
  {
    icon: Lock,
    titleKey: "home.trustSecure",
    subKey: "home.trustSecureSub",
    color: "#22c55e",
  },
  {
    icon: BadgeCheck,
    titleKey: "home.trustGenuine",
    subKey: "home.trustGenuineSub",
    color: "#f59e0b",
  },
  {
    icon: Headphones,
    titleKey: "home.trustSupport",
    subKey: "home.trustSupportSub",
    color: "#a855f7",
  },
] as const;

export function TrustBar({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-4 md:divide-y-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className,
      )}
      role="list"
      aria-label={t("home.trustBarAria")}
    >
      {ITEMS.map(({ icon: Icon, titleKey, subKey, color }) => (
        <div
          key={titleKey}
          role="listitem"
          className="group flex flex-1 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/40"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105"
            style={{ background: `${color}18`, border: `1px solid ${color}30` }}
          >
            <Icon style={{ color }} className="h-4 w-4" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight text-foreground">
              {t(titleKey)}
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {t(subKey)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
