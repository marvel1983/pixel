import { useEffect, useState } from "react";
import { Clock, Wrench, Mail } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface MaintenanceInfo {
  maintenance: boolean;
  message: string;
  estimate: string | null;
}

export function useMaintenanceCheck() {
  const [info, setInfo] = useState<MaintenanceInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch(`${API}/maintenance-status`)
      .then((r) => r.json())
      .then((d) => { setInfo(d); setChecked(true); })
      .catch(() => setChecked(true));
  }, []);

  return { info, checked };
}

export function MaintenancePage({ message, estimate }: { message: string; estimate?: string | null }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0a0f1e]">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full mx-auto px-6 text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
            <span className="text-white font-bold text-sm">PC</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">PixelCodes</span>
        </div>

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600/15 border border-blue-500/20 mx-auto shadow-xl shadow-blue-600/10">
          <Wrench className="h-9 w-9 text-blue-400" />
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Maintenance in Progress
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            We'll be right back.
          </h1>
          <p className="text-[15px] text-white/55 leading-relaxed max-w-sm mx-auto">
            {message}
          </p>
        </div>

        {/* Estimate badge */}
        {estimate && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70">
            <Clock className="h-4 w-4 text-blue-400 shrink-0" />
            <span>Back online by <span className="font-semibold text-white">{estimate}</span></span>
          </div>
        )}

        {/* Progress bar animation */}
        <div className="w-48 mx-auto">
          <div className="h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full animate-[progress_3s_ease-in-out_infinite]" style={{ width: "60%" }} />
          </div>
        </div>

        {/* Support link */}
        <p className="text-xs text-white/30">
          Questions?{" "}
          <a href="mailto:support@pixelcodes.com" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition-colors">
            <Mail className="h-3 w-3" /> support@pixelcodes.com
          </a>
        </p>
      </div>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(80%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
