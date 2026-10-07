import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-line-strong bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[52em] min-w-0 flex-col gap-1.5">
          <h2>{title}</h2>
          {description && (
            <p className="caption-style text-subtle leading-[1.4]">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </section>
  );
}

export function Footnote({ children }: { children: ReactNode }) {
  return (
    <div className="caption-style text-subtle border-line-strong border-t pt-3 leading-[1.4]">
      {children}
    </div>
  );
}

export function Swatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-[3px]", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function Meter({
  label,
  detail,
  value,
  share,
  color,
}: {
  label: string;
  detail?: string;
  value: string;
  share: number;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="caption-style flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          {label}
          {detail && <span className="text-subtle"> · {detail}</span>}
        </span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div aria-hidden className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, share * 100))}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export const numberInputClass =
  "[appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
