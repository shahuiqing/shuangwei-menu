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
    <div className="relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-xl ${bg} ${accent} flex items-center justify-center`}
        >
          <Icon size={22} />
        </div>
        {change !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${
              up
                ? "text-green-400 bg-green-500/10"
                : down
                  ? "text-red-400 bg-red-500/10"
                  : "text-zinc-400 bg-zinc-800"
            }`}
          >
            {up ? (
              <ArrowUpRight size={13} />
            ) : down ? (
              <ArrowDownRight size={13} />
            ) : (
              <Minus size={13} />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-zinc-400 text-sm mt-4">{label}</div>
      <div className={`text-3xl font-black mt-1 ${accent}`}>{value}</div>
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
      className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 ${className}`}
    >
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
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
