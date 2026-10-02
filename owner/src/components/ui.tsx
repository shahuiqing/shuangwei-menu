import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight, Minus, Inbox } from "lucide-react";

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  change,
  accent = "text-orange-400",
  bg = "bg-orange-500/10",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  change?: number;
  accent?: string;
  bg?: string;
}) {
  const up = (change ?? 0) > 0.05;
  const down = (change ?? 0) < -0.05;
  return (
    <div className="card-surface p-4 sm:p-5 active:scale-[0.99] transition-all duration-200 overflow-hidden hover:border-white/10">
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl ${bg} ${accent} flex items-center justify-center ring-1 ring-white/5`}
        >
          <Icon size={20} />
        </div>
        {change !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full ${
              up
                ? "text-emerald-400 bg-emerald-500/10"
                : down
                  ? "text-rose-400 bg-rose-500/10"
                  : "text-zinc-400 bg-zinc-800"
            }`}
          >
            {up ? (
              <ArrowUpRight size={12} />
            ) : down ? (
              <ArrowDownRight size={12} />
            ) : (
              <Minus size={12} />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-zinc-400 text-xs sm:text-sm mt-3 sm:mt-4">
        {label}
      </div>
      <div className={`tnum text-2xl sm:text-3xl font-black mt-0.5 ${accent}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card-surface p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between mb-3.5 sm:mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-[15px] sm:text-base tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-zinc-600">
      <div className="relative w-16 h-16 flex items-center justify-center mb-3.5">
        <span className="absolute inset-0 rounded-full border border-dashed border-white/10" />
        <span className="w-11 h-11 rounded-2xl bg-gradient-to-b from-zinc-800/80 to-zinc-900 border border-white/[0.07] flex items-center justify-center shadow-[0_10px_24px_-16px_rgba(0,0,0,0.9)]">
          <Inbox size={20} className="text-zinc-500" />
        </span>
      </div>
      <span className="text-sm text-zinc-500">{text}</span>
      {hint && <span className="text-xs text-zinc-600 mt-1">{hint}</span>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-zinc-800/60 via-zinc-800 to-zinc-800/60 bg-[length:200%_100%] ${className}`}
    />
  );
}
