import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ChartCard, EmptyState, Skeleton } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import { buildDishCategoryMap, type RangeKey } from "../lib/analytics";
import {
  rangeToIso,
  dishStats,
  hourlySeries,
  type DishStat,
  type HourPoint,
} from "../lib/aggregate";

type Dimension = "dish" | "category" | "hour";

function downloadCsv(name: string, rows: (string | number)[][]) {
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
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Reports({
  settings,
  version = 0,
}: {
  settings: any;
  version?: number;
}) {
  const [range, setRange] = useState<RangeKey>("7d");
  const [dim, setDim] = useState<Dimension>("dish");
  const [dishes, setDishes] = useState<DishStat[]>([]);
  const [hours, setHours] = useState<HourPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const [d, h] = await Promise.all([
        dishStats(b.start, b.end),
        hourlySeries(b.start, b.end),
      ]);
      if (!alive) return;
      setDishes(d);
      setHours(h);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, version]);

  const dishCatMap = useMemo(() => buildDishCategoryMap(settings), [settings]);
  const cats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    dishes.forEach((d) => {
      const name = dishCatMap.get(d.name) || "其他";
      const e = map.get(name) || { name, qty: 0, revenue: 0 };
      e.qty += d.qty;
      e.revenue += d.revenue;
      map.set(name, e);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [dishes, dishCatMap]);

  const hourRows = useMemo(
    () =>
      hours
        .map((h) => ({
          label: `${String(h.hour).padStart(2, "0")}时`,
          orders: Number(h.orders),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [hours],
  );

  const total =
    dim === "dish"
      ? dishes.reduce((s, d) => s + d.revenue, 0)
      : dim === "category"
        ? cats.reduce((s, c) => s + c.revenue, 0)
        : hourRows.reduce((s, h) => s + h.orders, 0);

  const onExport = () => {
    if (dim === "dish") {
      if (!dishes.length) return toast.error("暂无数据");
      downloadCsv(`report_dishes_${Date.now()}.csv`, [
        ["菜品", "份数", "营收"],
        ...dishes.map((d) => [d.name, d.qty, d.revenue]),
      ]);
    } else if (dim === "category") {
      if (!cats.length) return toast.error("暂无数据");
      downloadCsv(`report_category_${Date.now()}.csv`, [
        ["分类", "份数", "营收"],
        ...cats.map((c) => [c.name, c.qty, c.revenue]),
      ]);
    } else {
      if (!hourRows.length) return toast.error("暂无数据");
      downloadCsv(`report_hour_${Date.now()}.csv`, [
        ["时段", "订单数"],
        ...hourRows.map((h) => [h.label, h.orders]),
      ]);
    }
    toast.success("已导出报表");
  };

  const rows =
    dim === "dish"
      ? dishes.map((d) => ({ key: d.name, qty: d.qty, value: d.revenue }))
      : dim === "category"
        ? cats.map((c) => ({ key: c.name, qty: c.qty, value: c.revenue }))
        : hourRows.map((h) => ({
            key: h.label,
            qty: h.orders,
            value: h.orders,
          }));
  const maxVal = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <Download size={16} /> 导出
        </button>
      </div>

      <ChartCard
        title="销售报表"
        subtitle={`共 ${rows.length} 项 · 合计 ${fmtMoney(total)}`}
        action={
          <div className="flex bg-zinc-950 rounded-xl p-1 border border-white/5">
            {(
              [
                ["dish", "按菜品"],
                ["category", "按分类"],
                ["hour", "按时段"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setDim(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${dim === id ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState text="暂无数据" />
        ) : (
          <div className="space-y-1">
            {rows.slice(0, 60).map((r, i) => (
              <div key={r.key} className="relative">
                <div
                  className="absolute inset-y-0 left-0 bg-orange-500/10 rounded-lg"
                  style={{ width: `${(r.value / maxVal) * 100}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-zinc-200 truncate">{r.key}</span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-zinc-500 text-sm">
                      {dim === "hour" ? `${r.qty} 单` : `x${r.qty}`}
                    </span>
                    <span className="text-orange-400 font-semibold w-20 text-right">
                      {dim === "hour" ? `${r.value} 单` : fmtMoney(r.value)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {rows.length > 60 && (
              <p className="text-center text-xs text-zinc-500 py-2">
                仅显示前 60 项
              </p>
            )}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
