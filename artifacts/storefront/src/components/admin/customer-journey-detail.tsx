import { Package } from "lucide-react";
import {
  EVENT_ICON, PHASE_COLOR, PHASE_LABEL, getPhase, eventLabel, snapshotForEvent,
  type JourneyEvent, type JourneySnapshot,
} from "./customer-journey-types";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <p className="text-[11px] text-[#5a6a84] italic">No metadata captured.</p>;
  }
  return (
    <pre className="rounded border border-[#1f2840] bg-[#0a0d12] px-3 py-2 font-mono text-[10.5px] text-[#a8d4f5] whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
{JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

function CartInspector({ snapshot }: { snapshot: JourneySnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="rounded border border-dashed border-[#2e3340] bg-[#0c1018]/40 px-3 py-6 text-center">
        <Package className="mx-auto h-5 w-5 text-[#3d5070]" />
        <p className="mt-1.5 text-[11px] text-[#5a6a84]">Cart was empty at this point in time.</p>
      </div>
    );
  }
  const totals = snapshot.totals;
  return (
    <div className="rounded border border-[#1f2840] bg-[#0c1018]/60 overflow-hidden">
      <div className="border-b border-[#1f2840] bg-[#0f1623] px-3 py-1.5 flex items-baseline justify-between">
        <span className="text-[10.5px] uppercase tracking-widest text-[#8fa0bb] font-bold">Cart at this moment</span>
        <span className="text-[10.5px] text-[#5a6a84]">trigger: {snapshot.triggerEvent}</span>
      </div>
      <ul className="divide-y divide-[#1f2840]">
        {snapshot.items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5 px-3 py-2">
            <div className="h-9 w-9 shrink-0 rounded border border-[#1f2840] bg-[#0a0d12] overflow-hidden flex items-center justify-center">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Package className="h-4 w-4 text-[#3d5070]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-medium text-[#dde4f0] truncate">{item.productName}</p>
              <p className="text-[10.5px] text-[#5a6a84] truncate">{item.variantName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-mono tabular-nums text-[#dde4f0]">€{item.priceUsd}</p>
              <p className="text-[10px] text-[#5a6a84]">×{item.quantity}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-[#1f2840] bg-[#0f1623] px-3 py-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between text-[#8fa0bb]">
          <span>Subtotal</span>
          <span className="font-mono tabular-nums">{totals.subtotalUsd} {totals.currency}</span>
        </div>
        {parseFloat(totals.discountUsd) > 0 && (
          <div className="flex justify-between text-emerald-400/80">
            <span>Discount{totals.couponCode ? ` (${totals.couponCode})` : ""}</span>
            <span className="font-mono tabular-nums">−{totals.discountUsd}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-white pt-1 border-t border-[#1f2840]">
          <span>Total</span>
          <span className="font-mono tabular-nums">{totals.totalUsd} {totals.currency}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  selectedEvent: JourneyEvent | null;
  snapshots: JourneySnapshot[];
}

export function CustomerJourneyDetail({ selectedEvent, snapshots }: Props) {
  if (!selectedEvent) {
    return (
      <div className="rounded border border-dashed border-[#2e3340] bg-[#0c1018]/40 px-4 py-12 text-center">
        <p className="text-[12px] text-[#5a6a84]">Click any event in the timeline to inspect details and the cart at that moment.</p>
      </div>
    );
  }

  const phase = getPhase(selectedEvent.eventType);
  const c = PHASE_COLOR[phase];
  const Icon = EVENT_ICON[selectedEvent.eventType] ?? EVENT_ICON.page_view;
  const cart = snapshotForEvent(selectedEvent, snapshots);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className={`rounded border ${c.ring.replace("ring-", "border-")} ${c.bg} px-3 py-2.5`}>
        <div className="flex items-start gap-2.5">
          <div className={`h-9 w-9 shrink-0 rounded-full ring-2 ${c.ring} bg-[#0a0d12] flex items-center justify-center shadow-md ${c.glow}`}>
            <Icon className={`h-4.5 w-4.5 ${c.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-bold ${c.text}`}>{eventLabel(selectedEvent.eventType)}</p>
            <p className="text-[11px] text-[#8fa0bb] mt-0.5">
              <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-wider font-bold mr-2 ${c.bg} ${c.text} ring-1 ${c.ring}`}>{PHASE_LABEL[phase]}</span>
              {fmtDate(selectedEvent.occurredAt)}
            </p>
            {selectedEvent.pagePath && (
              <p className="text-[11px] text-[#5a6a84] mt-1 font-mono truncate">{selectedEvent.pagePath}</p>
            )}
          </div>
        </div>
      </div>

      {/* Cart inspector */}
      <CartInspector snapshot={cart} />

      {/* Metadata */}
      <div>
        <p className="text-[10.5px] uppercase tracking-widest text-[#8fa0bb] font-bold mb-1">Metadata</p>
        <MetadataPanel metadata={selectedEvent.metadata} />
      </div>
    </div>
  );
}
