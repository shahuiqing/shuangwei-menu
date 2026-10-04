import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ReceiptText,
  Boxes,
  ShoppingCart,
  PackageX,
  ChevronRight,
  CircleCheck,
  Copy,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { ChartCard, EmptyState, KpiCard, SkeletonRows } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { toast } from "../components/Toast";
import { fmtMoney, fmtDateTime, STATUS_TEXT } from "../lib/format";
import {
  buildDishCategoryMap,
  orderTotal,
  isCancelled,
  orderTime,
  tableName,
  type RangeKey,
} from "../lib/analytics";
import {
  rangeToIso,
  salesSummary,
  dailySeries,
  dishStats,
  hourlySeries,
  fetchOrdersPage,
  type DailyPoint,
  type DishStat,
  type HourPoint,
} from "../lib/aggregate";
import {
  fetchInventory,
  fetchPurchases,
  fetchTransactions,
  lowStockItems,
  type InventoryItem,
} from "../lib/inventory";
import { buildPriceAlerts, flaggedAlerts } from "../lib/priceAlert";
import { todayWasteAmount } from "../lib/waste";
import { buildTodos } from "../lib/todo";
import { lateOrders, useLateConfig } from "../lib/lateOrders";
import { buildSummary, summaryLines, type SummaryInput } from "../lib/summary";
import type { OwnerTab } from "../components/Layout";
import { useChartTheme } from "../lib/theme";

const RANGE_LABEL: Record<string, string> = {
  today: "今天",
  "7d": "近 7 天",
  "30d": "近 30 天",
  all: "全部",
};

const COMPARE_LABEL: Record<string, string> = {
  today: "昨天",
  "7d": "上一周期",
  "30d": "上一周期",
  all: "上一周期",
};

/** 待办等级色（level → 主色） */
const LEVEL_COLOR: Record<string, string> = {
  high: "#ef4444",
  warn: "#f59e0b",
  info: "#38bdf8",
};

const PIE_COLORS = [
  "#fb923c",
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#fb7185",
  "#fbbf24",
  "#2dd4bf",
  "#f472b6",
];

const pct = (cur: number, prev: number) =>
  !prev ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

/** 剪贴板不可用（http/旧浏览器）时的兜底复制 */
function fallbackCopy(text: string, done: () => void) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) done();
    else toast.error("复制失败，请手动选择文本");
  } catch {
    toast.error("复制失败，请手动选择文本");
  }
}

