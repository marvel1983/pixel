import { Shield, Truck, RefreshCw, Headphones } from "lucide-react";

export function TrustBadges() {
  const badges = [
    { icon: Shield, label: "Secure Payment", sub: "256-bit SSL encrypted" },
    { icon: Truck, label: "Instant Delivery", sub: "Digital key via email" },
    { icon: RefreshCw, label: "Money-Back", sub: "30-day guarantee" },
    { icon: Headphones, label: "24/7 Support", sub: "Live chat & email" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((b) => (
        <div
          key={b.label}
          className="flex items-center gap-2.5 p-3 rounded-lg border bg-muted/30"
        >
          <b.icon className="h-5 w-5 text-primary shrink-0" />
          <div>
            <div className="text-xs font-semibold">{b.label}</div>
            <div className="text-[10px] text-muted-foreground">{b.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
