import {
  EVENT_ICON, PHASE_COLOR, getPhase, eventLabel, SNAPSHOT_ICON,
  type JourneyEvent, type JourneySnapshot,
} from "./customer-journey-types";

interface TimelineRow {
  kind: "event" | "snapshot";
  ts: number;
  event?: JourneyEvent;
  snapshot?: JourneySnapshot;
}

function buildRows(events: JourneyEvent[], snapshots: JourneySnapshot[]): TimelineRow[] {
  const rows: TimelineRow[] = [
    ...events.map((e) => ({ kind: "event" as const, ts: new Date(e.occurredAt).getTime(), event: e })),
    ...snapshots.map((s) => ({ kind: "snapshot" as const, ts: new Date(s.capturedAt).getTime(), snapshot: s })),
  ];
  rows.sort((a, b) => a.ts - b.ts);
  return rows;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface Props {
  events: JourneyEvent[];
  snapshots: JourneySnapshot[];
  selectedEventId: number | null;
  onSelectEvent: (id: number) => void;
}

export function CustomerJourneyTimeline({ events, snapshots, selectedEventId, onSelectEvent }: Props) {
  const rows = buildRows(events, snapshots);

  return (
    <div className="relative">
      {/* vertical connector line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-500/30 via-[#2e3340] to-emerald-500/30" />

      <ul className="relative space-y-1.5">
        {rows.map((r, i) => {
          if (r.kind === "snapshot" && r.snapshot) {
            const sn = r.snapshot;
            const Icon = SNAPSHOT_ICON;
            const c = PHASE_COLOR.exit;
            return (
              <li key={`s${sn.id}`} className="relative flex items-center gap-3 pl-1">
                <div className={`relative z-10 h-7 w-7 shrink-0 rounded-full ring-2 ${c.ring} ${c.bg} flex items-center justify-center backdrop-blur`}>
                  <Icon className={`h-3.5 w-3.5 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0 rounded border border-[#1f2840] bg-[#0c1018]/60 px-2.5 py-1.5 text-[11px] text-[#8fa0bb]">
                  <span className="font-mono tabular-nums text-[#dde4f0]">{sn.items.length}</span>
                  <span className="mx-1.5">items</span>
                  <span className="font-mono tabular-nums text-[#dde4f0]">{sn.totals.totalUsd}</span>
                  <span className="ml-1 text-[#5a6a84]">{sn.totals.currency}</span>
                  <span className="ml-2 text-[10px] text-[#5a6a84]">snapshot · {sn.triggerEvent}</span>
                </div>
              </li>
            );
          }
          if (!r.event) return null;
          const ev = r.event;
          const phase = getPhase(ev.eventType);
          const c = PHASE_COLOR[phase];
          const Icon = EVENT_ICON[ev.eventType] ?? EVENT_ICON.page_view;
          const selected = selectedEventId === ev.id;

          return (
            <li key={`e${ev.id}`}>
              <button
                onClick={() => onSelectEvent(ev.id)}
                className={`group relative w-full flex items-start gap-3 pl-1 py-1.5 pr-2 rounded transition-colors ${
                  selected ? "bg-[#1a2235]" : "hover:bg-[#0f1623]"
                }`}
              >
                <div className={`relative z-10 h-7 w-7 shrink-0 rounded-full ring-2 ${c.ring} ${c.bg} flex items-center justify-center transition-transform group-hover:scale-110 ${selected ? `shadow-lg ${c.glow}` : ""}`}>
                  <Icon className={`h-3.5 w-3.5 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-[12.5px] font-medium ${selected ? "text-white" : "text-[#dde4f0]"} leading-tight`}>
                    {eventLabel(ev.eventType)}
                  </p>
                  <p className="text-[10.5px] text-[#5a6a84] mt-0.5 truncate">
                    {ev.pagePath && <span className="font-mono">{ev.pagePath}</span>}
                    {ev.pagePath ? " · " : ""}
                    {fmtTime(ev.occurredAt)}
                  </p>
                </div>
                {selected && (
                  <div className={`shrink-0 self-center h-1.5 w-1.5 rounded-full ${c.dot}`} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
