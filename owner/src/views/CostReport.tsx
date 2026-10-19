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
import { fmtDateTime, fmtMoney } from "../lib/format";
import {
  fetchBoms,
  fetchInventory,
  fetchPurchasesBetween,
  num,
} from "../lib/inventory";
import { dishMargins, sumCost, type DishMargin } from "../lib/cost";
import { loadStocktakeHistory } from "../lib/stocktakeHistory";
import type { RangeKey } from "../lib/analytics";
import {
  rangeToIso,
  salesSummary,
  dishStats,
  dailyProfit,
  costSummary,
  consumptionByItem,
  type DailyProfit,
} from "../lib/aggregate";
import { useChartTheme } from "../lib/theme";
import {
  fetchFixedCosts,
  saveFixedCost,
  deleteFixedCost,
  newFixedCost,
  dailyFixedCost,
  fixedCostForRange,
  breakEvenRevenue,
  FIXED_CATEGORIES,
  type FixedCost,
} from "../lib/fixedCost";
import { getCommissionRate } from "../lib/platform";
import { businessDayStart } from "../lib/businessDay";
import { Plus, Trash2, Landmark, Scale } from "lucide-react";

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

  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [fcName, setFcName] = useState("");
  const [fcCategory, setFcCategory] = useState<string>("其他");
  const [fcAmount, setFcAmount] = useState("");
  const [fcNote, setFcNote] = useState("");
  const [bounds, setBounds] = useState(() => {
    const now = Date.now();
    return { start: now, end: now };
  });
  const [rangeCogs, setRangeCogs] = useState<number | null>(null);
  const [waste, setWaste] = useState(0);
  const [externalRevenue, setExternalRevenue] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const [bm, iv, sum, ds, dp, cs, ws] = await Promise.all([
        fetchBoms(),
        fetchInventory(),
        salesSummary(b.start, b.end),
        dishStats(b.start, b.end),
        dailyProfit(b.start, b.end),
        costSummary(b.start, b.end),
        consumptionByItem(b.start, b.end, "waste"),
      ]);
      if (!alive) return;
      setRevenue(sum.revenue);
      setMargins(dishMargins(ds, bm, iv));
      setDaily(dp);
      setBounds({
        start: new Date(b.start).getTime(),
        end: new Date(b.end).getTime(),
      });
      setRangeCogs(cs ? cs.cogs : null);
      setExternalRevenue(cs?.externalRevenue || 0);
      setWaste(cs ? cs.waste : ws.reduce((s, w) => s + num(w.cost), 0));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, version]);

  useEffect(() => {
    fetchFixedCosts().then(setFixedCosts);
  }, [version]);

  const [recon, setRecon] = useState<{
    opening: number;
    closing: number;
    purchases: number;
    realCogs: number;
    standardCogs: number | null;
    hiddenLoss: number | null;
    from: number;
    to: number;
  } | null>(null);

  const cogs = rangeCogs ?? sumCost(margins);
  const profit = revenue - cogs;
  const margin = revenue ? (profit / revenue) * 100 : 0;
  const unknown = useMemo(
    () => margins.filter((m) => !m.hasCost).map((m) => m.name),
    [margins],
  );
  // 区间 end 可能落在 02:59（上一营业日），固定成本按「最后一个营业日」摊派
  const fixedEnd = useMemo(() => businessDayStart(bounds.end), [bounds.end]);
  const rangeFixed = useMemo(
    () => fixedCostForRange(fixedCosts, bounds.start, fixedEnd),
    [fixedCosts, bounds.start, fixedEnd],
  );
  const dayCount = useMemo(() => {
    const s = new Date(bounds.start);
    const e = new Date(fixedEnd);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [bounds.start, fixedEnd]);
  const dayFixed = rangeFixed / dayCount;
  // 「全部」区间用当前日均做盈亏平衡；历史平均会被摊薄，没有参考意义
  const breakEvenFixed =
    range === "all" ? dailyFixedCost(fixedCosts, new Date()) : dayFixed;
  const commission = externalRevenue * getCommissionRate();
  const net = revenue - cogs - waste - rangeFixed - commission;
  const breakEven = breakEvenRevenue(
    breakEvenFixed,
    revenue ? cogs / revenue : 0,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const records = loadStocktakeHistory();
      if (records.length < 2) {
        setRecon(null);
        return;
      }
      const prev = Number(records[1].at);
      const latest = Number(records[0].at);
      const startIso = new Date(prev).toISOString();
      const endIso = new Date(latest).toISOString();
      const [purchases, cs] = await Promise.all([
        fetchPurchasesBetween(startIso, endIso),
        costSummary(startIso, endIso),
      ]);
      const between = purchases.reduce((s, p) => s + Number(p.total_cost), 0);
      const opening = Number(records[1].stockValue) || 0;
      const closing = Number(records[0].stockValue) || 0;
      const realCogs = opening + between - closing;
      if (!alive) return;
      setRecon({
        opening,
        closing,
        purchases: between,
        realCogs,
        standardCogs: cs ? cs.cogs : null,
        hiddenLoss: cs ? realCogs - cs.cogs : null,
        from: prev,
        to: latest,
      });
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  const addFixedCost = async () => {
    if (!fcName.trim()) return;
    const c: FixedCost = {
      ...newFixedCost(),
      name: fcName.trim(),
      category: fcCategory,
      amount: Number(fcAmount) || 0,
      note: fcNote.trim(),
    };
    const ok = await saveFixedCost(c);
    if (!ok) return;
    setFixedCosts(await fetchFixedCosts());
    setFcName("");
    setFcAmount("");
    setFcNote("");
  };
  const removeFixedCost = async (id: string) => {
    if (!confirm("删除这项固定成本？")) return;
    if (!(await deleteFixedCost(id))) return;
    setFixedCosts(await fetchFixedCosts());
  };
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
    <div className="space-y-4 sm:space-y-5">
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

      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-5 gap-2.5 sm:gap-4">
        <KpiCard
          icon={Wallet}
          label="营业收入"
          value={fmtMoney(revenue)}
          valueNum={revenue}
          format={fmtMoney}
        />
        <KpiCard
          icon={TrendingUp}
          label="销售成本 (COGS)"
          value={fmtMoney(cogs)}
          valueNum={cogs}
          format={fmtMoney}
          accent="text-red-400"
          bg="bg-red-500/10"
        />
        <KpiCard
          icon={Wallet}
          label="毛利"
          value={fmtMoney(profit)}
          valueNum={profit}
          format={fmtMoney}
          accent={profit >= 0 ? "text-green-400" : "text-red-400"}
          bg={profit >= 0 ? "bg-green-500/10" : "bg-red-500/10"}
        />
        <KpiCard
          icon={Percent}
          label="毛利率"
          value={`${margin.toFixed(1)}%`}
          valueNum={margin}
          format={(n) => `${n.toFixed(1)}%`}
          accent="text-teal-400"
          bg="bg-teal-500/10"
        />
        <div className="col-span-2 sm:col-span-2 xl:col-span-1">
          <KpiCard
            icon={Landmark}
            label="净利（扣食材/损耗/固定/佣金）"
            value={fmtMoney(net)}
            valueNum={net}
            format={fmtMoney}
            sub={`固定 ${fmtMoney(rangeFixed)} · 平衡 ${fmtMoney(breakEven)}/日`}
            accent={net >= 0 ? "text-green-400" : "text-red-400"}
            bg={net >= 0 ? "bg-green-500/10" : "bg-red-500/10"}
          />
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        净利 = 营收 {fmtMoney(revenue)} − 食材 {fmtMoney(cogs)} − 损耗{" "}
        {fmtMoney(waste)} − 固定 {fmtMoney(rangeFixed)} − 平台佣金{" "}
        {fmtMoney(commission)}
        {externalRevenue > 0
          ? `（平台营收 ${fmtMoney(externalRevenue)} × ${(getCommissionRate() * 100).toFixed(0)}%）`
          : "（无平台单）"}
      </p>

      <ChartCard
        title="固定成本（房租 / 人工 / 水电）"
        subtitle={`月合计 ${fmtMoney(fixedCosts.reduce((s, c) => s + Number(c.amount), 0))} · 区间摊派 ${fmtMoney(rangeFixed)} · 日均 ${fmtMoney(breakEvenFixed)} · 盈亏平衡 ${fmtMoney(breakEven)}/日`}
      >
        {fixedCosts.length > 0 && (
          <div className="space-y-2 mb-3">
            {fixedCosts.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl bg-zinc-950 border border-white/5 px-3 py-2.5 text-sm"
              >
                <span className="text-zinc-200 font-medium truncate">
                  {c.name}
                  <span className="text-[11px] text-zinc-500 ml-2">
                    {c.category}
                  </span>
                </span>
                <span className="ml-auto tnum text-zinc-300 shrink-0">
                  {fmtMoney(Number(c.amount))}/月
                </span>
                <span className="tnum text-zinc-500 text-xs shrink-0">
                  ≈{fmtMoney(dailyFixedCost([c], new Date()))}/日
                </span>
                <button
                  onClick={() => removeFixedCost(c.id)}
                  className="text-zinc-500 hover:text-red-400 shrink-0"
                  title="删除"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <input
            value={fcName}
            onChange={(e) => setFcName(e.target.value)}
            placeholder="名称（如 房租）"
            className="sm:col-span-1 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <select
            value={fcCategory}
            onChange={(e) => setFcCategory(e.target.value)}
            className="bg-zinc-950 border border-white/5 rounded-lg px-2.5 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            {FIXED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={fcAmount}
            onChange={(e) => setFcAmount(e.target.value)}
            placeholder="月金额"
            className="bg-zinc-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <input
            value={fcNote}
            onChange={(e) => setFcNote(e.target.value)}
            placeholder="备注（选填）"
            className="sm:col-span-1 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={addFixedCost}
            disabled={!fcName.trim()}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg btn-brand text-white font-semibold text-sm disabled:opacity-50"
          >
            <Plus size={15} /> 添加
          </button>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">
          按月金额录入，按当月自然天数摊到每日；未执行 supabase_owner_all.sql
          时保存会失败。
        </p>
      </ChartCard>

      <ChartCard
        title="成本对账（真实 vs 标准）"
        subtitle={
          recon
            ? `${fmtDateTime(recon.from)} ~ ${fmtDateTime(recon.to)} · 真实 COGS = 期初 + 采购 − 期末`
            : "两次盘点之间 · 库存变动法：真实 COGS = 期初 + 采购 − 期末"
        }
        action={<Scale size={18} className="text-orange-500" />}
      >
        {recon ? (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-950 rounded-xl px-3 py-2.5">
                <div className="text-[11px] text-zinc-500">期初库存</div>
                <div className="font-bold tnum text-zinc-200 mt-0.5">
                  {fmtMoney(recon.opening)}
                </div>
              </div>
              <div className="bg-zinc-950 rounded-xl px-3 py-2.5">
                <div className="text-[11px] text-zinc-500">期间采购</div>
                <div className="font-bold tnum text-zinc-200 mt-0.5">
                  {fmtMoney(recon.purchases)}
                </div>
              </div>
              <div className="bg-zinc-950 rounded-xl px-3 py-2.5">
                <div className="text-[11px] text-zinc-500">期末库存</div>
                <div className="font-bold tnum text-zinc-200 mt-0.5">
                  {fmtMoney(recon.closing)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2.5">
              <span className="text-zinc-400">
                真实 COGS（库存变动）· 隐性损耗
              </span>
              <span className="tnum font-semibold">
                {fmtMoney(recon.realCogs)}
                {recon.hiddenLoss === null ? (
                  <span className="ml-2 text-zinc-500">标准成本待更新</span>
                ) : (
                  <span
                    className={`ml-2 ${recon.hiddenLoss > 0 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {recon.hiddenLoss > 0
                      ? `多耗 ${fmtMoney(recon.hiddenLoss)}`
                      : "无隐性损耗"}
                  </span>
                )}
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              {recon.standardCogs !== null
                ? `隐性损耗 = 真实 COGS − 标准 COGS（盘点窗口 ${fmtMoney(recon.standardCogs)}），即后厨用了但没报损的部分。`
                : "执行最新 supabase_owner_all.sql 后，可按盘点窗口对比标准 COGS 与隐性损耗。"}
            </p>
          </div>
        ) : (
          <EmptyState
            text="需要至少两次盘点才能对账"
            hint="先做一次盘点记录库存，隔一段时间再做第二次，这里就能算出真实消耗"
          />
        )}
      </ChartCard>

      {rangeCogs === null && !loading && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            当前按「现价配方」估算成本（数据库未执行最新
            SQL）。执行后历史订单使用结账时成本快照，原料调价不再改写旧账。
          </span>
        </div>
      )}

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
                  fill={C.brand}
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
          <>
            <div className="sm:hidden space-y-2.5">
              {margins.slice(0, 60).map((d) => (
                <div key={d.name} className="card-surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-white font-medium truncate">
                      {d.name}
                      {!d.hasCost && (
                        <span className="text-[11px] text-amber-400 ml-1">
                          未配配方
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold tnum ${
                        d.margin >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {d.margin.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                    <span className="text-zinc-400">销量 x{num(d.qty)}</span>
                    <span className="text-zinc-300">
                      营收 {fmtMoney(d.revenue)}
                    </span>
                    <span className="text-red-400">
                      成本 {fmtMoney(d.cost)}
                    </span>
                    <span
                      className={`font-semibold ${d.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      毛利 {fmtMoney(d.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
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
          </>
        )}
      </ChartCard>
    </div>
  );
}
