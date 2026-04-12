import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionVariant = "default" | "muted" | "card";

export function PageSection({
  variant = "default",
  className,
  children,
  "aria-labelledby": labelledBy,
}: {
  variant?: SectionVariant;
  className?: string;
  children: ReactNode;
  "aria-labelledby"?: string;
}) {
  return (
    <section
      className={cn(
        variant === "muted" && "rounded-2xl bg-muted/45 px-4 py-5 md:px-6 md:py-6",
        variant === "card" &&
          "rounded-2xl border border-border/70 bg-card/80 px-4 py-5 shadow-sm md:px-6 md:py-6",
        className,
      )}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  id?: string;
  className?: string;
}) {
  return (
    <header className={cn("mb-4", subtitle ? "max-w-3xl" : "", className)}>
      {eyebrow ? (
        <p id={id ? `${id}-eyebrow` : undefined} className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className="text-lg font-bold tracking-tight text-foreground md:text-xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </header>
  );
}
