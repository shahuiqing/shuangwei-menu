import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ChartCard, Skeleton } from "./ui";
import { fmtMoney } from "../lib/format";
import {
  dailySeries,
  latestCompletedOrderAt,
  rangeToIso,
  type DailyPoint,
} from "../lib/aggregate";
import { businessDayKey } from "../lib/businessDay";
import { useChartTheme } from "../lib/theme";
import {
  buildMonthCells,
  monthBounds,
  fmtCompactMoney,
  revenueHeat,
  heatColor,
} from "../lib/settlementCalendar";

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];

/**
 * 日结日历：按月查看每天的营业额，点某天看当日结算明细。
 * 口径与看板「今日结」一致（营业日 03:00 起算，服务端聚合）。
 */
export function SettlementCalendar({ version = 0 }: { version?: number }) {
  const C = useChartTheme();
  const todayKey = businessDayKey(Date.now());
  const now = new Date();
  const [cursor, setCursor] = useState({
    y: now.getFullYear(),
    m: now.getMonth(),
  });
  const [rows, setRows] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const userPicked = useRef(false);

  const bounds = useMemo(
    () => monthBounds(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );

  // 首次打开定位到最近有已结账订单的月份，避免默认当月为空。
  useEffect(() => {
    let alive = true;
    (async () => {
      const at = await latestCompletedOrderAt();
      if (!alive) return;
      if (at && !userPicked.current) {
        const [y, m] = businessDayKey(new Date(at).getTime())
          .split("-")
          .map(Number);
        if (Number.isFinite(y) && Number.isFinite(m)) {
          setCursor({ y, m: m - 1 });
        }
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso("custom", bounds.from, bounds.to);
      const d = await dailySeries(b.start, b.end);
      if (!alive) return;
      setRows(d);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [ready, bounds.from, bounds.to, version]);

  const cells = useMemo(
    () => buildMonthCells(cursor.y, cursor.m, rows, todayKey),
    [cursor.y, cursor.m, rows, todayKey],
  );
  const byDay = useMemo(() => new Map(rows.map((r) => [r.day, r])), [rows]);
  const maxRev = useMemo(
    () => Math.max(0, ...rows.map((r) => r.revenue)),
    [rows],
  );
  const monthRevenue = useMemo(
    () => rows.reduce((s, r) => s + r.revenue, 0),
    [rows],
  );
  const monthOrders = useMemo(
    () => rows.reduce((s, r) => s + r.orders, 0),
    [rows],
  );
  const activeDays = useMemo(
    () => rows.filter((r) => r.revenue > 0).length,
    [rows],
  );

  const isThisMonth =
    cursor.y === now.getFullYear() && cursor.m === now.getMonth();
  const shift = (delta: number) => {
    userPicked.current = true;
    setSelected(null);
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const selCell = selected
    ? (cells.find((c) => c?.key === selected) ?? null)
    : null;
  const sel = selected ? byDay.get(selected) : undefined;

  return (
    <ChartCard
      id="settlement-calendar"
      title="日结日历"
      subtitle={`${cursor.y} 年 ${cursor.m + 1} 月 · 点日期看当日结算`}
      action={
        <div className="flex items-center gap-1">
          {!isThisMonth && (
            <button
              onClick={() => {
                userPicked.current = true;
                setSelected(null);
                setCursor({ y: now.getFullYear(), m: now.getMonth() });
              }}
              className="h-8 px-2 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              本月
            </button>
          )}
          <button
            onClick={() => shift(-1)}
            aria-label="上个月"
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors active:scale-90"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => shift(1)}
            aria-label="下个月"
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors active:scale-90"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-zinc-950 rounded-xl px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">本月营收</div>
          <div className="tnum font-serif text-[15px] sm:text-base font-bold text-orange-400 mt-0.5 truncate">
            {fmtMoney(monthRevenue)}
          </div>
        </div>
        <div className="bg-zinc-950 rounded-xl px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">营业天数</div>
          <div className="tnum font-serif text-[15px] sm:text-base font-bold text-zinc-100 mt-0.5">
            {activeDays}
            <span className="text-[11px] font-normal text-zinc-500"> 天</span>
          </div>
        </div>
        <div className="bg-zinc-950 rounded-xl px-3 py-2.5">
          <div className="text-[10px] text-zinc-500">订单数</div>
          <div className="tnum font-serif text-[15px] sm:text-base font-bold text-zinc-100 mt-0.5 truncate">
            {monthOrders}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[10px] ${
              i >= 5 ? "text-orange-400/60" : "text-zinc-600"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <Skeleton key={i} className="h-11 sm:h-12" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={`empty-${i}`} className="h-11 sm:h-12" />;
            const on = c.key === selected;
            const heat = revenueHeat(c.revenue, maxRev);
            return (
              <button
                key={c.key}
                onClick={() => setSelected(on ? null : c.key)}
                disabled={c.future}
                aria-label={`${cursor.m + 1} 月 ${c.day} 日${
                  c.hasData ? `，营收 ${fmtMoney(c.revenue)}` : "，无结算"
                }`}
                aria-pressed={on}
                className={`relative flex flex-col items-center justify-center rounded-lg h-11 sm:h-12 px-0.5 transition-colors ${
                  c.future
                    ? "text-zinc-700 cursor-default"
                    : on
                      ? "ring-2 ring-orange-500"
                      : c.today
                        ? "ring-1 ring-orange-500/70"
                        : "hover:bg-white/5 active:scale-95"
                }`}
                style={{
                  backgroundColor:
                    c.future || !c.hasData
                      ? undefined
                      : heatColor(C.brand, heat),
                }}
              >
                <span
                  className={`absolute top-1 left-1.5 text-[10px] leading-none ${
                    c.hasData ? "text-zinc-300 font-semibold" : "text-zinc-600"
                  }`}
                >
                  {c.day}
                </span>
                {c.hasData && (
                  <span className="tnum mt-2 text-[9px] sm:text-[10px] leading-none text-zinc-200">
                    {fmtCompactMoney(c.revenue)}
                  </span>
                )}
                {c.today && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-500" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {selCell ? (
        <div className="mt-3 rounded-xl bg-zinc-950 border border-white/5 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zinc-200 font-semibold">
              {cursor.m + 1} 月 {selCell.day} 日 · 结算
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="收起"
              className="w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
          {selCell.hasData ? (
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <div>
                <div className="text-[10px] text-zinc-500">营收</div>
                <div className="tnum font-serif text-base font-bold text-orange-400">
                  {fmtMoney(sel?.revenue || 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">订单</div>
                <div className="tnum font-serif text-base font-bold text-zinc-100">
                  {sel?.orders || 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500">客单价</div>
                <div className="tnum font-serif text-base font-bold text-teal-400">
                  {fmtMoney(sel?.orders ? sel.revenue / sel.orders : 0)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 mt-2">
              {selCell.future ? "尚未到这一天" : "当日无结算记录"}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 text-[11px] text-zinc-600 text-center">
          颜色越深表示当日营业额越高
        </div>
      )}
    </ChartCard>
  );
}