export default function Dashboard({
  recentOrders,
  settings,
  version = 0,
  onTab,
}: {
  recentOrders: any[];
  settings: any;
  version?: number;
  onTab?: (t: OwnerTab) => void;
}) {
  const C = useChartTheme();
  const tooltipStyle = {
    background: C.tipBg,
    border: `1px solid ${C.tipBorder}`,
    borderRadius: 14,
    color: C.tipText,
    fontSize: 12,
    boxShadow: "0 12px 30px -12px rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)",
  };
  const [range, setRange] = useState<RangeKey>("today");
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({
    revenue: 0,
    orders: 0,
    aov: 0,
    items: 0,
    revenueChange: 0,
    ordersChange: 0,
    aovChange: 0,
  });
  const [trend, setTrend] = useState<DailyPoint[]>([]);
  const [hourly, setHourly] = useState<HourPoint[]>([]);
  const [dishes, setDishes] = useState<DishStat[]>([]);
  const [ops, setOps] = useState<{
    low: InventoryItem[];
    alerts: ReturnType<typeof flaggedAlerts>;
    todayWaste: number;
    pending: number;
    ready: boolean;
  }>({ low: [], alerts: [], todayWaste: 0, pending: 0, ready: false });

  /** 待办中心：库存/采购价/损耗/待接单，与主数据分开拉取 */
  useEffect(() => {
    let alive = true;
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const [inv, pur, wt, pg] = await Promise.all([
        fetchInventory(),
        fetchPurchases(300),
        fetchTransactions(300, "waste", todayStart.toISOString()),
        fetchOrdersPage({
          start: monthAgo,
          end: tomorrow,
          status: "pending",
          limit: 1,
        }),
      ]);
      if (!alive) return;
      setOps({
        low: lowStockItems(inv),
        alerts: flaggedAlerts(buildPriceAlerts(pur)),
        todayWaste: todayWasteAmount(wt),
        pending: pg.count,
        ready: true,
      });
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const [cur, prev, daily, dish, hours] = await Promise.all([
        salesSummary(b.start, b.end),
        salesSummary(b.prevStart, b.prevEnd),
        dailySeries(rangeToIso("30d").start, rangeToIso("30d").end),
        dishStats(b.start, b.end),
        hourlySeries(b.start, b.end),
      ]);
      if (!alive) return;
      const aov = cur.orders ? cur.revenue / cur.orders : 0;
      const pavg = prev.orders ? prev.revenue / prev.orders : 0;
      setKpi({
        revenue: cur.revenue,
        orders: cur.orders,
        aov,
        items: cur.items,
        revenueChange: pct(cur.revenue, prev.revenue),
        ordersChange: pct(cur.orders, prev.orders),
        aovChange: pct(aov, pavg),
      });
      setTrend(daily);
      setDishes(dish);
      setHourly(hours);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, version]);

  const dishCatMap = useMemo(() => buildDishCategoryMap(settings), [settings]);
  const cats = useMemo(() => {
    const map = new Map<string, number>();
    dishes.forEach((d) => {
      const c = dishCatMap.get(d.name) || "其他";
      map.set(c, (map.get(c) || 0) + d.revenue);
    });
    return Array.from(map.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [dishes, dishCatMap]);

  const trendPoints = useMemo(
    () =>
      trend.map((d) => ({
        label: String(d.day).slice(5),
        revenue: d.revenue,
      })),
    [trend],
  );
  const hourPoints = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      label: `${String(h).padStart(2, "0")}时`,
      orders: 0,
    }));
    hourly.forEach((h) => {
      if (h.hour >= 0 && h.hour < 24)
        buckets[h.hour]!.orders = Number(h.orders);
    });
    return buckets;
  }, [hourly]);

  const topDishes = useMemo(
    () => [...dishes].sort((a, b) => b.qty - a.qty).slice(0, 6),
    [dishes],
  );
  const recent = useMemo(
    () =>
      [...recentOrders]
        .filter((o) => !isCancelled(o))
        .sort((a, b) => orderTime(b) - orderTime(a))
        .slice(0, 8),
    [recentOrders],
  );

  // 超时订单：阈值可配，每分钟重算一次（超时是随时间推移的）
  const [lateCfg] = useLateConfig();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const late = useMemo(
    () => lateOrders(recentOrders, lateCfg, now),
    [recentOrders, lateCfg, now],
  );

  const todos = useMemo(
    () =>
      buildTodos({
        low: ops.low,
        priceAlerts: ops.alerts,
        todayWaste: ops.todayWaste,
        pendingOrders: ops.pending,
        late,
      }),
    [ops, late],
  );

  const todoIcon = (tab: string) => {
    if (tab === "orders") return <ReceiptText size={16} />;
    if (tab === "inventory") return <Boxes size={16} />;
    if (tab === "procurement") return <ShoppingCart size={16} />;
    if (tab === "waste") return <PackageX size={16} />;
    return <CircleCheck size={16} />;
  };

  // 经营小结：把当前区间的关键指标压成一段话，可一键复制
  const summaryInput = useMemo<SummaryInput>(
    () => ({
      rangeLabel: RANGE_LABEL[range] || "本期",
      compareLabel: COMPARE_LABEL[range] || "上一周期",
      revenue: kpi.revenue,
      orders: kpi.orders,
      aov: kpi.aov,
      revenueChange: kpi.revenueChange,
      topDish: topDishes[0]
        ? { name: topDishes[0].name, qty: topDishes[0].qty }
        : null,
      lowCount: ops.low.length,
      priceAlertCount: ops.alerts.length,
      waste: ops.todayWaste,
      pending: ops.pending,
      lateCount: late.length,
    }),
    [range, kpi, topDishes, ops, late],
  );
  const copySummary = () => {
    const text = buildSummary(summaryInput);
    const done = () => toast.success("小结已复制，可直接粘贴到群里");
    try {
      const p = navigator.clipboard?.writeText(text);
      if (p && typeof p.then === "function") {
        p.then(done).catch(() => fallbackCopy(text, done));
      } else fallbackCopy(text, done);
    } catch {
      fallbackCopy(text, done);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center gap-3">
        <Segmented
          value={range}
          onChange={setRange}
          options={
            [
              ["today", "今天"],
              ["7d", "近7天"],
              ["30d", "近30天"],
              ["all", "全部"],
            ] as const
          }
        />
        <span className="hidden sm:inline text-[11px] text-zinc-500">
          服务端聚合 · 环比上一周期
        </span>
      </div>

      <div className="space-y-3">
        {/* Hero：营业收入大卡（品牌渐变 + 迷你走势 + 环比） */}
        <div
          className="relative overflow-hidden rounded-[26px] p-5 sm:p-6 text-white"
          style={{
            background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
            boxShadow: "0 22px 45px -26px rgba(234,88,12,0.95)",
            color: "#ffffff",
          }}
        >
          <div className="pointer-events-none absolute -right-12 -top-16 w-56 h-56 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute right-24 -bottom-24 w-48 h-48 rounded-full bg-white/10 blur-2xl" />

          {trendPoints.length >= 2 && (
            <div className="absolute inset-x-0 bottom-0 h-24 opacity-40 pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendPoints}>
                  <defs>
                    <linearGradient id="heroRev" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#ffffff"
                        stopOpacity={0.55}
                      />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={2}
                    fill="url(#heroRev)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="relative">
            <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
              <Wallet size={16} />
              营业收入 · {RANGE_LABEL[range]}
            </div>
            <div className="mt-2.5 flex items-end gap-3 flex-wrap">
              <span
                className="tnum text-[38px] sm:text-[46px] font-black leading-none"
                style={{ color: "#ffffff" }}
              >
                {fmtMoney(kpi.revenue)}
              </span>
              {kpi.revenueChange !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full ${
                    kpi.revenueChange > 0.05
                      ? "bg-white/25 text-white"
                      : kpi.revenueChange < -0.05
                        ? "bg-black/20 text-white"
                        : "bg-white/20 text-white"
                  }`}
                >
                  {kpi.revenueChange > 0.05 ? (
                    <ArrowUpRight size={13} />
                  ) : kpi.revenueChange < -0.05 ? (
                    <ArrowDownRight size={13} />
                  ) : (
                    <Minus size={13} />
                  )}
                  {Math.abs(kpi.revenueChange).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="mt-2 text-[12px] text-white/80">
              共 {kpi.orders} 笔订单 · 数据实时聚合
            </div>
          </div>
        </div>

        {/* 次级 KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <KpiCard
            icon={ShoppingBag}
            label="订单数"
            value={String(kpi.orders)}
            valueNum={kpi.orders}
            change={kpi.ordersChange}
            accent="text-blue-400"
            bg="bg-blue-500/10"
          />
          <KpiCard
            icon={TrendingUp}
            label="客单价"
            value={fmtMoney(kpi.aov)}
            valueNum={kpi.aov}
            format={fmtMoney}
            change={kpi.aovChange}
            accent="text-teal-400"
            bg="bg-teal-500/10"
          />
          <div className="col-span-2 sm:col-span-1">
            <KpiCard
              icon={Utensils}
              label="售出菜品(份)"
              value={String(kpi.items)}
              valueNum={kpi.items}
              accent="text-purple-400"
              bg="bg-purple-500/10"
            />
          </div>
        </div>
      </div>

      {ops.ready && (
        <ChartCard
          title="今日待办"
          subtitle={
            todos.length
              ? `${todos.length} 项需要处理 · 点击直达`
              : "订单、库存、采购、损耗都正常"
          }
          action={
            todos.length ? (
              <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[11px] font-bold">
                {todos.length}
              </span>
            ) : (
              <CircleCheck size={18} className="text-teal-400" />
            )
          }
        >
          {todos.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-sm text-teal-400">
              <CircleCheck size={16} /> 今日无待办事项，继续保持
            </div>
          ) : (
            <div className="space-y-1.5">
              {todos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTab?.(t.tab as OwnerTab)}
                  className="group w-full flex items-center gap-3 bg-zinc-950 rounded-lg px-3 py-2.5 text-left border-l-4 hover:bg-zinc-900/70 transition-colors"
                  style={{ borderLeftColor: LEVEL_COLOR[t.level] }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `${LEVEL_COLOR[t.level]}1f`,
                      color: LEVEL_COLOR[t.level],
                    }}
                  >
                    {todoIcon(t.tab)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-100 truncate">
                      {t.title}
                    </span>
                    <span className="block text-xs text-zinc-500 truncate">
                      {t.desc}
                    </span>
                  </span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: `${LEVEL_COLOR[t.level]}1f`,
                      color: LEVEL_COLOR[t.level],
                    }}
                  >
                    {t.badge}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-zinc-600 group-hover:text-zinc-400 shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </ChartCard>
      )}

      {ops.ready && (
        <ChartCard
          title="经营小结"
          subtitle={`${RANGE_LABEL[range] || "本期"} · 自动生成`}
          action={
            <button
              onClick={copySummary}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors active:scale-95"
              title="复制小结"
            >
              <Copy size={13} /> 复制
            </button>
          }
        >
          <div className="rounded-xl bg-zinc-950 px-4 py-3.5 space-y-2">
            {summaryLines(summaryInput).map((line, i) => (
              <p key={i} className="text-sm text-zinc-300 leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </ChartCard>
      )}

      <ChartCard title="营收趋势" subtitle="近 30 天营业收入">
        {trendPoints.length === 0 ? (
          <EmptyState text="暂无数据" />
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendPoints}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={C.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.label, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: C.label, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: "rgba(251,146,60,0.35)" }}
                  formatter={(v: number) => [fmtMoney(v), "营收"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#fb923c"
                  strokeWidth={2.5}
                  fill="url(#rev)"
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="分类营收占比" subtitle="按菜品分类">
          {cats.length === 0 ? (
            <EmptyState text="暂无数据" />
          ) : (
            <div className="h-60 flex items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie
                    data={cats}
                    dataKey="revenue"
                    nameKey="name"
                    innerRadius="50%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {cats.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => fmtMoney(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 pl-2">
                {cats.slice(0, 6).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-zinc-300 truncate flex-1">
                      {c.name}
                    </span>
                    <span className="text-zinc-500">{fmtMoney(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="时段订单分布" subtitle="按小时">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourPoints}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={C.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.label, fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                  interval={2}
                />
                <YAxis
                  tick={{ fill: C.label, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} 单`, "订单"]}
                />
                <Bar
                  dataKey="orders"
                  fill="#38bdf8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="热销菜品" subtitle="按份数">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : topDishes.length === 0 ? (
            <EmptyState text="暂无数据" />
          ) : (
            <div className="space-y-2">
              {topDishes.map((d, i) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between bg-zinc-950 rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i < 3 ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-zinc-200 truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-zinc-500 text-xs">x{d.qty}</span>
                    <span className="text-orange-400 font-semibold text-sm w-16 text-right">
                      {fmtMoney(d.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="实时订单流" subtitle="最近订单">
          {recent.length === 0 ? (
            <EmptyState text="暂无订单" />
          ) : (
            <div className="space-y-2">
              {recent.map((o, i) => (
                <div
                  key={o._id || o.id || i}
                  className="flex items-center justify-between bg-zinc-950 rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-white font-bold w-10 shrink-0">
                      {tableName(o)}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate">
                      {fmtDateTime(o.timestamp || o.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-zinc-400">
                      {STATUS_TEXT[o.status || "pending"]}
                    </span>
                    <span className="text-orange-400 font-semibold text-sm">
                      {fmtMoney(orderTotal(o))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-600 py-2">
        <Clock size={12} /> 统计走服务端聚合，近况每 5
        分钟刷新（页面隐藏时暂停）
      </div>
    </div>
  );
}
