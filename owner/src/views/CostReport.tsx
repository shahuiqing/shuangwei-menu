import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  Percent,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ChartCard, EmptyState, KpiCard, SkeletonRows } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { fmtMoney } from "../lib/format";
import { fetchBoms, fetchInventory, num } from "../lib/inventory";
import { dishMargins, sumCost, type DishMargin } from "../lib/cost";
import type { RangeKey } from "../lib/analytics";
import {
  rangeToIso,
  salesSummary,
  dishStats,
  dailyProfit,
  type DailyProfit,
} from "../lib/aggregate";
import { useChartTheme } from "../lib/theme";

export default function CostReport({ version = 0 }: { version?: number }) {
  const C = useChartTheme();
  const tooltipStyle = {
    background: C.tipBg,
    border: `1px solid ${C.tipBorder}`,
    borderRadius: 12,
    color: C.tipText,
    fontSize: 12,
  };
  const [range, setRange] = useState<RangeKey>("7d");
  const [margins, setMargins] = useState<DishMargin[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [daily, setDaily] = useState<DailyProfit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const [bm, iv, sum, ds, dp] = await Promise.all([
        fetchBoms(),
        fetchInventory(),
        salesSummary(b.start, b.end),
        dishStats(b.start, b.end),
        dailyProfit(b.start, b.end),
      ]);
      if (!alive) return;
      setRevenue(sum.revenue);
      setMargins(dishMargins(ds, bm, iv));
      setDaily(dp);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, version]);

  const cogs = useMemo(() => sumCost(margins), [margins]);
  const profit = revenue - cogs;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const unknown = useMemo(
    () => margins.filter((m) => !m.hasCost).map((m) => m.name),
    [margins],
  );
  const points = useMemo(
    () =>
      daily.map((d) => ({
        label: String(d.day).slice(5),
        revenue: num(d.revenue),
        cogs: num(d.cogs),
        profit: num(d.revenue) - num(d.cogs),
      })),
    [daily],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
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
        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
          <RefreshCw size={12} /> 成本由配方 × 原料单价在服务端聚合
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={Wallet} label="营业收入" value={fmtMoney(revenue)} />
        <KpiCard
          icon={TrendingUp}
          label="销售成本 (COGS)"
          value={fmtMoney(cogs)}
          accent="text-red-400"
          bg="bg-red-500/10"
        />
        <KpiCard
          icon={Wallet}
          label="毛利"
          value={fmtMoney(profit)}
          accent={profit >= 0 ? "text-green-400" : "text-red-400"}
          bg={profit >= 0 ? "bg-green-500/10" : "bg-red-500/10"}
        />
        <KpiCard
          icon={Percent}
          label="毛利率"
          value={`${margin.toFixed(1)}%`}
          accent="text-teal-400"
          bg="bg-teal-500/10"
        />
      </div>

      {unknown.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>以下菜品未配配方，成本按 0 计：{unknown.join("、")}</span>
        </div>
      )}

      <ChartCard title="营收 / 成本 / 毛利趋势" subtitle="按结账日">
        {points.length === 0 ? (
          <EmptyState text="暂无已结账订单" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.label, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: C.axis }}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: C.label, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: C.label }} />
                <Bar
                  dataKey="revenue"
                  name="营收"
                  fill="#f97316"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="cogs"
                  name="成本"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="毛利"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="菜品毛利排行" subtitle={`共 ${margins.length} 个菜品`}>
        {loading ? (
          <SkeletonRows rows={5} />
        ) : margins.length === 0 ? (
          <EmptyState text="暂无数据" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-white/5">
                  <th className="px-3 py-2 font-medium">菜品</th>
                  <th className="px-3 py-2 font-medium text-right">销量</th>
                  <th className="px-3 py-2 font-medium text-right">营收</th>
                  <th className="px-3 py-2 font-medium text-right">成本</th>
                  <th className="px-3 py-2 font-medium text-right">毛利</th>
                  <th className="px-3 py-2 font-medium text-right">毛利率</th>
                </tr>
              </thead>
              <tbody>
                {margins.slice(0, 60).map((d) => (
                  <tr
                    key={d.name}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="px-3 py-2.5 text-white">
                      {d.name}
                      {!d.hasCost && (
                        <span className="text-[11px] text-amber-400 ml-1">
                          未配配方
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-400">
                      x{num(d.qty)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {fmtMoney(d.revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-red-400">
                      {fmtMoney(d.cost)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold ${d.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {fmtMoney(d.profit)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-400">
                      {d.margin.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
