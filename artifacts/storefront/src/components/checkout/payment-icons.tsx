import { Lock } from "lucide-react";

export function CardPaymentIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden="true">
      <rect x="4" y="10" width="40" height="28" rx="5" fill="#3b82f6" opacity="0.15" />
      <rect x="4" y="10" width="40" height="28" rx="5" stroke="#3b82f6" strokeWidth="2.2" />
      <rect x="4" y="17" width="40" height="7" fill="#3b82f6" opacity="0.25" />
      <rect x="10" y="27" width="9" height="7" rx="2" fill="#3b82f6" opacity="0.4" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="14.5" y1="27" x2="14.5" y2="34" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
      <line x1="10" y1="30.5" x2="19" y2="30.5" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
      {[25, 30, 35].map((x) => <circle key={x} cx={x} cy="31" r="1.5" fill="#3b82f6" opacity="0.5" />)}
      <path d="M32 26 a6 6 0 0 1 0 6" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <path d="M35 23 a10 10 0 0 1 0 12" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
      <circle cx="40" cy="12" r="5" fill="#0a1e3d" />
      <rect x="38" y="12" width="4" height="3.5" rx="0.8" fill="#3b82f6" />
      <path d="M38.5 12v-1.2a1.5 1.5 0 0 1 3 0V12" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function VisaIcon() {
  return (
    <div className="bg-white rounded px-1.5 py-0.5 flex items-center">
      <svg viewBox="0 0 38 12" fill="none" className="h-3 w-auto">
        <text x="0" y="10" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#1434CB">VISA</text>
      </svg>
    </div>
  );
}

export function MastercardIcon() {
  return (
    <div className="flex items-center gap-0">
      <div className="w-5 h-5 rounded-full bg-red-500 opacity-90" style={{ marginRight: -6 }} />
      <div className="w-5 h-5 rounded-full bg-amber-400 opacity-90" />
    </div>
  );
}

export function AmexIcon() {
  return (
    <div className="bg-blue-500 rounded px-1.5 py-0.5 flex items-center">
      <svg viewBox="0 0 40 12" fill="none" className="h-3 w-auto">
        <text x="0" y="10" fontFamily="Arial" fontWeight="bold" fontSize="9" fill="white" letterSpacing="0.5">AMEX</text>
      </svg>
    </div>
  );
}

export function CardPaymentSection() {
  return (
    <div className="relative rounded-xl overflow-hidden border" style={{ background: "linear-gradient(135deg, #0a1e3d 0%, #0d2a54 60%, #0a1e3d 100%)", borderColor: "#ffffff15" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 80% 50%, #3b82f615, transparent)" }} />
      <div className="relative p-4 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 shrink-0"><CardPaymentIcon /></div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Secure Card Payment</p>
            <p className="text-[11px] text-white/50 mt-0.5 flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> via Stripe</p>
          </div>
        </div>
        <p className="text-xs text-white/55 mb-3 leading-relaxed">Redirected to Stripe's encrypted payment page. Your card details are never stored on our servers.</p>
        <div className="flex items-center gap-2 mt-auto"><VisaIcon /><MastercardIcon /><AmexIcon /></div>
      </div>
    </div>
  );
}
