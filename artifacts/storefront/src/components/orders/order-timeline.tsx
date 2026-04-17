import { ShoppingCart, Clock, CheckCircle, XCircle, PackageOpen } from "lucide-react";

interface Step {
  key: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const STEPS: Step[] = [
  { key: "PENDING",    label: "Order Placed",  icon: ShoppingCart },
  { key: "PROCESSING", label: "Processing",     icon: Clock },
  { key: "COMPLETED",  label: "Delivered",      icon: CheckCircle },
];

const ERROR_STATUSES = new Set(["FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]);
const BACKORDER_STATUSES = new Set(["BACKORDERED", "PARTIALLY_DELIVERED"]);

function getStepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  // If status is not a known step key (e.g. already COMPLETED), return last index.
  return idx === -1 ? STEPS.length - 1 : idx;
}

interface OrderTimelineProps {
  status: string;
}

export function OrderTimeline({ status }: OrderTimelineProps) {
  if (ERROR_STATUSES.has(status)) {
    return <ErrorTimeline status={status} />;
  }

  if (BACKORDER_STATUSES.has(status)) {
    return <BackorderTimeline status={status} />;
  }

  const currentIdx = getStepIndex(status);

  return (
    <div className="w-full">
      {/* ── Desktop: horizontal layout ──────────────────────────── */}
      <div className="hidden sm:flex items-center w-full">
        {STEPS.map((step, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step node */}
              <div className="flex flex-col items-center gap-1 min-w-[64px]">
                <StepCircle
                  icon={step.icon}
                  isDone={isDone}
                  isCurrent={isCurrent}
                />
                <span
                  className={`text-xs text-center leading-tight whitespace-nowrap ${
                    isDone
                      ? "text-emerald-600 font-medium"
                      : isCurrent
                        ? "text-primary font-semibold"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last step) */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                    isDone ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile: vertical layout ─────────────────────────────── */}
      <div className="flex flex-col gap-0 sm:hidden">
        {STEPS.map((step, idx) => {
          const isDone    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast    = idx === STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Left column: circle + vertical line */}
              <div className="flex flex-col items-center">
                <StepCircle
                  icon={step.icon}
                  isDone={isDone}
                  isCurrent={isCurrent}
                  size="sm"
                />
                {!isLast && (
                  <div
                    className={`w-0.5 h-6 mt-0.5 rounded-full ${
                      isDone ? "bg-emerald-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>

              {/* Right column: label */}
              <span
                className={`text-sm pt-0.5 pb-2 ${
                  isDone
                    ? "text-emerald-600 font-medium"
                    : isCurrent
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared circle node ──────────────────────────────────────────────────────

interface StepCircleProps {
  icon: React.FC<{ className?: string }>;
  isDone: boolean;
  isCurrent: boolean;
  size?: "md" | "sm";
}

function StepCircle({ icon: Icon, isDone, isCurrent, size = "md" }: StepCircleProps) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (isDone) {
    return (
      <div
        className={`${dim} rounded-full bg-emerald-500 flex items-center justify-center shrink-0`}
      >
        <CheckCircle className={`${iconDim} text-white`} />
      </div>
    );
  }

  if (isCurrent) {
    return (
      <div
        className={`${dim} rounded-full bg-primary flex items-center justify-center shrink-0 animate-pulse`}
      >
        <Icon className={`${iconDim} text-primary-foreground`} />
      </div>
    );
  }

  // Future step
  return (
    <div
      className={`${dim} rounded-full border-2 border-muted-foreground/30 bg-background flex items-center justify-center shrink-0`}
    >
      <Icon className={`${iconDim} text-muted-foreground/40`} />
    </div>
  );
}

// ── Error/cancelled state ───────────────────────────────────────────────────

const ERROR_LABELS: Record<string, string> = {
  FAILED:             "Order Failed",
  REFUNDED:           "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
};

function BackorderTimeline({ status }: { status: string }) {
  const isPartial = status === "PARTIALLY_DELIVERED";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-4 py-3">
      <PackageOpen className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {isPartial ? "Partially Delivered" : "Backordered"}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          {isPartial
            ? "Some keys have been delivered. Remaining keys are on backorder and will be emailed automatically once available."
            : "Your order is on backorder. We will deliver your keys automatically once the supplier ships stock."}
        </p>
      </div>
    </div>
  );
}

function ErrorTimeline({ status }: { status: string }) {
  const label = ERROR_LABELS[status] ?? status;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
      <XCircle className="h-5 w-5 text-destructive shrink-0" />
      <div>
        <p className="text-sm font-semibold text-destructive">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {status === "REFUNDED"
            ? "This order has been fully refunded."
            : status === "PARTIALLY_REFUNDED"
              ? "A partial refund has been issued for this order."
              : "There was a problem processing this order."}
        </p>
      </div>
    </div>
  );
}
