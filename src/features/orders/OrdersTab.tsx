import { useState } from "react";
import { api } from "../../api";
import {
  Sparkles,
  Trash2,
  PlusCircle,
  GitMerge,
  Edit2,
  CheckCircle,
  Printer,
  X,
  LayoutGrid,
  Armchair,
  Clock,
} from "lucide-react";

interface OrdersTabProps {
  orders: any[];
  tables?: any[];
  orderView: "active" | "history";
  setOrderView: (v: "active" | "history") => void;
  currency: string;
  receiptSettings: any;
  onSimulateExternal: () => void;
  onConfirmDialog: (d: any) => void;
  onAddDish: (order: any) => void;
  onMerge: (order: any) => void;
  onCheckout: (order: any) => void;
}

const orderKey = (o: any) => String(o?._id || o?.id || "");

const parseTableName = (o: any): string => {
  let t = String(o?.customerName || o?.table_no || o?.tableNo || "").trim();
  t = t.replace(/^桌号[_ ]?/, "").replace(/^table[_ ]?/i, "");
  return t || "未知";
};

const formatTime = (ts: any) => {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts || "");
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "待接单", cls: "bg-orange-500/20 text-orange-400" },
  cooking: { text: "制作中", cls: "bg-blue-500/20 text-blue-400" },
  served: { text: "已上菜", cls: "bg-teal-500/20 text-teal-400" },
  completed: { text: "已结账", cls: "bg-green-500/20 text-green-400" },
  cancelled: { text: "已取消", cls: "bg-red-500/20 text-red-400" },
};

