import { useMemo, useState } from "react";
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
import { ChartCard, KpiCard, EmptyState } from "../components/ui";
import { fmtMoney, fmtDateTime, STATUS_TEXT } from "../lib/format";
import {
  computeKpi,
  rangeBounds,
  dailySeries,
  hourlySeries,
  dishStats,
  categoryStats,
  buildDishCategoryMap,
  orderTotal,
  isCancelled,
  orderTime,
  tableName,
  type RangeKey,
} from "../lib/analytics";

const PIE_COLORS = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#eab308",
  "#14b8a6",
  "#ec4899",
];

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 12,
  color: "#fafafa",
  fontSize: 12,
};

export default function Dashboard({
  orders,
  settings,
}: {
  orders: any[];
  settings: any;
}) {
  const [range, setRange] = useState<RangeKey>("today");

  const kpi = useMemo(
    () => computeKpi(orders, rangeBounds(range)),
    [orders, range],
  );
  const trend = useMemo(() => dailySeries(orders, 30), [orders]);
  const hourly = useMemo(() => {
    const b = rangeBounds(range);
    return hourlySeries(orders.filter((o) => orderTime(o) >= b.start));
  }, [orders, range]);

  const dishCatMap = useMemo(() => buildDishCategoryMap(settings), [settings]);
  const cats = useMemo(() => {
    const b = rangeBounds(range);
    return categoryStats(
      orders.filter((o) => orderTime(o) >= b.start),
      dishCatMap,
    );
  }, [orders, range, dishCatMap]);

  const topDishes = useMemo(() => {
    const b = rangeBounds(range);
    return dishStats(
      orders.filter((o) => orderTime(o) >= b.start && !isCancelled(o)),
    ).slice(0, 6);
  }, [orders, range]);

  const recent = useMemo(
    () =>
      [...orders]
        .filter((o) => !isCancelled(o))
        .sort((a, b) => orderTime(b) - orderTime(a))
        .slice(0, 8),
    [orders],
  );

  return (
    <div className="space-y-5">
      {/* 区间切换 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          {(
            [
              ["today", "今天"],
              ["7d", "近7天"],
              ["30d", "近30天"],
              ["all", "全部"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setRange(id)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${range === id ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-500">环比上一周期对比</span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

      {/* 营收趋势 */}
      <ChartCard title="营收趋势" subtitle="近 30 天营业收入">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
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
                formatter={(v: number) => [fmtMoney(v), "营收"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 分类占比 */}
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

        {/* 时段分布 */}
        <ChartCard title="时段订单分布" subtitle="按小时">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#27272a"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "#27272a" }}
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
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 热销 */}
        <ChartCard title="热销菜品" subtitle="按份数">
          {topDishes.length === 0 ? (
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

        {/* 实时订单流 */}
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
        <Clock size={12} /> 数据每 60 秒自动刷新
      </div>
    </div>
  );
}
