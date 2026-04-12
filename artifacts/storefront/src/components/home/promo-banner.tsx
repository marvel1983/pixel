import { Link } from "wouter";
import { Zap, ShieldCheck, Clock, ArrowRight } from "lucide-react";

const PILLS = [
  { icon: ShieldCheck, text: "Genuine retail keys — same as boxed software" },
  { icon: Zap, text: "Instant email delivery, any time of day" },
  { icon: Clock, text: "30-day support guarantee" },
];

export function PromoBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#0a1628] via-[#0d2346] to-[#0f2d5c] px-6 py-5">
      {/* grid bg */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* glow */}
      <div className="absolute right-0 top-0 h-40 w-60 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          {PILLS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 border border-white/15">
                <Icon className="h-3.5 w-3.5 text-blue-300" />
              </div>
              <span className="text-sm text-white/80">{text}</span>
            </div>
          ))}
        </div>
        <Link href="/shop">
          <button className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-white/90 transition-colors">
            Shop now <ArrowRight className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </div>
  );
}
