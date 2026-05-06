import type { ReactNode } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck, CreditCard, Ban } from "lucide-react";
import { Card, type PaymentAttemptEntry } from "./order-detail-ui";

interface TimelineItem {
  key: string;
  iconKey: "started" | "auth" | "captured" | "failed" | "canceled" | "requires_action" | "threeds";
  title: string;
  description?: string;
  occurredAt: string;
  body?: ReactNode;
  tone: "success" | "neutral" | "danger" | "warning" | "info";
}

const TONE: Record<TimelineItem["tone"], { dot: string; ring: string; text: string }> = {
  success: { dot: "bg-emerald-500", ring: "ring-emerald-500/30", text: "text-emerald-300" },
  neutral: { dot: "bg-zinc-500",    ring: "ring-zinc-500/30",    text: "text-zinc-300" },
  danger:  { dot: "bg-red-500",     ring: "ring-red-500/30",     text: "text-red-300" },
  warning: { dot: "bg-amber-500",   ring: "ring-amber-500/30",   text: "text-amber-300" },
  info:    { dot: "bg-sky-500",     ring: "ring-sky-500/30",     text: "text-sky-300" },
};

const ICON: Record<TimelineItem["iconKey"], typeof CheckCircle2> = {
  started:         CreditCard,
  auth:            CheckCircle2,
  captured:        CheckCircle2,
  failed:          XCircle,
  canceled:        Ban,
  requires_action: AlertTriangle,
  threeds:         ShieldCheck,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

function threeDsDescription(flow: string | null, version: string | null): string {
  const major = (version ?? "").split(".")[0] ?? "2";
  if (flow === "frictionless") {
    return `This transaction has been authenticated with 3D Secure ${major}. The customer was authenticated via a frictionless flow, without any additional input from them.`;
  }
  if (flow === "challenge") {
    return `This transaction has been authenticated with 3D Secure ${major}. The customer was authenticated via a challenge flow, and shown a challenge window from their bank.`;
  }
  return `This transaction was checked with 3D Secure ${major}.`;
}

function attemptToTimelineItems(a: PaymentAttemptEntry): TimelineItem[] {
  const items: TimelineItem[] = [];
  const evt = a.eventType ?? "";

  if (evt === "payment_intent.created" || (a.status === "PROCESSING" && evt === "")) {
    items.push({
      key: `${a.id}:started`,
      iconKey: "started",
      title: "Payment started",
      occurredAt: a.occurredAt,
      tone: "info",
    });
    return items;
  }

  if (a.status === "SUCCEEDED" || evt === "payment_intent.succeeded" || evt === "charge.succeeded") {
    if (a.threeDsResult) {
      items.push({
        key: `${a.id}:3ds`,
        iconKey: "threeds",
        title: "3D Secure authentication succeeded",
        description: threeDsDescription(a.threeDsAuthenticationFlow, a.threeDsVersion),
        occurredAt: a.occurredAt,
        tone: "success",
      });
    }
    items.push({
      key: `${a.id}:auth`,
      iconKey: "captured",
      title: a.amountUsd && a.currency
        ? `Payment authorised — ${a.currency} ${parseFloat(a.amountUsd).toFixed(2)}`
        : "Payment authorised",
      occurredAt: a.occurredAt,
      tone: "success",
      body: cardLine(a),
    });
    return items;
  }

  if (a.status === "FAILED" || evt === "payment_intent.payment_failed" || evt === "charge.failed") {
    items.push({
      key: `${a.id}:failed`,
      iconKey: "failed",
      title: "Payment failed",
      occurredAt: a.occurredAt,
      tone: "danger",
      body: failureBody(a),
    });
    return items;
  }

  if (a.status === "CANCELED" || evt === "payment_intent.canceled") {
    items.push({
      key: `${a.id}:canceled`,
      iconKey: "canceled",
      title: "Payment canceled",
      occurredAt: a.occurredAt,
      tone: "neutral",
    });
    return items;
  }

  if (a.status === "REQUIRES_ACTION" || evt === "payment_intent.requires_action") {
    items.push({
      key: `${a.id}:ra`,
      iconKey: "requires_action",
      title: "Customer authentication required",
      occurredAt: a.occurredAt,
      tone: "warning",
    });
    return items;
  }

  items.push({
    key: `${a.id}:processing`,
    iconKey: "started",
    title: "Payment processing",
    occurredAt: a.occurredAt,
    tone: "info",
  });
  return items;
}

function cardLine(a: PaymentAttemptEntry): ReactNode {
  if (!a.cardLast4) return null;
  const exp = a.cardExpMonth && a.cardExpYear ? `${String(a.cardExpMonth).padStart(2, "0")}/${a.cardExpYear}` : null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11.5px] text-[#8fa0bb] mt-1">
      <span className="capitalize text-[#dde4f0]">{a.cardBrand ?? "Card"}</span>
      <span className="font-mono">•••• {a.cardLast4}</span>
      {exp && <span className="text-[#5a6a84]">{exp}</span>}
      {a.cardFunding && <span className="text-[10px] uppercase tracking-widest text-[#5a6a84] bg-[#2a2e3a] px-1.5 py-0.5 rounded">{a.cardFunding}</span>}
      {a.cardCountry && <span className="text-[#5a6a84]">{a.cardCountry}</span>}
    </div>
  );
}

