import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Download,
  Wallet,
  Truck,
  AlertTriangle,
  CalendarDays,
  Scale,
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, SkeletonRows } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney } from "../lib/format";
import {
  alertMap,
  buildPriceAlerts,
  checkUnitPrice,
  flaggedAlerts,
  MAX_SAMPLES,
  type PriceAlert,
} from "../lib/priceAlert";
import {
  costImpactForPriceChange,
  createPurchase,
  fetchBoms,
  fetchInventory,
  fetchPurchases,
  num,
  type InventoryItem,
  type PurchaseOrder,
  type RecipeBom,
} from "../lib/inventory";
import { consumptionByItem } from "../lib/aggregate";
import {
  buildPurchasePlan,
  CONSUMPTION_WINDOW_DAYS,
  COVERAGE_DAYS,
  dailyFromConsumption,
} from "../lib/purchasePlan";
import {
  compareInsight,
  rivalItems,
  supplierCompare,
} from "../lib/supplierCompare";

const newLocalId = () =>
  `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** 采购价迷你走势（纯 SVG，不引图表库） */
function Spark({
  points,
  className = "stroke-orange-400",
}: {
  points: number[];
  className?: string;
}) {
  if (points.length < 2) return null;
  const w = 72;
  const h = 22;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((p - min) / span) * (h - 6);
    return [x, y] as const;
  });
  const last = xy[xy.length - 1];
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <polyline
        points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      />
      <circle cx={last[0]} cy={last[1]} r={2} className={className} />
    </svg>
  );
}

/** 价格异常行：等级色条 + 走势 + 幅度 */
function PriceAlertRow({ alert: a }: { alert: PriceAlert }) {
  const up = a.changePct > 0;
  const severe = a.level === "high";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border-l-4 ${
        severe
          ? "border-l-red-500 bg-red-500/[0.07]"
          : "border-l-amber-500 bg-amber-500/[0.07]"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-zinc-200 truncate">{a.itemName}</div>
        <div className="text-xs text-zinc-500">
          近 {a.sampleCount} 次 {fmtMoney(a.priceMin)}~{fmtMoney(a.priceMax)} ·
          中位 {fmtMoney(a.baseline)}/{a.unit} · {a.supplierCount} 家供应商
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Spark
          points={a.spark.map((s) => s.price)}
          className={severe ? "stroke-red-400" : "stroke-amber-400"}
        />
        <div className="text-right">
          <div
            className={`text-sm font-semibold ${
              severe ? "text-red-400" : "text-amber-400"
            }`}
          >
            {up ? "+" : ""}
            {Math.round(a.changePct * 100)}%
          </div>
          <div className="text-xs text-zinc-500">现 {fmtMoney(a.current)}</div>
        </div>
      </div>
    </div>
  );
}

export default function Procurement({ version = 0 }: { version?: number }) {
  const [list, setList] = useState<PurchaseOrder[]>([]);
  const [q, setQ] = useState("");
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [boms, setBoms] = useState<RecipeBom[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    supplier: "",
    itemId: "",
    itemName: "",
    unit: "kg",
    quantity: "",
    unit_price: "",
    notes: "",
    purchased_at: new Date().toISOString().slice(0, 10),
  });
  const [isNew, setIsNew] = useState(false);
  const [coverage, setCoverage] = useState(7);
  const [cons, setCons] = useState<{ key: string; qty: number }[]>([]);
  const [bulk, setBulk] = useState(false);

  const load = async () => {
    setLoading(true);
    const end = new Date();
    const start = new Date(end.getTime() - CONSUMPTION_WINDOW_DAYS * 86400000);
    const [p, i, b, c] = await Promise.all([
      fetchPurchases(),
      fetchInventory(),
      fetchBoms(),
      consumptionByItem(start.toISOString(), end.toISOString()),
    ]);
    setList(p);
    setInv(i);
    setBoms(b);
    setCons(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const stats = useMemo(() => {
    const total = list.reduce((s, p) => s + num(p.total_cost), 0);
    const month = list
      .filter(
        (p) =>
          String(p.purchased_at || p.created_at || "").slice(0, 7) === monthKey,
      )
      .reduce((s, p) => s + num(p.total_cost), 0);
    const suppliers = new Set(list.map((p) => p.supplier).filter(Boolean)).size;
    return { total, month, suppliers };
  }, [list, monthKey]);

  const alerts = useMemo(() => buildPriceAlerts(list), [list]);
  const byItem = useMemo(() => alertMap(alerts), [alerts]);
  const flagged = useMemo(() => flaggedAlerts(alerts), [alerts]);
  const daily = useMemo(
    () => dailyFromConsumption(cons, CONSUMPTION_WINDOW_DAYS),
    [cons],
  );
  const plan = useMemo(
    () =>
      buildPurchasePlan({ items: inv, daily, alerts, coverageDays: coverage }),
    [inv, daily, alerts, coverage],
  );

  // 供应商比价（≥2 家供应商的原料）
  const rivals = useMemo(() => rivalItems(list), [list]);
  const [cmpId, setCmpId] = useState("");
  const activeId = rivals.some((r) => r.itemId === cmpId)
    ? cmpId
    : rivals[0]?.itemId || "";
  const cmpStats = useMemo(
    () => (activeId ? supplierCompare(list, activeId) : []),
    [list, activeId],
  );
  const insight = useMemo(() => compareInsight(cmpStats), [cmpStats]);

  const priceCheck = useMemo(
    () => checkUnitPrice(byItem.get(form.itemId), num(form.unit_price)),
    [byItem, form.itemId, form.unit_price],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (p) =>
        String(p.item_name || "")
          .toLowerCase()
          .includes(needle) ||
        String(p.supplier || "")
          .toLowerCase()
          .includes(needle),
    );
  }, [list, q]);

  const impacts = useMemo(
    () =>
      !isNew && form.itemId
        ? costImpactForPriceChange(form.itemId, num(form.unit_price), boms, inv)
        : [],
    [isNew, form.itemId, form.unit_price, boms, inv],
  );

  const preselect = (item: { id: string; gap: number; price: number }) => {
    setIsNew(false);
    setForm((f) => ({
      ...f,
      itemId: item.id,
      quantity: String(item.gap > 0 ? item.gap : "1"),
      unit_price: String(item.price || ""),
    }));
    setOpen(true);
  };

  /** 按计划一次性生成采购记录并入库（逐条走既有 RPC，失败不阻断） */
  const bulkBuy = async () => {
    if (bulk || !plan.rows.length) return;
    if (
      !confirm(
        `按计划采购 ${plan.rows.length} 项原料，合计约 ${fmtMoney(plan.totalCost)}？\n将生成采购记录并入库。`,
      )
    )
      return;
    setBulk(true);
    let ok = 0;
    for (const r of plan.rows) {
      const done = await createPurchase({
        supplier: "",
        inventory_item_id: r.id,
        item_name: r.name,
        quantity: r.gap,
        unit: r.unit,
        unit_price: r.refPrice,
        notes: `采购计划 · 覆盖 ${plan.coverageDays} 天`,
      });
      if (done) ok += 1;
    }
    setBulk(false);
    if (ok) toast.success(`已生成 ${ok} 条采购记录并入库`);
    else toast.error("生成失败，请稍后重试");
    await load();
  };

  const submit = async () => {
    const name = isNew
      ? form.itemName.trim()
      : inv.find((i) => i.id === form.itemId)?.name;
    const id = isNew ? newLocalId() : form.itemId;
    if (!name || !id) return toast.error("请选择或填写原料");
    if (!num(form.quantity)) return toast.error("请输入数量");
    const isExisting = inv.some((i) => i.id === id);
    const unit =
      isNew || !isExisting
        ? form.unit
        : inv.find((i) => i.id === id)?.unit || form.unit;
    const ok = await createPurchase({
      supplier: form.supplier,
      inventory_item_id: id,
      item_name: name,
      quantity: num(form.quantity),
      unit,
      unit_price: num(form.unit_price),
      notes: form.notes,
      purchased_at: form.purchased_at
        ? new Date(form.purchased_at).toISOString()
        : undefined,
    });
    if (!ok) return toast.error("采购入库失败（检查库存/采购表权限）");
    toast.success("采购已入库");
    setOpen(false);
    setForm({
      ...form,
      itemId: "",
      itemName: "",
      quantity: "",
      unit_price: "",
      notes: "",
    });
    setIsNew(false);
    load();
  };

  const exportCsv = () => {
    if (!list.length) return toast.error("没有可导出的数据");
    const rows = [
      [
        "采购单号",
        "供应商",
        "原料",
        "数量",
        "单位",
        "单价",
        "金额",
        "时间",
        "备注",
      ],
      ...list.map((p) => [
        p.id,
        p.supplier || "",
        p.item_name,
        num(p.quantity),
        p.unit,
        num(p.unit_price),
        num(p.total_cost),
        fmtDateTime(p.purchased_at || p.created_at),
        p.notes || "",
      ]),
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
    a.download = `purchase_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("已导出采购记录");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          label="累计采购支出"
          value={fmtMoney(stats.total)}
          valueNum={stats.total}
          format={fmtMoney}
        />
        <KpiCard
          icon={ShoppingCart}
          label="本月采购支出"
          value={fmtMoney(stats.month)}
          valueNum={stats.month}
          format={fmtMoney}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={Truck}
          label="供应商数"
          value={String(stats.suppliers)}
          valueNum={stats.suppliers}
          accent="text-teal-400"
          bg="bg-teal-500/10"
        />
        <KpiCard
          icon={AlertTriangle}
          label="价格异常"
          value={String(flagged.length)}
          valueNum={flagged.length}
          accent={flagged.length ? "text-red-400" : "text-teal-400"}
          bg={flagged.length ? "bg-red-500/10" : "bg-teal-500/10"}
        />
      </div>

      {flagged.length > 0 && (
        <ChartCard
          title="价格异常"
          subtitle={`与最近 ${MAX_SAMPLES} 次采购单价的中位价比对`}
          action={<AlertTriangle size={18} className="text-red-400" />}
        >
          <div className="space-y-1.5">
            {flagged.map((a) => (
              <PriceAlertRow key={a.itemId} alert={a} />
            ))}
          </div>
        </ChartCard>
      )}

      {plan.rows.length > 0 && (
        <ChartCard
          title="采购计划"
          subtitle={`安全库存 + 近 ${CONSUMPTION_WINDOW_DAYS} 天日均消耗 × ${plan.coverageDays} 天 − 现存`}
          action={<CalendarDays size={18} className="text-amber-400" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <Segmented
              size="sm"
              value={String(coverage)}
              options={COVERAGE_DAYS.map(
                (d) => [String(d), `${d} 天`] as const,
              )}
              onChange={(v) => setCoverage(Number(v))}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-300">
                合计约{" "}
                <b className="text-amber-400">{fmtMoney(plan.totalCost)}</b>
              </span>
              <button
                onClick={bulkBuy}
                disabled={bulk}
                className="px-3.5 py-1.5 rounded-lg btn-brand text-white text-xs font-semibold disabled:opacity-60"
              >
                {bulk ? "下单中…" : `一键采购 ${plan.rows.length} 项`}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {plan.rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-zinc-200">{r.name}</span>
                  {r.priority !== "normal" && (
                    <span
                      className={`inline-flex ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded ${
                        r.priority === "urgent"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {r.priority === "urgent" ? "缺货" : "低于安全"}
                    </span>
                  )}
                  <div className="text-zinc-500 text-xs mt-0.5">
                    现存 {num(r.stock)}
                    {r.unit} · 日均 {num(r.dailyAvg)}
                    {r.unit}
                    {r.daysLeft !== null && ` · 可撑 ${r.daysLeft} 天`}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-zinc-400 text-xs text-right">
                    补 {num(r.gap)}
                    {r.unit} · 约 {fmtMoney(r.estCost)}
                    <span className="block text-zinc-500 text-[10px]">
                      {r.reason}
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      preselect({ id: r.id, gap: r.gap, price: r.refPrice })
                    }
                    className="px-3 py-1.5 rounded-lg btn-brand text-white text-xs font-semibold"
                  >
                    采购
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {rivals.length > 0 && (
        <ChartCard
          title="供应商比价"
          subtitle="同一原料各供应商的加权均价、单价中位数与金额份额"
          action={<Scale size={18} className="text-teal-400" />}
        >
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select
              value={activeId}
              onChange={(e) => setCmpId(e.target.value)}
              className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            >
              {rivals.map((r) => (
                <option key={r.itemId} value={r.itemId}>
                  {r.itemName}（{r.suppliers} 家 · {r.count} 笔）
                </option>
              ))}
            </select>
            {insight && (
              <span className="text-xs text-zinc-400">
                换到 <b className="text-emerald-400">{insight.best.supplier}</b>
                ， 每单位省{" "}
                <b className="text-emerald-400">
                  {fmtMoney(insight.savePerUnit)}
                </b>
                （约 {Math.round(insight.savePct * 100)}%，一次可省{" "}
                {fmtMoney(insight.savePerBuy)}）
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-white/5">
                  <th className="px-3 py-2 font-medium">供应商</th>
                  <th className="px-3 py-2 font-medium text-right">加权均价</th>
                  <th className="px-3 py-2 font-medium text-right">中位单价</th>
                  <th className="px-3 py-2 font-medium text-right">笔数</th>
                  <th className="px-3 py-2 font-medium text-right">金额占比</th>
                  <th className="px-3 py-2 font-medium text-right">最近采购</th>
                </tr>
              </thead>
              <tbody>
                {cmpStats.map((s) => (
                  <tr
                    key={s.supplier}
                    className="border-b border-zinc-800/50 last:border-0"
                  >
                    <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap">
                      {s.supplier}
                      {s.level !== "mid" && (
                        <span
                          className={`inline-flex ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded ${
                            s.level === "best"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {s.level === "best" ? "最低" : "最高"}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold ${
                        s.level === "best"
                          ? "text-emerald-400"
                          : s.level === "worst"
                            ? "text-red-400"
                            : "text-zinc-200"
                      }`}
                    >
                      {fmtMoney(s.avg)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-400">
                      {fmtMoney(s.medianUnit)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-400">
                      {s.count}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-400">
                      {Math.round(s.share * 100)}%
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-500 whitespace-nowrap">
                      {s.lastAt ? fmtDateTime(s.lastAt).slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white btn-brand rounded-xl"
        >
          <Plus size={16} /> 新建采购
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <Download size={16} /> 导出
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索原料 / 供应商"
          className="flex-1 min-w-[160px] bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <ChartCard title="采购记录" subtitle={`共 ${filtered.length} 笔`}>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState text="暂无采购记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-white/5">
                  <th className="px-3 py-2 font-medium">时间</th>
                  <th className="px-3 py-2 font-medium">供应商</th>
                  <th className="px-3 py-2 font-medium">原料</th>
                  <th className="px-3 py-2 font-medium text-right">数量</th>
                  <th className="px-3 py-2 font-medium text-right">单价</th>
                  <th className="px-3 py-2 font-medium text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="px-3 py-2.5 text-zinc-400">
                      {fmtDateTime(p.purchased_at || p.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {p.supplier || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-white">{p.item_name}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {num(p.quantity)} {p.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {fmtMoney(p.unit_price)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-orange-400 font-semibold">
                      {fmtMoney(p.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <Sheet
        open={open}
        title="新建采购入库"
        subtitle="保存后自动增加库存并写入成本流水"
        onClose={() => setOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
            />
            新原料（库存中不存在）
          </div>

          {isNew ? (
            <>
              <input
                placeholder="原料名称"
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
              />
              <input
                placeholder="单位（如 kg / 个 / 包）"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
              />
            </>
          ) : (
            <select
              value={form.itemId}
              onChange={(e) => setForm({ ...form, itemId: e.target.value })}
              className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
            >
              <option value="">选择原料…</option>
              {inv.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}（现存 {num(i.stock)}
                  {i.unit}）
                </option>
              ))}
            </select>
          )}

          <input
            placeholder="供应商（选填）"
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="数量"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
            />
            <input
              type="number"
              placeholder="单价(成本)"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              className={`bg-zinc-950 border rounded-xl px-3 py-2.5 text-sm text-white ${
                priceCheck.level === "ok"
                  ? "border-white/5"
                  : priceCheck.level === "high"
                    ? "border-red-500/60 focus:border-red-400"
                    : "border-amber-500/60 focus:border-amber-400"
              }`}
            />
          </div>
          {priceCheck.message && (
            <div
              className={`-mt-1 text-xs leading-relaxed ${
                priceCheck.level === "high" ? "text-red-400" : "text-amber-400"
              }`}
            >
              {priceCheck.message}
            </div>
          )}
          <input
            type="date"
            value={form.purchased_at}
            onChange={(e) => setForm({ ...form, purchased_at: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          />
          <input
            placeholder="备注（选填）"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
          />
          <div className="text-right text-sm text-zinc-400">
            合计{" "}
            <span className="text-orange-400 font-bold">
              {fmtMoney(num(form.quantity) * num(form.unit_price))}
            </span>
          </div>

          {impacts.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl px-3 py-2.5">
              <div className="text-[11px] text-amber-400 mb-1">
                采购价变动会影响以下菜品成本：
              </div>
              <div className="space-y-1">
                {impacts.slice(0, 6).map((c) => (
                  <div
                    key={c.dish}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-300 truncate mr-2">
                      {c.dish}
                    </span>
                    <span
                      className={
                        c.delta >= 0 ? "text-red-400" : "text-green-400"
                      }
                    >
                      {c.delta >= 0 ? "+" : ""}
                      {fmtMoney(c.delta)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={submit}
          className="mt-4 w-full py-3 rounded-xl btn-brand text-white font-semibold active:scale-[0.98] transition-transform"
        >
          保存并入库
        </button>
      </Sheet>
    </div>
  );
}
