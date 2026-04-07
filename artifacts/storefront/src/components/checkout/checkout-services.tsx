import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Zap, ShieldCheck, Clock, Headphones, Shield, Check, Info } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface CheckoutService {
  id: number;
  name: string;
  description: string;
  shortDescription: string;
  priceUsd: string;
  icon: string;
}

const iconMap: Record<string, React.ElementType> = {
  zap: Zap,
  "shield-check": ShieldCheck,
  clock: Clock,
  headphones: Headphones,
  shield: Shield,
};

interface Props {
  selectedIds: number[];
  onToggle: (id: number, price: number) => void;
}

export function CheckoutServices({ selectedIds, onToggle }: Props) {
  const { t } = useTranslation();
  const [services, setServices] = useState<CheckoutService[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { format } = useCurrencyStore();

  useEffect(() => {
    fetch(`${API}/checkout-services`)
      .then((r) => r.json())
      .then((d) => setServices(d.services || []))
      .catch(() => {});
  }, []);

  if (services.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">{t("checkout.additionalServices")}</h3>
      <p className="text-sm text-muted-foreground">{t("checkout.enhancePurchase")}</p>
      <div className="grid gap-2">
        {services.map((svc) => {
          const selected = selectedIds.includes(svc.id);
          const Icon = iconMap[svc.icon] || Shield;
          const price = parseFloat(svc.priceUsd);
          return (
            <div key={svc.id} className={`border rounded-lg p-3 cursor-pointer transition-all ${selected ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-200" : "border-border hover:border-muted-foreground/30"}`}>
              <div className="flex items-center gap-3" onClick={() => onToggle(svc.id, price)}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selected ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{svc.name}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === svc.id ? null : svc.id); }}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{svc.shortDescription}</p>
                </div>
                <span className="text-sm font-semibold whitespace-nowrap">{format(price)}</span>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"}`}>
                  {selected && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
              {expandedId === svc.id && (
                <p className="text-xs text-muted-foreground mt-2 ml-[52px] leading-relaxed">{svc.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function getServicesTotal(selectedIds: number[], services: { id: number; priceUsd: string }[]): number {
  return selectedIds.reduce((sum, id) => {
    const svc = services.find((s) => s.id === id);
    return sum + (svc ? parseFloat(svc.priceUsd) : 0);
  }, 0);
}
