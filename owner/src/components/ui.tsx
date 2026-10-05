import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight, Minus, Inbox } from "lucide-react";

/** 数字滚动（尊重 prefers-reduced-motion） */
function useCountUp(target: number | undefined) {
  const [n, setN] = useState(target ?? 0);
  const prev = useRef(0);

  useEffect(() => {
    if (target === undefined) return;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = prev.current;
    const to = target;
    prev.current = to;
    if (reduce || from === to) {
      setN(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 650;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setN(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return n;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  valueNum,
  format = (n: number) => String(Math.round(n)),
  sub,
  change,
  accent = "text-orange-400",
  bg = "bg-orange-500/10",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  valueNum?: number;
  format?: (n: number) => string;
  sub?: string;
  change?: number;
  accent?: string;
  bg?: string;
  /** 数据框点击直达对应页面（首页即导航） */
  onClick?: () => void;
}) {
  const up = (change ?? 0) > 0.05;
  const down = (change ?? 0) < -0.05;
  const anim = useCountUp(valueNum);
  const display = valueNum !== undefined ? format(anim ?? 0) : value;
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`card-surface p-4 sm:p-5 transition-all duration-200 overflow-hidden ${
        onClick
          ? "cursor-pointer hover:border-orange-500/30 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-20px_rgba(0,0,0,0.9)]"
          : "hover:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-10 h-10 sm:w-10 sm:h-10 rounded-xl ${bg} ${accent} flex items-center justify-center ring-1 ring-white/5`}
        >
          <Icon size={19} />
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
      <div className="text-zinc-400 text-xs sm:text-[13px] mt-3 sm:mt-4">
        {label}
      </div>
      <div
        className={`tnum font-serif text-2xl sm:text-3xl font-bold mt-0.5 ${accent}`}
      >
        {display}
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
          <h3 className="font-serif text-white font-semibold text-[15px] sm:text-base tracking-tight">
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

export function EmptyState({
  text,
  hint,
  action,
}: {
  text: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-zinc-600">
      <div className="relative w-16 h-16 flex items-center justify-center mb-3.5">
        <span className="absolute inset-0 rounded-full border border-dashed border-orange-500/30" />
        <span className="w-11 h-11 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center shadow-[0_10px_24px_-16px_rgba(234,88,12,0.9)]">
          <Inbox size={20} className="text-orange-500" />
        </span>
      </div>
      <span className="text-sm text-zinc-500">{text}</span>
      {hint && <span className="text-xs text-zinc-600 mt-1">{hint}</span>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-zinc-800/60 via-zinc-700/70 to-zinc-800/60 bg-[length:200%_100%] ${className}`}
    />
  );
}

/** 排行/记录列表占位（与真实行结构一致：序号 + 名称 + 数值） */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 bg-zinc-950 rounded-xl px-3 py-2.5"
        >
          <Skeleton className="h-6 w-6 shrink-0 rounded-lg" />
          <Skeleton className="h-3.5 flex-1 max-w-[45%]" />
          <div className="ml-auto flex items-center gap-4 shrink-0">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3.5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 图表占位（柱状剪影 + 轴标签） */
export function SkeletonChart({ h = "h-40" }: { h?: string }) {
  const heights = [42, 68, 55, 88, 72, 48, 62, 36, 78, 58];
  return (
    <div className={`${h} flex flex-col`}>
      <div className="flex-1 flex items-end gap-1.5 sm:gap-2 px-1">
        {heights.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-md animate-pulse bg-gradient-to-r from-zinc-800/60 via-zinc-700/70 to-zinc-800/60"
            style={{ height: `${v}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2 px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-7" />
        ))}
      </div>
    </div>
  );
}

/** 订单表格/卡片占位（移动端卡片 + 桌面表格） */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="sm:hidden space-y-2.5">
        {Array.from({ length: Math.min(rows, 3) }).map((_, i) => (
          <div key={i} className="card-surface p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="space-y-2 items-end flex flex-col">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block card-surface overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16 ml-auto" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14 ml-auto" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-white/5 last:border-0"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-10 ml-auto" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
