import { Shield, Truck, RefreshCw, Headphones } from "lucide-react";

export function TrustBadges() {
  const badges = [
    { icon: Shield,      label: "Secure Payment",   sub: "256-bit SSL encrypted",  iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconColor: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-800" },
    { icon: Truck,       label: "Instant Delivery",  sub: "Digital key via email",  iconBg: "bg-blue-100 dark:bg-blue-900/40",     iconColor: "text-blue-600 dark:text-blue-400",     border: "border-blue-200 dark:border-blue-800"     },
    { icon: RefreshCw,   label: "Money-Back",        sub: "30-day guarantee",       iconBg: "bg-amber-100 dark:bg-amber-900/40",   iconColor: "text-amber-600 dark:text-amber-400",   border: "border-amber-200 dark:border-amber-800"   },
    { icon: Headphones,  label: "24/7 Support",      sub: "Live chat & email",      iconBg: "bg-violet-100 dark:bg-violet-900/40", iconColor: "text-violet-600 dark:text-violet-400", border: "border-violet-200 dark:border-violet-800" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((b) => (
        <div
          key={b.label}
          className={`flex items-center gap-2.5 p-3 rounded-lg border ${b.border} bg-white dark:bg-muted/20`}
        >
          <div className={`${b.iconBg} rounded-lg p-1.5 shrink-0`}>
            <b.icon className={`h-4 w-4 ${b.iconColor}`} />
          </div>
          <div>
            <div className="text-xs font-semibold">{b.label}</div>
            <div className="text-[10px] text-muted-foreground">{b.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
