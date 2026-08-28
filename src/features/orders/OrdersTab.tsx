import { api } from "../../api";
import { Sparkles, Trash2, PlusCircle, GitMerge, Edit2, CheckCircle, Printer } from "lucide-react";

interface OrdersTabProps {
  orders: any[];
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

export function OrdersTab({
  orders,
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
  return (                <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                      <button
                        onClick={() => setOrderView("active")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${orderView === "active" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                      >
                        活跃订单 (Active)
                      </button>
                      <button
                        onClick={() => setOrderView("history")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${orderView === "history" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
                      >
                        历史订单 (History)
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={onSimulateExternal}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors border border-orange-500/20"
                      >
                        <Sparkles size={16} />
                        模拟外部订单
                      </button>
                      {orders.filter(o => orderView === "history" ? o.status === "completed" : o.status !== "completed").length > 0 && (
                        <button
                          onClick={() => {
                            const statusToClear = orderView === "history" ? "completed" : "pending";
                            onConfirmDialog({
                              isOpen: true,
                              message:
                                `确定要清空${orderView === "history" ? "历史" : "活跃"}订单记录吗？\n(Are you sure you want to clear ${orderView === "history" ? "historical" : "active"} orders?)`,
                              onConfirm: async () => {
                                try {
                                  await api.clearOrders(statusToClear);
                                } catch (e) {
                                  console.error("Failed to delete orders:", e);
                                }
                                onConfirmDialog(null);
                              },
                            });
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                        >
                          <Trash2 size={16} />
                          清空记录 (Clear)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {orders.filter(o => orderView === "history" ? o.status === "completed" : o.status !== "completed").length === 0 ? (
                      <p className="text-zinc-500 text-center py-8">
                        暂无订单记录 (No orders yet)
                      </p>
                    ) : (
                      orders.filter(o => orderView === "history" ? o.status === "completed" : o.status !== "completed").map((order, idx) =>
                        order ? (
                          <div
                            key={idx}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-orange-400 font-bold text-lg">
                                  桌号/顾客名 (Table/Name):{" "}
                                  {order?.customerName || "未填写"}
                                </span>
                                {order?.deviceName && (
                                  <div className="text-zinc-500 text-sm mt-1">
                                    设备 (Device): {order.deviceName}
                                  </div>
                                )}
                                <div className="text-zinc-400 text-xs mt-1">
                                  时间:{" "}
                                  {order?.timestamp
                                    ? (() => {
                                        try {
                                          const d = new Date(order.timestamp);
                                          if (isNaN(d.getTime()))
                                            return String(order.timestamp);
                                          return d.toLocaleString("zh-CN");
                                        } catch (e) {
                                          return String(order.timestamp);
                                        }
                                      })()
                                    : ""}
                                </div>
                                <div className="text-zinc-500 text-xs mt-1">
                                  单号: {order?.orderNumber || "N/A"}
                                </div>
                                {order?.deviceInfo && (
                                  <div className="text-blue-400 text-xs mt-1">
                                    设备 (Device): {order.deviceInfo}
                                  </div>
                                )}
                                {order?.isExternal && (
                                  <div className="text-orange-500 text-xs mt-1">
                                    来自外部网站 (External Web)
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2">
                                  {order?.status === "completed" && (
                                    <>
                                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded font-bold">
                                      已结账 (Completed)
                                    </span>
                                    {order?.paymentMethod && (
                                      <span className="text-[11px] text-orange-400 font-semibold bg-orange-500/10 border border-orange-500/30 px-1.5 py-0.5 rounded">
                                        💳 {order.paymentMethod}
                                      </span>
                                    )}
                                    </>
                                  )}
                                  {order?.status === "served" && (
                                    <span className="text-xs px-2 py-1 bg-teal-500/20 text-teal-500 rounded font-bold">
                                      已上菜 (Served)
                                    </span>
                                  )}
                                  {order?.status === "preparing" && (
                                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-500 rounded font-bold">
                                      制作中 (Preparing)
                                    </span>
                                  )}
                                  {(!order?.status ||
                                    order?.status === "pending") && (
                                    <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-500 rounded font-bold">
                                      待接单 (Pending)
                                    </span>
                                  )}
                                  <div className="text-white font-bold text-lg">
                                    {order?.total || ""}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-2 mt-1">
                                  {order?.status !== "completed" && (
                                    <>
                                      <button
                                        onClick={() => {
                                          onAddDish(order);
                                        }}
                                        className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-500 rounded-lg text-white font-semibold transition-all shadow-md shadow-amber-600/20 active:scale-95"
                                      >
                                        <PlusCircle size={14} /> 加菜
                                      </button>
                                      <button
                                        onClick={() => {
                                          onMerge(order);
                                        }}
                                        className="flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-semibold transition-all shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer"
                                      >
                                        <GitMerge size={14} /> 并入订单
                                      </button>
                                      {(!order?.status || order?.status === "pending") && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              await api.updateOrderStatus(order._id, "preparing");
                                            } catch (e) {
                                              alert("操作失败 (Failed to update status)");
                                            }
                                          }}
                                          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
                                        >
                                          接单 (Accept)
                                        </button>
                                      )}
                                      {order?.status === "preparing" && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              await api.updateOrderStatus(order._id, "served");
                                            } catch (e) {
                                              alert("操作失败 (Failed to update status)");
                                            }
                                          }}
                                          className="flex items-center gap-1 text-xs px-2 py-1 bg-teal-600 hover:bg-teal-500 rounded text-white transition-colors"
                                        >
                                          上菜 (Serve)
                                        </button>
                                      )}
                                      <button
                                        onClick={async () => {
                                          let currentTable =
                                            order?.customerName || "";
                                          if (
                                            currentTable.startsWith("桌号_")
                                          ) {
                                            currentTable = currentTable.replace(
                                              "桌号_",
                                              "",
                                            );
                                          }
                                          const newTable = prompt(
                                            "请输入新的桌号 (Enter new table number):",
                                            currentTable,
                                          );
                                          if (
                                            newTable &&
                                            newTable.trim() &&
                                            newTable.trim() !== currentTable
                                          ) {
                                            try {
                                              await api.updateOrder(order._id, {
                                                customerName: `桌号_${newTable.trim()}`,
                                              });
                                            } catch (e) {
                                              alert(
                                                "修改失败 (Failed to update table)",
                                              );
                                            }
                                          }
                                        }}
                                        className="flex items-center gap-1 text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-white transition-colors"
                                      >
                                        <Edit2 size={14} /> 换台 (Change Table)
                                      </button>
                                      <button
                                        onClick={() => {
                                          onCheckout(order);
                                        }}
                                        className="flex items-center gap-1 text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors"
                                      >
                                        <CheckCircle size={14} /> 结账
                                        (Complete)
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      import("../../lib/print").then((m) =>
                                        m.printReceipt(
                                          order,
                                          currency,
                                          receiptSettings,
                                          true, // isKitchenTicket
                                        ),
                                      );
                                    }}
                                    className="flex items-center gap-1 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
                                  >
                                    <Printer size={14} /> 厨房做菜单
                                  </button>
                                  <button
                                    onClick={() => {
                                      import("../../lib/print").then((m) =>
                                        m.printReceipt(
                                          order,
                                          currency,
                                          receiptSettings,
                                        ),
                                      );
                                    }}
                                    className="flex items-center gap-1 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
                                  >
                                    <Printer size={14} /> 打印小票
                                  </button>
                                  {order?.items?.some((item: any) => item.isAdded) && (
                                    <button
                                      onClick={() => {
                                        import("../../lib/print").then((m) => {
                                          const additionsOrder = { ...order, items: order.items.filter((i: any) => i.isAdded) };
                                          m.printReceipt(
                                            additionsOrder,
                                            currency,
                                            receiptSettings,
                                            false,
                                            "addition"
                                          );
                                        });
                                      }}
                                      className="flex items-center gap-1 text-xs px-2 py-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded text-orange-500 transition-colors"
                                    >
                                      <Printer size={14} /> 打印加菜单
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      onConfirmDialog({
                                        isOpen: true,
                                        message: "确定要删除此订单吗？ (Are you sure you want to delete this order?)",
                                        onConfirm: async () => {
                                          try {
                                            await api.deleteOrder(order._id);
                                          } catch (e) {
                                            console.error("Failed to delete order", e);
                                          }
                                          onConfirmDialog(null);
                                        }
                                      });
                                    }}
                                    className="flex items-center gap-1 text-xs px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                  >
                                    <Trash2 size={14} /> 删除
                                  </button>
                                </div>
                              </div>
                            </div>
                            {order?.status !== "completed" && (
                              <ul className="space-y-2 mt-3 pt-3 border-t border-zinc-800/50">
                                {order?.items?.map((item: any, i: number) =>
                                  item ? (
                                    <li
                                      key={i}
                                      className={`flex justify-between items-center text-sm p-2 rounded ${item.served ? "bg-green-500/10 text-green-500/70 line-through" : item.isAdded ? "bg-orange-500/10 border border-orange-500/20" : "bg-zinc-900"}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={async () => {
                                            const newItems = [...order.items];
                                            newItems[i] = {
                                              ...item,
                                              served: !item.served,
                                            };
                                            try {
                                              await api.updateOrder(order._id, {
                                                items: newItems,
                                              });
                                            } catch (e) {
                                              console.error(
                                                "Failed to update item status:",
                                                e,
                                              );
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
                                          {item?.isAdded && !item.served ? <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-500 rounded-sm">加菜</span> : ""}
                                          {item?.isAdded && item.served ? " (加菜)" : ""}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {(!order?.status ||
                                          order?.status === "pending") && (
                                          <button
                                            onClick={async () => {
                                              if (
                                                confirm(
                                                  `确定要退掉一个 ${item?.name || ""} 吗？(Refund one item?)`,
                                                )
                                              ) {
                                                const newItems = [
                                                  ...order.items,
                                                ];
                                                const currentItem = newItems[i];
                                                let newTotal =
                                                  (order.total || 0) -
                                                  (currentItem?.price || 0);
                                                if (newTotal < 0) newTotal = 0;

                                                if (currentItem.quantity > 1) {
                                                  newItems[i] = {
                                                    ...currentItem,
                                                    quantity:
                                                      currentItem.quantity - 1,
                                                  };
                                                } else {
                                                  newItems.splice(i, 1);
                                                }

                                                try {
                                                  await api.updateOrder(
                                                    order._id,
                                                    {
                                                      items: newItems,
                                                      total: newTotal,
                                                    },
                                                  );
                                                } catch (e) {
                                                  alert(
                                                    "退菜失败 (Failed to refund)",
                                                  );
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
                                          className={`${item.served ? "text-green-500/70" : "text-zinc-400"} w-12 text-right`}
                                        >
                                          {(item?.price || 0) *
                                            (item?.quantity || 1)}
                                        </span>
                                      </div>
                                    </li>
                                  ) : null,
                                )}
                              </ul>
                            )}
                          </div>
                        ) : null,
                      )
                    )}
                  </div>
                </div>
  );
}
