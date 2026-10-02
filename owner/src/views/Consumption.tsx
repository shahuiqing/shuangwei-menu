import { useEffect, useMemo, useState } from "react";
import { Flame, RefreshCw, Trash2, Package } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartCard, EmptyState, KpiCard, Skeleton } from "../components/ui";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import { num } from "../lib/inventory";
import type { RangeKey } from "../lib/analytics";
import {
  rangeToIso,
  consumptionByItem,
  consumptionByDish,
  consumptionByDay,
  type ConsStat,
} from "../lib/aggregate";

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 12,
  color: "#fafafa",
  fontSize: 12,
};

export default function Consumption() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [byItem, setByItem] = useState<ConsStat[]>([]);
  const [byDish, setByDish] = useState<ConsStat[]>([]);
  const [byDay, setByDay] = useState<
    { day: string; qty: number; cost: number }[]
  >([]);
  const [waste, setWaste] = useState<ConsStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const [it, di, da, wa] = await Promise.all([
        consumptionByItem(b.start, b.end),
        consumptionByDish(b.start, b.end),
        consumptionByDay(b.start, b.end),
        consumptionByItem(b.start, b.end, "waste"),
      ]);
      if (!alive) return;
      setByItem(it);
      setByDish(di);
      setByDay(da);
      setWaste(wa);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const totalCost = useMemo(
    () => byItem.reduce((s, x) => s + num(x.cost), 0),
    [byItem],
  );
  const totalQty = useMemo(
    () => byItem.reduce((s, x) => s + num(x.qty), 0),
    [byItem],
  );
  const wasteCost = useMemo(
    () => waste.reduce((s, x) => s + num(x.cost), 0),
    [waste],
  );
  const points = useMemo(
    () =>
      byDay.map((d) => ({
        label: String(d.day).slice(5),
        cost: num(d.cost),
      })),
    [byDay],
  );

  const exportCsv = () => {
    if (!byItem.length) return toast.error("暂无数据");
    const rows = [
      ["原料", "消耗数量", "消耗金额"],
      ...byItem.map((x) => [x.key, x.qty, x.cost]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
        )
        .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `consumption_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("已导出消耗报表");
  };

  return (
    <div className="space-y-4">
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
              className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                range === id
                  ? "bg-orange-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800"
        >
          导出 CSV
        </button>
        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
          <RefreshCw size={12} /> 服务端聚合，不再拉全量流水
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={Package}
          label="出库消耗金额"
          value={fmtMoney(totalCost)}
          sub={`共 ${byItem.length} 种原料`}
        />
        <KpiCard
          icon={Flame}
          label="损耗金额"
          value={fmtMoney(wasteCost)}
          accent="text-red-400"
          bg="bg-red-500/10"
        />
        <KpiCard
          icon={Package}
          label="消耗总量"
          value={num(totalQty).toFixed(1)}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
      </div>

      <ChartCard title="每日消耗金额" subtitle="按出库流水">
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : points.length === 0 ? (
          <EmptyState text="暂无消耗数据" />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#27272a"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#27272a" }}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Bar
                  dataKey="cost"
                  name="消耗"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="按原料消耗（含耗材）" subtitle="后厨用料汇总">
          {byItem.length === 0 ? (
            <EmptyState text="暂无数据" />
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {byItem.map((x, i) => (
                <div
                  key={x.key}
                  className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-zinc-200 truncate">{x.key}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-zinc-500 text-xs">
                      {num(x.qty).toFixed(1)}
                    </span>
                    <span className="text-orange-400 font-semibold w-20 text-right">
                      {fmtMoney(x.cost)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="按菜品消耗成本" subtitle="哪个菜最费料">
          {byDish.length === 0 ? (
            <EmptyState text="暂无数据" />
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {byDish.map((x, i) => (
                <div
                  key={x.key}
                  className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-zinc-200 truncate">{x.key}</span>
                  </div>
                  <span className="text-purple-400 font-semibold shrink-0">
                    {fmtMoney(x.cost)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {waste.length > 0 && (
        <ChartCard title="损耗记录" subtitle="waste 类型流水">
          <div className="space-y-1.5">
            {waste.map((x) => (
              <div
                key={x.key}
                className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
              >
                <span className="text-zinc-200 flex items-center gap-2">
                  <Trash2 size={13} className="text-red-400" /> {x.key}
                </span>
                <span className="text-zinc-500 text-xs">
                  {num(x.qty).toFixed(1)} ·{" "}
                  <span className="text-red-400">{fmtMoney(x.cost)}</span>
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
