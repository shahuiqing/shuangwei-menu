import { useEffect, useMemo, useState } from "react";
import {
  Route,
  Search,
  ChevronRight,
  PackageSearch,
  ShoppingCart,
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, SkeletonRows } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney } from "../lib/format";
import { fetchInventory, num, type InventoryItem } from "../lib/inventory";
import { fetchOrdersPage } from "../lib/aggregate";
import { orderItems, orderTotal } from "../lib/analytics";
import {
  fetchOrderTxns,
  fetchPurchasesByItems,
  fetchItemOutflows,
  fetchItemPurchases,
  fetchOrdersByIds,
  orderTraceRows,
  traceTotals,
  latestPurchases,
  outOrderRows,
  outSummary,
  type TraceRow,
  type OutOrderRow,
} from "../lib/trace";

type Mode = "forward" | "reverse";

const col = "px-3 py-2 text-sm";

export default function Trace({ version = 0 }: { version?: number }) {
  const [mode, setMode] = useState<Mode>("forward");
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 正向：订单搜索
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [purch, setPurch] = useState<Map<string, any>>(new Map());

  // 反向：原料
  const [itemId, setItemId] = useState("");
  const [outRows, setOutRows] = useState<OutOrderRow[]>([]);
  const [outOrders, setOutOrders] = useState<any[]>([]);
  const [itemPurch, setItemPurch] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await fetchInventory();
      if (alive) {
        setInv(list);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    if (mode !== "forward" || !qDebounced) {
      setCandidates([]);
      return;
    }
    (async () => {
      const iso = new Date(Date.now() - 180 * 86400000).toISOString();
      const { rows: found } = await fetchOrdersPage({
        start: iso,
        end: new Date(Date.now() + 86400000).toISOString(),
        search: qDebounced,
        limit: 8,
      });
      if (alive) setCandidates(found);
    })();
    return () => {
      alive = false;
    };
  }, [mode, qDebounced]);

  const totals = useMemo(() => traceTotals(rows), [rows]);
  const latest = useMemo(() => latestPurchases(purch as any), [purch]);
  const outSum = useMemo(() => outSummary(outRows), [outRows]);

  const openOrder = async (o: any) => {
    setPicked(o);
    setRows([]);
    setPurch(new Map());
    setDetailLoading(true);
    const txns = await fetchOrderTxns(String(o.id || o._id || ""));
    const traceRows = orderTraceRows(txns);
    setRows(traceRows);
    const ids = traceRows.map((r) => r.itemId);
    const ps = await fetchPurchasesByItems(ids);
    setPurch(new Map(latestPurchases(ps) as any));
    setDetailLoading(false);
    if (!traceRows.length) {
      toast.info(
        "该订单暂无 BOM 扣减流水（可能菜品未配配方，或历史订单未回补）",
      );
    }
  };

  const openItem = async (id: string) => {
    setItemId(id);
    setOutRows([]);
    setOutOrders([]);
    setItemPurch([]);
    if (!id) return;
    setDetailLoading(true);
    const [outs, ps] = await Promise.all([
      fetchItemOutflows(id),
      fetchItemPurchases(id),
    ]);
    const ors = outOrderRows(outs);
    setOutRows(ors);
    setItemPurch(ps);
    const orders = await fetchOrdersByIds(ors.map((r) => r.orderId));
    setOutOrders(orders);
    setDetailLoading(false);
  };

  const orderLabel = (o: any) => {
    const t = fmtDateTime(o.timestamp || o.created_at || "");
    const amt = fmtMoney(orderTotal(o));
    const cnt = orderItems(o).length;
    return `${t} · ${cnt} 菜品 · ${amt}${o.table_no ? ` · ${o.table_no}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v);
            setPicked(null);
            setRows([]);
            setItemId("");
            setOutRows([]);
            setOutOrders([]);
            setItemPurch([]);
          }}
          options={[
            ["forward", "正向 · 订单→原料"],
            ["reverse", "反向 · 原料→订单"],
          ]}
        />
        <div className="text-xs text-zinc-500">
          订单扣减 → 配方用料 → 采购批次 → 供应商
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : mode === "forward" ? (
        <>
          <div className="relative max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索订单：桌号 / 客人 / 单号…"
              className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          {qDebounced && (
            <div className="rounded-2xl bg-zinc-900/60 border border-white/5 divide-y divide-white/5">
              {candidates.length === 0 && (
                <div className="px-4 py-3 text-sm text-zinc-500">
                  近半年内没有匹配的订单
                </div>
              )}
              {candidates.map((o) => {
                const id = String(o.id || o._id || "");
                const on = picked && String(picked.id || picked._id) === id;
                return (
                  <button
                    key={id}
                    onClick={() => openOrder(o)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-white/5 ${
                      on ? "bg-orange-500/10" : ""
                    }`}
                  >
                    <span className="text-sm text-zinc-200 truncate">
                      {orderLabel(o)}
                    </span>
                    <ChevronRight size={14} className="text-zinc-500" />
                  </button>
                );
              })}
            </div>
          )}

          {picked && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  icon={Route}
                  label="菜品数"
                  value={String(orderItems(picked).length)}
                />
                <KpiCard
                  icon={ShoppingCart}
                  label="订单金额"
                  value={fmtMoney(orderTotal(picked))}
                />
                <KpiCard
                  icon={PackageSearch}
                  label="原料成本"
                  value={fmtMoney(totals.cost)}
                />
                <KpiCard
                  icon={Route}
                  label="覆盖原料"
                  value={`${totals.items} 种`}
                  sub={`${totals.qty.toFixed(2)} 单位用量`}
                />
              </div>

              <ChartCard title={`溯源链路 · ${orderLabel(picked)}`}>
                {detailLoading ? (
                  <SkeletonRows rows={4} />
                ) : rows.length === 0 ? (
                  <EmptyState
                    text="没有可溯源的扣减记录"
                    hint="为菜品配置配方 BOM 并结账后，这里会显示每道菜消耗的原料与采购批次"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-zinc-500 border-b border-white/5">
                          <th className={col}>菜品</th>
                          <th className={col}>原料</th>
                          <th className={`${col} text-right`}>用量</th>
                          <th className={`${col} text-right`}>单位成本</th>
                          <th className={`${col} text-right`}>小计</th>
                          <th className={col}>最近采购</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {rows.map((r) => {
                          const p = latest.get(r.itemId);
                          return (
                            <tr key={`${r.itemId}|${r.dish}`}>
                              <td className={`${col} text-zinc-300`}>
                                {r.dish}
                              </td>
                              <td
                                className={`${col} text-zinc-200 font-medium`}
                              >
                                {r.itemName || r.itemId}
                              </td>
                              <td className={`${col} text-right tnum`}>
                                {r.qty.toFixed(2)}
                                {r.unit}
                              </td>
                              <td
                                className={`${col} text-right tnum text-zinc-400`}
                              >
                                {fmtMoney(r.unitCost)}
                              </td>
                              <td
                                className={`${col} text-right tnum text-orange-400 font-semibold`}
                              >
                                {fmtMoney(r.cost)}
                              </td>
                              <td className={`${col} text-xs text-zinc-400`}>
                                {p ? (
                                  <span>
                                    {p.supplier || "未知供应商"} ·{" "}
                                    {fmtDateTime(p.purchased_at)} ·{" "}
                                    {fmtMoney(num(p.unit_price))}/{p.unit}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600">
                                    无采购记录
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-3 flex justify-end gap-6 text-sm">
                      <span className="text-zinc-500">
                        合计用量{" "}
                        <b className="tnum text-zinc-300">
                          {totals.qty.toFixed(2)}
                        </b>
                      </span>
                      <span className="text-zinc-500">
                        原料成本{" "}
                        <b className="tnum text-orange-400">
                          {fmtMoney(totals.cost)}
                        </b>
                      </span>
                    </div>
                  </div>
                )}
              </ChartCard>
            </>
          )}
        </>
      ) : (
        <>
          <div className="max-w-md">
            <select
              value={itemId}
              onChange={(e) => openItem(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">选择原料…</option>
              {inv.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}（库存 {num(i.stock)}
                  {i.unit}）
                </option>
              ))}
            </select>
          </div>

          {itemId && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  icon={PackageSearch}
                  label="消耗订单"
                  value={String(outSum.orders)}
                  sub="近期有出库记录"
                />
                <KpiCard
                  icon={Route}
                  label="消耗总量"
                  value={`${outSum.qty.toFixed(2)}${
                    inv.find((i) => i.id === itemId)?.unit || ""
                  }`}
                />
                <KpiCard
                  icon={ShoppingCart}
                  label="采购次数"
                  value={String(itemPurch.length)}
                  sub="入库批次"
                />
                <KpiCard
                  icon={PackageSearch}
                  label="当前库存"
                  value={`${num(inv.find((i) => i.id === itemId)?.stock)}${
                    inv.find((i) => i.id === itemId)?.unit || ""
                  }`}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <ChartCard title="消耗该原料的订单">
                  {detailLoading ? (
                    <SkeletonRows rows={3} />
                  ) : outRows.length === 0 ? (
                    <EmptyState
                      text="近期没有出库消耗"
                      hint="结账订单绑定配方后，会在这里看到哪些订单消耗了该原料"
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {outRows.map((r) => {
                        const o = outOrders.find(
                          (x) => String(x.id || x._id) === r.orderId,
                        );
                        return (
                          <div
                            key={r.orderId}
                            className="flex items-center justify-between bg-zinc-950 rounded-xl px-3 py-2.5 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="text-zinc-200 truncate">
                                {o ? orderLabel(o) : r.orderId}
                              </div>
                              <div className="text-[11px] text-zinc-500 mt-0.5">
                                用于 {r.dish} · {fmtDateTime(r.at)}
                              </div>
                            </div>
                            <span className="tnum text-orange-400 font-semibold shrink-0 ml-2">
                              {r.qty.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="采购入库历史">
                  {detailLoading ? (
                    <SkeletonRows rows={3} />
                  ) : itemPurch.length === 0 ? (
                    <EmptyState
                      text="还没有采购记录"
                      hint="在「采购管理」入库后，这里会显示供应商与批次单价"
                    />
                  ) : (
                    <div className="space-y-1.5">
                      {itemPurch.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between bg-zinc-950 rounded-xl px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="text-zinc-200 truncate">
                              {p.supplier || "未知供应商"}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              {fmtDateTime(p.purchased_at)} · {num(p.quantity)}
                              {p.unit}
                            </div>
                          </div>
                          <span className="tnum text-sky-400 font-semibold shrink-0 ml-2">
                            {fmtMoney(num(p.unit_price))}/{p.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ChartCard>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