function StatusBadge({ status }: { status?: string }) {
  const s = STATUS_LABEL[status || "pending"] || {
    text: "待接单",
    cls: "bg-orange-500/20 text-orange-400",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${s.cls}`}>
      {s.text}
    </span>
  );
}

export function OrdersTab({
  orders,
  tables = [],
  orderView,
  setOrderView,
  currency,
  receiptSettings,
  onSimulateExternal,
  onConfirmDialog,
  onAddDish,
  onMerge,
  onCheckout,
}: OrdersTabProps) {
  const [view, setView] = useState<"orders" | "tables">("orders");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleOrders = orders.filter((o) =>
    orderView === "history"
      ? o.status === "completed"
      : o.status !== "completed" && o.status !== "cancelled",
  );
  const activeOrders = orders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled",
  );

  const selected = orders.find((o) => orderKey(o) === selectedId) || null;

  // 桌位看板：按桌号聚合（订单自动生成桌位 + 已知桌位显示为空闲）
  const tableMap = new Map<
    string,
    { table: string; orders: any[]; total: number }
  >();
  activeOrders.forEach((o) => {
    const t = parseTableName(o);
    if (!tableMap.has(t)) tableMap.set(t, { table: t, orders: [], total: 0 });
    const entry = tableMap.get(t)!;
    entry.orders.push(o);
    entry.total += Number(o.total || o.total_amount || 0);
  });
  (tables || []).forEach((tb: any) => {
    const t = String(tb?.tableNo || "").trim();
    if (t && !tableMap.has(t))
      tableMap.set(t, { table: t, orders: [], total: 0 });
  });
  const tableList = Array.from(tableMap.values()).sort((a, b) => {
    if (a.orders.length && !b.orders.length) return -1;
    if (!a.orders.length && b.orders.length) return 1;
    return a.table.localeCompare(b.table);
  });

  const renderActions = (order: any) => (
    <div className="flex flex-wrap items-center gap-2">
      {order?.status !== "completed" && (
        <>
          <button
            onClick={() => onAddDish(order)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-white font-semibold transition-all active:scale-95"
          >
            <PlusCircle size={14} /> 加菜
          </button>
          <button
            onClick={() => onMerge(order)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-all active:scale-95"
          >
            <GitMerge size={14} /> 并入订单
          </button>
          {(!order?.status || order?.status === "pending") && (
            <button
              onClick={async () => {
                try {
                  await api.updateOrderStatus(order._id, "cooking");
                } catch {
                  alert("操作失败");
                }
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
            >
              接单
            </button>
          )}
          {order?.status === "cooking" && (
            <button
              onClick={async () => {
                try {
                  await api.updateOrderStatus(order._id, "served");
                } catch {
                  alert("操作失败");
                }
              }}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-white transition-colors"
            >
              上菜
            </button>
          )}
          <button
            onClick={async () => {
              const cur = parseTableName(order);
              const nt = prompt(
                "请输入新的桌号 (Enter new table number):",
                cur,
              );
              if (nt && nt.trim() && nt.trim() !== cur) {
                try {
                  await api.updateOrder(order._id, {
                    customerName: `桌号_${nt.trim()}`,
                  });
                } catch {
                  alert("修改失败");
                }
              }
            }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white transition-colors"
          >
            <Edit2 size={14} /> 换台
          </button>
          <button
            onClick={() => onCheckout(order)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white transition-colors"
          >
            <CheckCircle size={14} /> 结账
          </button>
        </>
      )}
      <button
        onClick={() =>
          import("../../lib/print").then((m) =>
            m.printReceipt(order, currency, receiptSettings, true),
          )
        }
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
      >
        <Printer size={14} /> 厨房单
      </button>
      <button
        onClick={() =>
          import("../../lib/print").then((m) =>
            m.printReceipt(order, currency, receiptSettings),
          )
        }
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
      >
        <Printer size={14} /> 小票
      </button>
      {order?.items?.some((item: any) => item.isAdded) && (
        <button
          onClick={() =>
            import("../../lib/print").then((m) => {
              const additionsOrder = {
                ...order,
                items: order.items.filter((i: any) => i.isAdded),
              };
              m.printReceipt(
                additionsOrder,
                currency,
                receiptSettings,
                false,
                "addition",
              );
            })
          }
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg text-orange-400 transition-colors"
        >
          <Printer size={14} /> 加菜单
        </button>
      )}
      <button
        onClick={() =>
          onConfirmDialog({
            isOpen: true,
            message: "确定要删除此订单吗？",
            onConfirm: async () => {
              try {
                await api.deleteOrder(order._id);
              } catch (e) {
                console.error(e);
              }
              setSelectedId(null);
              onConfirmDialog(null);
            },
          })
        }
        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
      >
        <Trash2 size={14} /> 删除
      </button>
    </div>
  );

  return (
    <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
      {/* 视图切换：订单卡片 / 桌位看板 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button
            onClick={() => setView("orders")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === "orders" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            <LayoutGrid size={15} /> 订单卡片
          </button>
          <button
            onClick={() => setView("tables")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === "tables" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
          >
            <Armchair size={15} /> 桌位看板
          </button>
        </div>
      </div>

      {view === "orders" ? (
        <>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
              <button
                onClick={() => setOrderView("active")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${orderView === "active" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              >
                活跃 ({activeOrders.length})
              </button>
              <button
                onClick={() => setOrderView("history")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${orderView === "history" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              >
                历史 ({orders.filter((o) => o.status === "completed").length})
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSimulateExternal}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors border border-orange-500/20"
              >
                <Sparkles size={16} /> 模拟订单
              </button>
              {visibleOrders.length > 0 && (
                <button
                  onClick={() => {
                    const statusToClear =
                      orderView === "history" ? "completed" : "pending";
                    onConfirmDialog({
                      isOpen: true,
                      message: `确定要清空${orderView === "history" ? "历史" : "活跃"}订单吗？`,
                      onConfirm: async () => {
                        try {
                          await api.clearOrders(statusToClear);
                        } catch (e) {
                          console.error(e);
                        }
                        onConfirmDialog(null);
                      },
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                >
                  <Trash2 size={16} /> 清空
                </button>
              )}
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <p className="text-zinc-500 text-center py-10">
              暂无订单 (No orders)
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleOrders.map((order) => {
                const id = orderKey(order);
                const items = order?.items || [];
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className="text-left bg-zinc-900 border border-zinc-800 hover:border-orange-500/60 rounded-2xl p-4 transition-all active:scale-[0.98] flex flex-col gap-2 min-h-[120px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl font-black text-white leading-none truncate">
                        {parseTableName(order)}
                      </span>
                      <StatusBadge status={order?.status} />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Clock size={12} /> {formatTime(order?.timestamp)}
                    </div>
                    <div className="mt-auto flex items-end justify-between">
                      <span className="text-[11px] text-zinc-400">
                        {items.length} 项
                      </span>
                      <span className="text-lg font-bold text-orange-400">
                        {order?.total || 0}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-zinc-500 mb-4">
            按订单桌号自动生成桌位。橙色=有单占用，灰色=空闲。
          </p>
          {tableList.length === 0 ? (
            <p className="text-zinc-500 text-center py-10">
              暂无桌位 (No tables)
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {tableList.map((t) => {
                const occupied = t.orders.length > 0;
                return (
                  <button
                    key={t.table}
                    onClick={() =>
                      occupied && setSelectedId(orderKey(t.orders[0]))
                    }
                    className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-1 min-h-[104px] border transition-all active:scale-[0.98] ${
                      occupied
                        ? "bg-orange-600/20 border-orange-500/60 text-orange-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500"
                    }`}
                  >
                    <Armchair
                      size={22}
                      className={occupied ? "text-orange-400" : "text-zinc-600"}
                    />
                    <span className="text-xl font-black leading-none">
                      {t.table}
                    </span>
                    {occupied ? (
                      <span className="text-[11px] font-semibold">
                        {t.orders.length} 单 · {t.total}
                      </span>
                    ) : (
                      <span className="text-[11px]">空闲</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 订单详情弹窗：点击卡片后打印/加菜/结账等 */}
      {selected && (
        <div
          className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-white">
                    {parseTableName(selected)}
                  </span>
                  <StatusBadge status={selected?.status} />
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {formatTime(selected?.timestamp)} · 单号{" "}
                  {selected?.orderNumber || "N/A"}
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap gap-2 mb-4">
                {renderActions(selected)}
              </div>

              {selected?.status !== "completed" && (
                <ul className="space-y-2">
                  {(selected?.items || []).map((item: any, i: number) =>
                    item ? (
                      <li
                        key={i}
                        className={`flex justify-between items-center text-sm p-2.5 rounded-lg ${item.served ? "bg-green-500/10 text-green-500/70 line-through" : item.isAdded ? "bg-orange-500/10 border border-orange-500/20" : "bg-zinc-950"}`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              const newItems = [...selected.items];
                              newItems[i] = {
                                ...item,
                                served: !item.served,
                              };
                              try {
                                await api.updateOrder(selected._id, {
                                  items: newItems,
                                });
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className={`p-1 rounded-full border ${item.served ? "bg-green-500 text-white border-green-500" : "border-zinc-500 text-transparent hover:border-zinc-300"}`}
                          >
                            <CheckCircle size={14} />
                          </button>
                          <span
                            className={
                              item.served
                                ? "text-green-500/70"
                                : item.isAdded
                                  ? "text-orange-400 font-medium"
                                  : "text-zinc-300"
                            }
                          >
                            {item?.name || ""}
                            {item?.isAdded ? (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-500 rounded-sm">
                                加菜
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {(!selected?.status ||
                            selected?.status === "pending") && (
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    `确定要退掉一个 ${item?.name || ""} 吗？`,
                                  )
                                ) {
                                  const newItems = [...selected.items];
                                  let newTotal =
                                    (selected.total || 0) -
                                    (newItems[i]?.price || 0);
                                  if (newTotal < 0) newTotal = 0;
                                  if (newItems[i].quantity > 1) {
                                    newItems[i] = {
                                      ...newItems[i],
                                      quantity: newItems[i].quantity - 1,
                                    };
                                  } else {
                                    newItems.splice(i, 1);
                                  }
                                  try {
                                    await api.updateOrder(selected._id, {
                                      items: newItems,
                                      total: newTotal,
                                    });
                                  } catch {
                                    alert("退菜失败");
                                  }
                                }
                              }}
                              className="text-xs text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors whitespace-nowrap"
                            >
                              退菜
                            </button>
                          )}
                          <span
                            className={
                              item.served
                                ? "text-green-500/70"
                                : "text-zinc-500"
                            }
                          >
                            x{item?.quantity || 1}
                          </span>
                          <span
                            className={`${item.served ? "text-green-500/70" : "text-zinc-400"} w-14 text-right`}
                          >
                            {(
                              (item?.price || 0) * (item?.quantity || 1)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </li>
                    ) : null,
                  )}
                </ul>
              )}

              <div className="flex justify-between items-center mt-5 pt-4 border-t border-zinc-800">
                <span className="text-zinc-400 text-sm">合计</span>
                <span className="text-2xl font-black text-orange-400">
                  {selected?.total || 0} {currency !== "none" ? currency : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