function failureBody(a: PaymentAttemptEntry): ReactNode {
  return (
    <div className="space-y-0.5 text-[11.5px] text-red-300 mt-1">
      {a.declineCode && <p>Network decline: <span className="font-mono font-semibold">{a.declineCode}</span></p>}
      {a.failureCode && a.failureCode !== a.declineCode && (
        <p>Stripe code: <span className="font-mono">{a.failureCode}</span></p>
      )}
      {a.failureMessage && <p className="opacity-90">{a.failureMessage}</p>}
      {a.outcomeSellerMessage && a.outcomeSellerMessage !== a.failureMessage && (
        <p className="opacity-75 italic">{a.outcomeSellerMessage}</p>
      )}
      {cardLine(a)}
    </div>
  );
}

export function PaymentAttemptsCard({ attempts }: { attempts: PaymentAttemptEntry[] }) {
  if (attempts.length === 0) {
    return (
      <Card title="Payment Timeline">
        <p className="text-[12px] text-[#5a6a84]">No payment attempts recorded.</p>
      </Card>
    );
  }

  const items: TimelineItem[] = attempts.flatMap(attemptToTimelineItems);
  items.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return (
    <Card title="Payment Timeline">
      <ol className="relative pl-6 space-y-3">
        <span className="absolute left-[7px] top-2 bottom-2 w-px bg-[#2e3340]" aria-hidden="true" />
        {items.map((item) => {
          const tone = TONE[item.tone];
          const Icon = ICON[item.iconKey];
          return (
            <li key={item.key} className="relative">
              <span className={`absolute -left-6 top-1 flex h-4 w-4 items-center justify-center rounded-full ${tone.dot} ring-2 ring-[#181c24]`}>
                <Icon className="h-2.5 w-2.5 text-white" />
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[12.5px] font-semibold ${tone.text}`}>{item.title}</span>
                  <span className="text-[10.5px] text-[#5a6a84]">{formatDate(item.occurredAt)}</span>
                </div>
                {item.description && <p className="text-[11.5px] text-[#8fa0bb]">{item.description}</p>}
                {item.body}
              </div>
            </li>
          );
        })}
      </ol>
      {attempts.some((a) => a.paymentIntentId) && (
        <div className="mt-3 pt-3 border-t border-[#2e3340] space-y-0.5 text-[10px] font-mono text-[#5a6a84]">
          {Array.from(new Set(attempts.map((a) => a.paymentIntentId).filter(Boolean))).map((pi) => (
            <p key={pi as string}>PI: {pi}</p>
          ))}
        </div>
      )}
    </Card>
  );
}
