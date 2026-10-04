import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Percent,
  PackageX,
  Plus,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ChartCard,
  EmptyState,
  KpiCard,
  SkeletonChart,
  SkeletonTable,
} from "../components/ui";
import { Segmented } from "../components/Segmented";
import { Sheet, SheetField } from "../components/Sheet";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney } from "../lib/format";
import {
  fetchBoms,
  fetchInventory,
  fetchTransactions,
  num,
  recordWaste,
  type InventoryItem,
  type InventoryTransaction,
} from "../lib/inventory";
import { dishMargins, sumCost } from "../lib/cost";
import type { RangeKey } from "../lib/analytics";
import { rangeBounds } from "../lib/analytics";
import { dishStats, rangeToIso, salesSummary } from "../lib/aggregate";
import {
  REASONS,
  normalizeReason,
  wasteRows,
  wasteSummary,
  WASTE_CATEGORY,
  type Reason,
} from "../lib/waste";
import { useChartTheme } from "../lib/theme";

const PIE_COLORS = ["#fb923c", "#f43f5e", "#38bdf8", "#a78bfa", "#34d399"];

const pctFmt = (n: number) => `${(n || 0).toFixed(1)}%`;

export default function Waste({ version = 0 }: { version?: number }) {
  const C = useChartTheme();
  const tooltipStyle = {
    background: C.tipBg,
    border: `1px solid ${C.tipBorder}`,
    borderRadius: 12,
    color: C.tipText,
    fontSize: 12,
  };

  const [range, setRange] = useState<RangeKey>("7d");
  const [txns, setTxns] = useState<InventoryTransaction[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    itemId: "",
    qty: "",
    reason: "过期" as Reason,
    note: "",
  });

  const b = useMemo(() => rangeBounds(range), [range]);
  const iso = useMemo(() => rangeToIso(range), [range]);

  const load = async () => {
    setLoading(true);
    const [t, sum, ds, bm, iv] = await Promise.all([
      fetchTransactions(2000, "waste", new Date(b.start).toISOString()),
      salesSummary(iso.start, iso.end),
      dishStats(iso.start, iso.end),
      fetchBoms(),
      fetchInventory(),
    ]);
    setTxns(t);
    setRevenue(sum.revenue);
    setCogs(sumCost(dishMargins(ds, bm, iv)));
    setInv(iv);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, version]);

  const stats = useMemo(
    () => wasteSummary(txns, b, revenue, cogs),
    [txns, b, revenue, cogs],
  );
  const rows = useMemo(() => wasteRows(txns, b), [txns, b]);
  const reasonData = useMemo(
    () => stats.byReason.map((r) => ({ name: r.name, value: r.amount })),
    [stats.byReason],
  );
  const itemData = useMemo(
    () =>
      stats.byItem.slice(0, 8).map((i) => ({
        name: i.key,
        value: num(i.cost),
      })),
    [stats.byItem],
  );
  const dayData = useMemo(
    () => stats.byDay.map((d) => ({ label: d.key.slice(5), value: d.amount })),
    [stats.byDay],
  );

  const stockable = useMemo(() => inv.filter((i) => num(i.stock) > 0), [inv]);

  const submit = async () => {
    const item = inv.find((i) => i.id === form.itemId);
    if (!item) return toast.error("请选择原料");
    const qty = Math.abs(num(form.qty));
    if (!qty) return toast.error("请输入报损数量");
    if (qty > num(item.stock))
      return toast.error(
        `报损数量不能超过现存 ${num(item.stock)} ${item.unit}`,
      );
    const ok = await recordWaste(item, qty, form.reason, form.note);
    if (!ok) return toast.error("报损失败（检查库存表权限）");
    toast.success(
      `已报损 ${qty}${item.unit} · ${fmtMoney(qty * num(item.price))}`,
    );
    setOpen(false);
    setForm({ itemId: "", qty: "", reason: "过期", note: "" });
    load();
  };

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
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white btn-brand rounded-xl"
        >
          <Plus size={16} /> 登记报损
        </button>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <span className="text-[11px] text-zinc-500">
          损耗率 = 损耗金额 ÷ 同期营收
        </span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          label="损耗总额"
          value={fmtMoney(stats.amount)}
          valueNum={stats.amount}
          format={fmtMoney}
          accent={stats.amount > 0 ? "text-amber-400" : "text-teal-400"}
          bg={stats.amount > 0 ? "bg-amber-500/10" : "bg-teal-500/10"}
        />
        <KpiCard
          icon={Percent}
          label="损耗率（占营收）"
          value={pctFmt(stats.rateOnRevenue)}
          valueNum={stats.rateOnRevenue}
          format={pctFmt}
          sub={`占成本 ${pctFmt(stats.rateOnCogs)}`}
          accent={stats.rateOnRevenue > 3 ? "text-red-400" : "text-green-400"}
          bg={stats.rateOnRevenue > 3 ? "bg-red-500/10" : "bg-green-500/10"}
        />
        <KpiCard
          icon={ClipboardList}
          label="报损笔数"
          value={String(stats.count)}
          valueNum={stats.count}
          sub={`营收 ${fmtMoney(revenue)}`}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={PackageX}
          label="单笔最高"
          value={fmtMoney(stats.maxOne)}
          valueNum={stats.maxOne}
          format={fmtMoney}
          accent="text-violet-400"
          bg="bg-violet-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="按原因分布" subtitle="报损原因分类">
          {loading ? (
            <SkeletonChart h="h-56" />
          ) : reasonData.length === 0 ? (
            <EmptyState
              text="该时段没有报损"
              hint="库存页或右上角「登记报损」可记录损耗"
            />
          ) : (
            <div className="h-56 flex items-center">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="50%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {reasonData.map((_, i) => (
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
                {reasonData.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        background: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                    <span className="text-zinc-300 truncate flex-1">
                      {r.name}
                    </span>
                    <span className="text-zinc-500">{fmtMoney(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="损耗最多原料" subtitle="按损耗金额 Top 8">
          {loading ? (
            <SkeletonChart h="h-56" />
          ) : itemData.length === 0 ? (
            <EmptyState text="暂无损耗记录" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={itemData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke={C.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: C.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fill: C.axis, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => fmtMoney(v)}
                    cursor={{ stroke: "rgba(251,146,60,0.35)" }}
                  />
                  <Bar dataKey="value" fill="#fb923c" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="每日损耗趋势" subtitle="按报损金额">
        {loading ? (
          <SkeletonChart h="h-44" />
        ) : dayData.length === 0 ? (
          <EmptyState text="暂无数据" hint="选择更长的时间范围试试" />
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayData}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: C.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => fmtMoney(v)}
                  cursor={{ stroke: "rgba(251,146,60,0.35)" }}
                />
                <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="报损流水" subtitle={`共 ${rows.length} 笔`}>
        {loading ? (
          <SkeletonTable rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            text="暂无报损记录"
            hint="过期、做坏、出品不合格的原料在这里登记"
            action={
              <button
                onClick={() => setOpen(true)}
                className="px-3.5 py-2 rounded-xl btn-brand text-white text-sm font-semibold"
              >
                登记报损
              </button>
            }
          />
        ) : (
          <>
            <div className="sm:hidden space-y-2.5">
              {rows.slice(0, 200).map((t) => (
                <div key={t.id} className="card-surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">
                        {t.item_name}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {fmtDateTime(t.created_at)}
                      </div>
                    </div>
                    <span className="shrink-0 text-amber-400 font-semibold tnum">
                      {fmtMoney(Math.abs(num(t.quantity)) * num(t.unit_cost))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] border"
                      style={{
                        background: `${WASTE_CATEGORY[normalizeReason(t.reason)].color}1f`,
                        color: WASTE_CATEGORY[normalizeReason(t.reason)].color,
                        borderColor: `${WASTE_CATEGORY[normalizeReason(t.reason)].color}44`,
                      }}
                    >
                      {normalizeReason(t.reason)} ·{" "}
                      {WASTE_CATEGORY[normalizeReason(t.reason)].label}
                    </span>
                    <span className="text-xs text-zinc-400">
                      -{num(t.quantity)} {t.unit}
                    </span>
                    {t.notes && (
                      <span className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                        {t.notes}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {rows.length > 200 && (
                <div className="text-xs text-zinc-600 px-1 py-1">
                  仅显示最近 200 笔，导出前请缩小时间范围
                </div>
              )}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left border-b border-white/5">
                    <th className="px-3 py-2 font-medium">时间</th>
                    <th className="px-3 py-2 font-medium">原料</th>
                    <th className="px-3 py-2 font-medium text-right">数量</th>
                    <th className="px-3 py-2 font-medium text-right">金额</th>
                    <th className="px-3 py-2 font-medium">原因</th>
                    <th className="px-3 py-2 font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-3 py-2.5 text-zinc-400">
                        {fmtDateTime(t.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-white">{t.item_name}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">
                        -{num(t.quantity)} {t.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right text-amber-400 font-semibold">
                        {fmtMoney(Math.abs(num(t.quantity)) * num(t.unit_cost))}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] border"
                          style={{
                            background: `${WASTE_CATEGORY[normalizeReason(t.reason)].color}1f`,
                            color:
                              WASTE_CATEGORY[normalizeReason(t.reason)].color,
                            borderColor: `${WASTE_CATEGORY[normalizeReason(t.reason)].color}44`,
                          }}
                        >
                          {normalizeReason(t.reason)} ·{" "}
                          {WASTE_CATEGORY[normalizeReason(t.reason)].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500 max-w-[200px] truncate">
                        {t.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && (
                <div className="text-xs text-zinc-600 px-3 py-2">
                  仅显示最近 200 笔，导出前请缩小时间范围
                </div>
              )}
            </div>
          </>
        )}
      </ChartCard>

      <Sheet
        open={open}
        title="登记报损"
        subtitle="扣减库存并按现价计入损耗"
        onClose={() => setOpen(false)}
      >
        <div className="space-y-3">
          <select
            value={form.itemId}
            onChange={(e) => setForm({ ...form, itemId: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          >
            <option value="">选择原料…</option>
            {stockable.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}（现存 {num(i.stock)}
                {i.unit}）
              </option>
            ))}
          </select>

          <SheetField
            label="报损数量"
            type="number"
            value={form.qty}
            onChange={(v) => setForm({ ...form, qty: v })}
          />

          <div>
            <div className="text-xs text-zinc-400 mb-1.5">报损原因</div>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, reason: r })}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    form.reason === r
                      ? "bg-amber-500/15 border-amber-500/60 text-amber-400 font-semibold"
                      : "bg-zinc-950 border-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <SheetField
            label="备注（选填）"
            value={form.note}
            onChange={(v) => setForm({ ...form, note: v })}
          />

          <div className="text-right text-sm text-zinc-400">
            本次损耗{" "}
            <span className="text-amber-400 font-bold">
              {fmtMoney(
                Math.abs(num(form.qty)) *
                  num(inv.find((i) => i.id === form.itemId)?.price),
              )}
            </span>
          </div>
        </div>

        <button
          onClick={submit}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold active:scale-[0.98] transition-transform"
        >
          <PackageX size={16} /> 确认报损（扣减库存）
        </button>
      </Sheet>
    </div>
  );
}
