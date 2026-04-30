import { useState } from "react";
import { Clock, CreditCard, Truck, Webhook, Key, AlertTriangle, UserCog, Circle } from "lucide-react";

interface Entry {
  event: string;
  date: string;
  kind?: string;
  details?: Record<string, unknown>;
}

interface Props {
  entries: Entry[];
}

const KIND_STYLE: Record<string, { ring: string; bg: string; iconColor: string; Icon: typeof Clock }> = {
  order:   { ring: "border-sky-500/40",     bg: "bg-sky-500/10",     iconColor: "text-sky-400",     Icon: Circle },
  payment: { ring: "border-emerald-500/40", bg: "bg-emerald-500/10", iconColor: "text-emerald-400", Icon: CreditCard },
  metenzi: { ring: "border-violet-500/40",  bg: "bg-violet-500/10",  iconColor: "text-violet-400",  Icon: Truck },
  webhook: { ring: "border-cyan-500/40",    bg: "bg-cyan-500/10",    iconColor: "text-cyan-400",    Icon: Webhook },
  key:     { ring: "border-amber-500/40",   bg: "bg-amber-500/10",   iconColor: "text-amber-400",   Icon: Key },
  alert:   { ring: "border-rose-500/40",    bg: "bg-rose-500/10",    iconColor: "text-rose-400",    Icon: AlertTriangle },
  manual:  { ring: "border-fuchsia-500/40", bg: "bg-fuchsia-500/10", iconColor: "text-fuchsia-400", Icon: UserCog },
};
const DEFAULT_STYLE = KIND_STYLE.order;

export function OrderTimeline({ entries }: Props) {
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-3">
      {entries.map((t, i) => {
        const style = t.kind ? (KIND_STYLE[t.kind] ?? DEFAULT_STYLE) : DEFAULT_STYLE;
        const { Icon } = style;
        const hasDetails = t.details && Object.keys(t.details).length > 0;
        return (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border ${style.ring} ${style.bg} flex items-center justify-center`}>
              <Icon className={`h-3 w-3 ${style.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-[#dde4f0]">{t.event}</p>
              <p className="text-[11px] text-[#5a6a84]">{new Date(t.date).toLocaleString()}</p>
              {hasDetails && (
                <button
                  onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                  className="mt-1 text-[10.5px] text-[#5b9fd4] hover:underline"
                >
                  {open[i] ? "Hide details" : "Show details"}
                </button>
              )}
              {hasDetails && open[i] && (
                <pre className="mt-1.5 rounded border border-[#2e3340] bg-[#0a0d12] px-2 py-1.5 font-mono text-[10.5px] text-[#a8d4f5] whitespace-pre-wrap break-all max-h-[180px] overflow-y-auto">
{JSON.stringify(t.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        );
      })}
      {entries.length === 0 && <p className="text-[12px] text-[#5a6a84]">No timeline activity recorded.</p>}
    </div>
  );
}
