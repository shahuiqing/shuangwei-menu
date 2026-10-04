import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { ChartCard, EmptyState, SkeletonChart } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { fmtMoney } from "../lib/format";
import { QUAD_LABEL, type MatrixQuad, type RangeKey } from "../lib/analytics";
import { rangeToIso, dishStats, type DishStat } from "../lib/aggregate";
import {
  fetchBoms,
  fetchInventory,
  num,
  type InventoryItem,
  type RecipeBom,
} from "../lib/inventory";
import { dishMargins, buildMenuPoints, type MenuPoint } from "../lib/cost";
import { buildDishTrends, TREND_LABEL } from "../lib/dishTrend";
import { useChartTheme } from "../lib/theme";

type Mode = "revenue" | "profit";
type Point = MenuPoint;

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export default function MenuAnalysis({ version = 0 }: { version?: number }) {
  const C = useChartTheme();
  const tooltipStyle = {
    background: C.tipBg,
    border: `1px solid ${C.tipBorder}`,
    borderRadius: 12,
    color: C.tipText,
    fontSize: 12,
  };
  const [range, setRange] = useState<RangeKey>("30d");
  const [mode, setMode] = useState<Mode>("profit");
  const [dishes, setDishes] = useState<DishStat[]>([]);
  const [prevDishes, setPrevDishes] = useState<DishStat[]>([]);
  const [boms, setBoms] = useState<RecipeBom[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const [d, pd, bm, iv] = await Promise.all([
        dishStats(b.start, b.end),
        dishStats(b.prevStart, b.prevEnd),
        fetchBoms(),
        fetchInventory(),
      ]);
      if (!alive) return;
      setDishes(d);
      setPrevDishes(pd);
      setBoms(bm);
      setInv(iv);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, version]);

  const margins = useMemo(
    () => dishMargins(dishes, boms, inv),
    [dishes, boms, inv],
  );
  const points = useMemo(() => buildMenuPoints(margins, mode), [margins, mode]);
  const avgQty = useMemo(() => mean(points.map((p) => p.qty)), [points]);
  const avgUnit = useMemo(() => mean(points.map((p) => p.unit)), [points]);
  const noRecipe = useMemo(
    () => margins.filter((m) => !m.hasCost).length,
    [margins],
  );

  const trends = useMemo(
    () =>
      buildDishTrends(
        dishes.map((d) => ({ name: d.name, qty: d.qty })),
        prevDishes.map((d) => ({ name: d.name, qty: d.qty })),
      ),
    [dishes, prevDishes],
  );

  const quads: MatrixQuad[] = ["star", "plowhorse", "puzzle", "dog"];
  const unitLabel = mode === "revenue" ? "单价" : "单位毛利";
  const valueLabel = mode === "revenue" ? "营收" : "毛利";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Segmented
          value={range}
          onChange={setRange}
          options={
            [
              ["7d", "近7天"],
              ["30d", "近30天"],
              ["all", "全部"],
            ] as const
          }
        />
        <Segmented
          value={mode}
          onChange={setMode}
          options={
            [
              ["profit", "按毛利"],
              ["revenue", "按营收"],
            ] as const
          }
        />
      </div>

      {mode === "profit" && noRecipe > 0 && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5">
          有 {noRecipe} 个菜品未配配方，成本按 0 计。请到「配方
          BOM」补全后，毛利口径才准确。
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quads.map((q) => {
          const list = points.filter((p) => p.quad === q);
          const total = list.reduce((s, p) => s + p.value, 0);
          return (
            <div
              key={q}
              className="bg-zinc-900 border border-white/5 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ background: QUAD_LABEL[q].color }}
                />
                <span className="text-white font-semibold">
                  {QUAD_LABEL[q].title}
                </span>
                <span className="text-zinc-500 text-xs ml-auto">
                  {list.length} 项
                </span>
              </div>
              <div className="text-zinc-500 text-[11px] mt-1">
                {QUAD_LABEL[q].hint}
              </div>
              <div
                className="text-xl font-black mt-2"
                style={{ color: QUAD_LABEL[q].color }}
              >
                {fmtMoney(total)}
              </div>
            </div>
          );
        })}
      </div>

      <ChartCard
        title="菜单工程矩阵"
        subtitle={`横轴=销量  纵轴=${unitLabel}  气泡=${valueLabel}（虚线为均值）`}
      >
        {loading ? (
          <SkeletonChart h="h-80" />
        ) : points.length === 0 ? (
          <EmptyState text="暂无数据" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis
                  type="number"
                  dataKey="qty"
                  name="销量"
                  tick={{ fill: C.label, fontSize: 11 }}
                  axisLine={{ stroke: C.axis }}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="unit"
                  name={unitLabel}
                  tick={{ fill: C.label, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <ReferenceLine
                  x={avgQty}
                  stroke={C.split}
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  y={avgUnit}
                  stroke={C.split}
                  strokeDasharray="4 4"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={() => ""}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload as Point | undefined;
                    if (!p) return null;
                    return (
                      <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                        <div className="text-white font-semibold">{p.name}</div>
                        <div className="text-zinc-400 mt-1">
                          销量 {num(p.qty)} · {unitLabel} {fmtMoney(p.unit)} ·{" "}
                          {valueLabel} {fmtMoney(p.value)}
                        </div>
                        <div style={{ color: QUAD_LABEL[p.quad].color }}>
                          {QUAD_LABEL[p.quad].title}
                        </div>
                      </div>
                    );
                  }}
                />
                {quads.map((q) => (
                  <Scatter
                    key={q}
                    name={QUAD_LABEL[q].title}
                    data={points
                      .filter((p) => p.quad === q)
                      .map((p) => ({
                        ...p,
                        z: Math.max(1, Math.abs(p.value)),
                      }))}
                    fill={QUAD_LABEL[q].color}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {quads.map((q) => {
          const list = points
            .filter((p) => p.quad === q)
            .sort((a, b) => b.value - a.value);
          return (
            <ChartCard
              key={q}
              title={`${QUAD_LABEL[q].title}菜品`}
              subtitle={QUAD_LABEL[q].hint}
            >
              {list.length === 0 ? (
                <EmptyState text="无" />
              ) : (
                <div className="space-y-1.5">
                  {list.slice(0, 12).map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                    >
                      <span className="text-zinc-200 truncate mr-2">
                        {d.name}
                        {mode === "profit" && !d.hasCost && (
                          <span className="text-[11px] text-amber-400 ml-1">
                            未配配方
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-zinc-500 text-xs">
                          x{num(d.qty)} · {fmtMoney(d.unit)}
                        </span>
                        <span
                          className="font-semibold w-16 text-right"
                          style={{ color: QUAD_LABEL[q].color }}
                        >
                          {fmtMoney(d.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          );
        })}
      </div>

      <ChartCard title="菜品趋势" subtitle={`本期 vs 上期销量 · 阈值 ±20%`}>
        {loading ? (
          <EmptyState text="加载中…" />
        ) : trends.length === 0 ? (
          <EmptyState text="暂无数据" />
        ) : (
          <div className="space-y-1.5">
            {trends.slice(0, 20).map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: `${TREND_LABEL[t.kind].color}1f`,
                      color: TREND_LABEL[t.kind].color,
                    }}
                  >
                    {TREND_LABEL[t.kind].label}
                  </span>
                  <span className="text-zinc-200 truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-zinc-500">
                    {t.prevQty > 0 ? `${t.prevQty} → ` : ""}
                    {t.currentQty}
                  </span>
                  <span
                    className={`font-semibold w-14 text-right ${
                      t.changePct > 0
                        ? "text-green-400"
                        : t.changePct < 0
                          ? "text-red-400"
                          : "text-zinc-500"
                    }`}
                  >
                    {t.changePct > 0 ? "+" : ""}
                    {Math.round(t.changePct)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
