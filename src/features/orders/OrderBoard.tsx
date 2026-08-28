import { useState } from "react";
import { api } from "../../api";
import { PlusCircle, X, Search, Minus, Plus, Loader2, GitMerge, Flame } from "lucide-react";

interface OrderBoardProps {
  orders: any[];
  categories: any[];
  setCategories: (c: any[]) => void;
  currency: string;
  receiptSettings: any;
  onSaveToCloud?: (overrides?: any) => void;
  onConfirmDialog: (d: any) => void;
  addDishTargetOrder: any;
  setAddDishTargetOrder: (o: any) => void;
  mergeSourceOrder: any;
  setMergeSourceOrder: (o: any) => void;
}

export function OrderBoard({
  orders,
  categories,
  setCategories,
  currency,
  receiptSettings,
  onSaveToCloud,
  onConfirmDialog,
  addDishTargetOrder,
  setAddDishTargetOrder,
  mergeSourceOrder,
  setMergeSourceOrder,
}: OrderBoardProps) {
  const [addDishCart, setAddDishCart] = useState<Record<string, number>>({});
  const [addDishCategory, setAddDishCategory] = useState<string>("all");
  const [addDishSearch, setAddDishSearch] = useState<string>("");
  const [isSubmittingAddDish, setIsSubmittingAddDish] = useState(false);

  const [mergeTargetOrderId, setMergeTargetOrderId] = useState<string>("");
  const [isMergingOrders, setIsMergingOrders] = useState(false);

  const handleExecuteMergeOrders = async () => {
    if (!mergeSourceOrder || !mergeTargetOrderId) return;
    const targetOrder = orders.find((o) => (o._id || o.id) === mergeTargetOrderId);
    if (!targetOrder) {
      alert("未找到目标订单！");
      return;
    }

    try {
      setIsMergingOrders(true);
      const sourceItems = mergeSourceOrder.items || [];
      const sanitizedSourceItems = sourceItems.map((item: any) => ({
        ...item,
        isAdded: true,
      }));

      const existingTargetItems = targetOrder.items || [];
      const newItems = [...existingTargetItems, ...sanitizedSourceItems];
      const sourceTotal = Number(mergeSourceOrder.total || mergeSourceOrder.total_amount || 0);
      const targetTotal = Number(targetOrder.total || targetOrder.total_amount || 0);
      const newTotal = Number((targetTotal + sourceTotal).toFixed(2));

      const currentUnprinted = targetOrder.unprintedAdditions || [];
      const newUnprinted = [...currentUnprinted, { items: sanitizedSourceItems, timestamp: new Date().toISOString() }];

      const updatePayload = {
        items: newItems,
        total: newTotal,
        total_amount: newTotal,
        unprintedAdditions: newUnprinted,
      };

      await api.updateOrder(targetOrder._id || targetOrder.id, updatePayload);
      await api.deleteOrder(mergeSourceOrder._id || mergeSourceOrder.id);

      api.triggerBroadcast("orders_changed", { action: "upsert", orderId: targetOrder._id || targetOrder.id });

      const sourceName = mergeSourceOrder.customerName || "未知桌号";
      const targetName = targetOrder.customerName || "未知桌号";
      alert(`成功将【${sourceName}】的订单合并并入【${targetName}】！\n合并后订单金额: ¥${newTotal.toFixed(2)}`);

      setMergeSourceOrder(null);
      setMergeTargetOrderId("");
    } catch (e: any) {
      console.error("Merge orders error:", e);
      alert(`合并订单失败: ${e?.message || "请重试"}`);
    } finally {
      setIsMergingOrders(false);
    }
  };

  const handleConfirmAddDishes = async () => {
    if (!addDishTargetOrder) return;
    const selectedEntries = Object.entries(addDishCart).filter(([_, qty]) => Number(qty) > 0);
    if (selectedEntries.length === 0) return;

    try {
      setIsSubmittingAddDish(true);
      const allDishes = categories.flatMap((c) => c.items || []);
      const addedItems = selectedEntries.map(([id, qty]) => {
        const item = allDishes.find((i) => i.id === id);
        const priceString = String(item?.price || "0");
        const priceMatch = priceString.match(/\d+(\.\d+)?/);
        const priceNum = priceMatch ? parseFloat(priceMatch[0]) : 0;
        return {
          id: item?.id || id,
          name: item?.title || item?.name || id,
          enTitle: item?.enTitle || "",
          frTitle: item?.frTitle || "",
          arTitle: item?.arTitle || "",
          maTitle: item?.maTitle || "",
          quantity: Number(qty),
          price: priceNum,
          isAdded: true,
        };
      });

      const existingItems = addDishTargetOrder.items || [];
      const newItems = [...existingItems, ...addedItems];
      const additionTotal = addedItems.reduce((sum: number, i: any) => sum + Number(i.price) * Number(i.quantity), 0);
      const newTotal = Number(((Number(addDishTargetOrder.total) || 0) + additionTotal).toFixed(2));

      const currentUnprinted = addDishTargetOrder.unprintedAdditions || [];
      const newUnprinted = [...currentUnprinted, { items: addedItems, timestamp: new Date().toISOString() }];

      const updatePayload = {
        items: newItems,
        total: newTotal,
        total_amount: newTotal,
        unprintedAdditions: newUnprinted,
      };

      await api.updateOrder(addDishTargetOrder._id || addDishTargetOrder.id, updatePayload);

      let stockUpdated = false;
      const updatedCategories = categories.map((cat: any) => {
        const updatedItems = (cat.items || []).map((item: any) => {
          const added = addedItems.find((ai: any) => ai.id === item.id);
          if (added && item.stock !== undefined && item.stock !== null) {
            const currentStock = Number(item.stock);
            if (!isNaN(currentStock)) {
              const newStock = Math.max(0, currentStock - Number(added.quantity));
              stockUpdated = true;
              return { ...item, stock: newStock, isSoldOut: newStock === 0 ? true : item.isSoldOut };
            }
          }
          return item;
        });
        return { ...cat, items: updatedItems };
      });

      if (stockUpdated) {
        setCategories(updatedCategories);
        if (onSaveToCloud) {
          onSaveToCloud({ categories: updatedCategories, silent: true });
        }
      }

      api.triggerBroadcast('orders_changed', { action: 'upsert', orderId: addDishTargetOrder._id || addDishTargetOrder.id });

      const targetCustomerName = addDishTargetOrder.customerName || "未知桌号";
      const additionQty = addedItems.reduce((s: number, i: any) => s + Number(i.quantity), 0);

      const additionsOrderObj = {
        ...addDishTargetOrder,
        total: additionTotal,
        items: addedItems,
      };

      setAddDishTargetOrder(null);
      setAddDishCart({});

      onConfirmDialog({
        isOpen: true,
        isAlert: false,
        title: "加菜成功！",
        stepBadge: "加菜完成",
        message: `已成功为【${targetCustomerName}】追加 ${additionQty} 件菜品！\n加菜金额: +¥${additionTotal.toFixed(2)}\n更新后订单总计: ¥${newTotal.toFixed(2)}`,
        subDetail: "提示: 点击下方按钮可直接为厨房后厨打印【加菜单】",
        confirmText: "🖨️ 打印加菜单",
        cancelText: "暂不打印",
        confirmBtnClass: "px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-600/30",
        onConfirm: () => {
          import("../../lib/print").then((m) => {
            m.printReceipt(additionsOrderObj, currency, receiptSettings, false, "addition");
          });
          onConfirmDialog(null);
        },
      });
    } catch (e: any) {
      console.error("Add dishes error:", e);
      alert(`加菜失败: ${e?.message || "请重试"}`);
    } finally {
      setIsSubmittingAddDish(false);
    }
  };

  return (
    <>
      {/* 手机端优先 - 订单加菜弹窗 (Add Dish Modal) */}
      {addDishTargetOrder && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative text-left">
            {/* 弹窗头部 */}
            <div className="p-4 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <PlusCircle size={12} />
                    订单加菜模式
                  </div>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  为【{addDishTargetOrder.customerName || "未知桌号"}】加菜
                </h3>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  单号: {addDishTargetOrder.orderNumber || addDishTargetOrder._id} | 当前已点: ¥{(addDishTargetOrder.total || 0).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setAddDishTargetOrder(null)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 并入目标未结账订单选择器 */}
            {(() => {
              const unpaidOrders = orders.filter((o) => o.status !== "completed");
              if (unpaidOrders.length <= 1) return null;
              return (
                <div className="px-3 py-2 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between gap-2 text-xs">
                  <label className="font-bold text-amber-400 whitespace-nowrap flex items-center gap-1 shrink-0">
                    <GitMerge size={14} /> 选择并入订单:
                  </label>
                  <select
                    value={addDishTargetOrder._id || addDishTargetOrder.id}
                    onChange={(e) => {
                      const selected = unpaidOrders.find((o) => (o._id || o.id) === e.target.value);
                      if (selected) setAddDishTargetOrder(selected);
                    }}
                    className="w-full bg-zinc-900 border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold cursor-pointer truncate"
                  >
                    {unpaidOrders.map((o) => {
                      const isSameTable = (o.customerName || "") === (addDishTargetOrder.customerName || "");
                      const oId = o._id || o.id;
                      return (
                        <option key={oId} value={oId}>
                          {isSameTable ? "★ [同桌] " : ""}{o.customerName || "未知桌号"} - 单号: #{o.orderNumber || oId} (¥{(o.total || 0).toFixed(2)})
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })()}

            {/* 搜索与分类导航 */}
            <div className="p-3 bg-zinc-900 border-b border-zinc-800/80 space-y-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="搜索菜品名称或简码..."
                  value={addDishSearch}
                  onChange={(e) => setAddDishSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
                {addDishSearch && (
                  <button
                    onClick={() => setAddDishSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  onClick={() => setAddDishCategory("all")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                    addDishCategory === "all"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                      : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                  }`}
                >
                  全部菜品
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setAddDishCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                      addDishCategory === cat.id
                        ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                        : "bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800"
                    }`}
                  >
                    {cat.title || cat.name} ({cat.items?.length || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* 菜品列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-zinc-950/40">
              {(() => {
                const allDishes = categories.flatMap((c) => {
                  if (addDishCategory !== "all" && c.id !== addDishCategory) return [];
                  return c.items || [];
                });

                const filteredDishes = allDishes.filter((dish) => {
                  if (!addDishSearch) return true;
                  const q = addDishSearch.toLowerCase().trim();
                  const nameMatch = (dish.title || dish.name || "").toLowerCase().includes(q);
                  const enMatch = (dish.enTitle || "").toLowerCase().includes(q);
                  return nameMatch || enMatch;
                });

                if (filteredDishes.length === 0) {
                  return (
                    <div className="text-center py-12 text-zinc-500 text-xs">
                      没有找到匹配的菜品
                    </div>
                  );
                }

                return filteredDishes.map((dish: any) => {
                  const qty = addDishCart[dish.id] || 0;
                  const priceStr = String(dish.price || "0");
                  const priceMatch = priceStr.match(/\d+(\.\d+)?/);
                  const priceNum = priceMatch ? parseFloat(priceMatch[0]) : 0;

                  return (
                    <div
                      key={dish.id}
                      className="p-2.5 bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {dish.image ? (
                          <img
                            src={dish.image}
                            alt={dish.title || dish.name}
                            className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-zinc-800"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 text-amber-500">
                            <Flame size={20} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">
                            {dish.title || dish.name}
                          </h4>
                          {dish.enTitle && (
                            <p className="text-[10px] text-zinc-400 truncate">
                              {dish.enTitle}
                            </p>
                          )}
                          <div className="text-xs font-bold text-amber-400 font-mono mt-0.5">
                            ¥{priceNum.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {dish.isSoldOut ? (
                          <span className="text-[11px] text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-lg">
                            已售罄
                          </span>
                        ) : qty > 0 ? (
                          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => {
                                setAddDishCart((prev) => {
                                  const next = { ...prev };
                                  if ((next[dish.id] ?? 0) > 1) {
                                    next[dish.id]!--;
                                  } else {
                                    delete next[dish.id];
                                  }
                                  return next;
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-amber-400 font-mono">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setAddDishCart((prev) => ({
                                  ...prev,
                                  [dish.id]: (prev[dish.id] || 0) + 1,
                                }));
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAddDishCart((prev) => ({
                                ...prev,
                                [dish.id]: 1,
                              }));
                            }}
                            className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Plus size={14} /> 加菜
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* 底部结算与提交悬浮栏 */}
            {(() => {
              const allDishes = categories.flatMap((c) => c.items || []);
              const selectedEntries = Object.entries(addDishCart).filter(([_, q]) => Number(q) > 0);
              const totalAddCount = selectedEntries.reduce((sum: number, [_, q]) => sum + Number(q), 0);
              const totalAddPrice = selectedEntries.reduce((sum: number, [id, q]) => {
                const d = allDishes.find((i) => i.id === id);
                const priceStr = String(d?.price || "0");
                const priceMatch = priceStr.match(/\d+(\.\d+)?/);
                const priceNum = priceMatch ? parseFloat(priceMatch[0]) : 0;
                return sum + priceNum * Number(q);
              }, 0);
              const projectedTotal = (Number(addDishTargetOrder.total) || 0) + totalAddPrice;

              return (
                <div className="p-3.5 bg-zinc-950 border-t border-zinc-800/80 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="text-zinc-400">
                      已选 <span className="text-amber-400 font-bold font-mono">{totalAddCount}</span> 项加菜
                      {totalAddCount > 0 && (
                        <button
                          onClick={() => setAddDishCart({})}
                          className="ml-2 text-zinc-500 hover:text-red-400 underline"
                        >
                          清空
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-zinc-400">加菜小计: </span>
                      <span className="text-amber-400 font-bold font-mono text-sm sm:text-base">
                        +¥{totalAddPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        (合并后订单总计 ¥{projectedTotal.toFixed(2)})
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddDishTargetOrder(null)}
                      className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={totalAddCount === 0 || isSubmittingAddDish}
                      onClick={handleConfirmAddDishes}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white transition-all shadow-lg flex items-center justify-center gap-1.5 ${
                        totalAddCount === 0 || isSubmittingAddDish
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                          : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 active:scale-98"
                      }`}
                    >
                      {isSubmittingAddDish ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          正在提交加菜...
                        </>
                      ) : (
                        <>
                          <PlusCircle size={16} />
                          确认加菜并合并入订单 (+¥{totalAddPrice.toFixed(2)})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 手机端优先 - 订单合并/并入弹窗 (Merge Orders Modal) */}
      {mergeSourceOrder && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-3 animate-in fade-in duration-200"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                  <GitMerge size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">合并并入订单</h3>
                  <p className="text-xs text-zinc-400">将已有未结账订单合并入目标订单</p>
                </div>
              </div>
              <button
                onClick={() => setMergeSourceOrder(null)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-1">
              <div className="text-zinc-400 font-medium">当前被并入的源订单 (Source Order):</div>
              <div className="text-white font-bold text-sm">
                {mergeSourceOrder.customerName || "未知桌号"} (单号: #{mergeSourceOrder.orderNumber || mergeSourceOrder._id})
              </div>
              <div className="text-amber-400 font-mono font-bold">
                包含 {mergeSourceOrder.items?.length || 0} 项菜品 | 总计: ¥{(mergeSourceOrder.total || 0).toFixed(2)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-purple-400 mb-2">
                请选择要合并到的目标未结账订单 (Select Target Order):
              </label>
              {(() => {
                const candidates = orders.filter(
                  (o) => (o._id || o.id) !== (mergeSourceOrder._id || mergeSourceOrder.id) && o.status !== "completed"
                );

                if (candidates.length === 0) {
                  return (
                    <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-xl text-center text-xs text-zinc-500">
                      暂无其他未结账的订单可供合并。
                    </div>
                  );
                }

                return (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {candidates.map((cand) => {
                      const isSelected = mergeTargetOrderId === (cand._id || cand.id);
                      const isSameTable = (cand.customerName || "") === (mergeSourceOrder.customerName || "");
                      return (
                        <div
                          key={cand._id || cand.id}
                          onClick={() => setMergeTargetOrderId(cand._id || cand.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? "bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-600/20"
                              : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-sm">
                              <span>{cand.customerName || "未知桌号"}</span>
                              {isSameTable && (
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-normal">
                                  同桌号
                                </span>
                              )}
                            </div>
                            <div className="text-zinc-400 text-[11px] font-mono mt-0.5">
                              单号: #{cand.orderNumber || cand._id} | {cand.items?.length || 0} 项菜品
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-purple-400 font-bold font-mono text-sm">
                              ¥{(cand.total || 0).toFixed(2)}
                            </div>
                            {isSelected && (
                              <div className="text-[10px] text-purple-300 font-bold mt-0.5">
                                ✓ 已选为主订单
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setMergeSourceOrder(null)}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={!mergeTargetOrderId || isMergingOrders}
                onClick={handleExecuteMergeOrders}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-lg flex items-center justify-center gap-1.5 ${
                  !mergeTargetOrderId || isMergingOrders
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                    : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30 active:scale-98 cursor-pointer"
                }`}
              >
                {isMergingOrders ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    正在合并订单...
                  </>
                ) : (
                  <>确认合并</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
