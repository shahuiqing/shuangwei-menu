import { useEffect, useMemo, useState } from "react";
import { Wallet, ShoppingBag, TrendingUp, Utensils, Clock } from "lucide-react";
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
import { ChartCard, KpiCard, EmptyState, Skeleton } from "../components/ui";
import { Segmented } from "../components/Segmented";
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
  type DailyPoint,
  type DishStat,
  type HourPoint,
} from "../lib/aggregate";

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

const tooltipStyle = {
  background: "rgba(24,24,27,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  color: "#fafafa",
  fontSize: 12,
  boxShadow: "0 12px 30px -12px rgba(0,0,0,0.8)",
  backdropFilter: "blur(8px)",
};

const pct = (cur: number, prev: number) =>
  !prev ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

export default function Dashboard({
  recentOrders,
  settings,
  version = 0,
}: {
  recentOrders: any[];
  settings: any;
  version?: number;
}) {
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={Wallet}
          label="营业收入"
          value={fmtMoney(kpi.revenue)}
          change={kpi.revenueChange}
        />
        <KpiCard
          icon={ShoppingBag}
          label="订单数"
          value={String(kpi.orders)}
          change={kpi.ordersChange}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={TrendingUp}
          label="客单价"
          value={fmtMoney(kpi.aov)}
          change={kpi.aovChange}
          accent="text-teal-400"
          bg="bg-teal-500/10"
        />
        <KpiCard
          icon={Utensils}
          label="售出菜品(份)"
          value={String(kpi.items)}
          accent="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

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
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
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
                    innerRadius={45}
                    outerRadius={80}
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
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  interval={2}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
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
            <Skeleton className="h-40 w-full" />
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
