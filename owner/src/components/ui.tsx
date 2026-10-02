import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

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
    <div className="relative overflow-hidden bg-zinc-900 border border-white/5 rounded-2xl p-4 sm:p-5 active:scale-[0.99] transition-transform">
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${bg} ${accent} flex items-center justify-center`}
        >
          <Icon size={20} />
        </div>
        {change !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-[11px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg ${
              up
                ? "text-green-400 bg-green-500/10"
                : down
                  ? "text-red-400 bg-red-500/10"
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
    <div
      className={`bg-zinc-900 border border-white/5 rounded-2xl p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between mb-3.5 sm:mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-[15px] sm:text-base">
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

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
      <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-zinc-700 mb-3" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800 rounded ${className}`} />;
}
