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
import { ChartCard, EmptyState, Skeleton } from "../components/ui";
import { fmtMoney } from "../lib/format";
import {
  menuEngineering,
  QUAD_LABEL,
  type MatrixQuad,
  type RangeKey,
} from "../lib/analytics";
import { rangeToIso, dishStats, type DishStat } from "../lib/aggregate";

const tooltipStyle = {
  background: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 12,
  color: "#fafafa",
  fontSize: 12,
};

export default function MenuAnalysis() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [dishes, setDishes] = useState<DishStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const d = await dishStats(b.start, b.end);
      if (!alive) return;
      setDishes(d);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const matrix = useMemo(
    () => menuEngineering(dishes.filter((d) => d.qty > 0)),
    [dishes],
  );
  const avgQty = useMemo(
    () =>
      matrix.length ? matrix.reduce((s, d) => s + d.qty, 0) / matrix.length : 0,
    [matrix],
  );
  const avgPrice = useMemo(
    () =>
      matrix.length
        ? matrix.reduce((s, d) => s + d.revenue / d.qty, 0) / matrix.length
        : 0,
    [matrix],
  );

  const points = matrix.map((d) => ({
    x: d.qty,
    y: d.qty ? +(d.revenue / d.qty).toFixed(2) : 0,
    z: d.revenue,
    name: d.name,
    quad: d.quad,
  }));

  const quads: MatrixQuad[] = ["star", "plowhorse", "puzzle", "dog"];

  return (
    <div className="space-y-4">
      <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 w-fit">
        {(
          [
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quads.map((q) => {
          const list = matrix.filter((d) => d.quad === q);
          const rev = list.reduce((s, d) => s + d.revenue, 0);
          return (
            <div
              key={q}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4"
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
                {fmtMoney(rev)}
              </div>
            </div>
          );
        })}
      </div>

      <ChartCard
        title="菜单工程矩阵"
        subtitle="横轴=销量  纵轴=单价  气泡=营收"
      >
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : matrix.length === 0 ? (
          <EmptyState text="暂无数据" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="销量"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="单价"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <ReferenceLine
                  x={avgQty}
                  stroke="#52525b"
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  y={avgPrice}
                  stroke="#52525b"
                  strokeDasharray="4 4"
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={() => ""}
                  content={({ payload }) => {
                    const p = payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs">
                        <div className="text-white font-semibold">{p.name}</div>
                        <div className="text-zinc-400 mt-1">
                          销量 {p.x} · 单价 {fmtMoney(p.y)} · 营收{" "}
                          {fmtMoney(p.z)}
                        </div>
                        <div
                          style={{
                            color: QUAD_LABEL[p.quad as MatrixQuad].color,
                          }}
                        >
                          {QUAD_LABEL[p.quad as MatrixQuad].title}
                        </div>
                      </div>
                    );
                  }}
                />
                {quads.map((q) => (
                  <Scatter
                    key={q}
                    name={QUAD_LABEL[q].title}
                    data={points.filter((p) => p.quad === q)}
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
          const list = matrix
            .filter((d) => d.quad === q)
            .sort((a, b) => b.revenue - a.revenue);
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
                      </span>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-zinc-500 text-xs">
                          x{d.qty} · {fmtMoney(d.qty ? d.revenue / d.qty : 0)}
                        </span>
                        <span
                          className="font-semibold w-16 text-right"
                          style={{ color: QUAD_LABEL[q].color }}
                        >
                          {fmtMoney(d.revenue)}
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
    </div>
  );
}
