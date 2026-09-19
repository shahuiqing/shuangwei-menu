import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Plus,
  Trash2,
  RefreshCw,
  Calendar,
  Wallet,
  Percent,
  Receipt,
  AlertTriangle,
  X,
} from "lucide-react";
import { api } from "../../api";
import { isSupabaseConfigured, isSupabaseHealthy } from "../../supabase";
import {
  getPurchaseOrders,
  savePurchaseOrder,
  deletePurchaseOrder,
  addInventoryTransaction,
  getDailySummaries,
  getWasteAnalysis,
  getPeriodTotals,
} from "../../api_modules/finance";
import type { InventoryItem } from "../../types/inventory";
import { toast } from "../../utils/toast";

type TabKey = "pnl" | "purchase" | "cost" | "waste";

// 日期工具
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const fmtMoney = (v: number) =>
  "MAD " +
  Number(v || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtNum = (v: number) =>
  Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function FinanceReports() {
  const [activeTab, setActiveTab] = useState<TabKey>("pnl");
  const [loading, setLoading] = useState(true);

  // 采购
  const [purchases, setPurchases] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    id: "",
    supplier: "",
    item_id: "",
    quantity: "1",
    unit_price: "0",
    purchased_at: todayStr(),
    notes: "",
  });

  // 报表周期
  const [rangeStart, setRangeStart] = useState(daysAgo(6));
  const [rangeEnd, setRangeEnd] = useState(todayStr());
  const [summaries, setSummaries] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [waste, setWaste] = useState<any[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [inv, pos, summariesData, wasteData, totalsData] =
        await Promise.all([
          api.getInventoryItems(),
          getPurchaseOrders(),
          getDailySummaries(rangeStart, rangeEnd),
          getWasteAnalysis(rangeStart, rangeEnd),
          getPeriodTotals(rangeStart, rangeEnd),
        ]);
      setInventory(inv || []);
      setPurchases(pos || []);
      setSummaries(summariesData || []);
      setWaste(wasteData || []);
      setTotals(totalsData);
    } catch (e) {
      console.error("FinanceReports load failed:", e);
      toast("加载报表数据失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const unsub = api.subscribeToInventory(() => loadAll());
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  // 采购表单
  const selectedInvItem = inventory.find((i) => i.id === purchaseForm.item_id);
  const computedTotal =
    (parseFloat(purchaseForm.quantity) || 0) *
    (parseFloat(purchaseForm.unit_price) || 0);

  const openPurchaseModal = () => {
    setPurchaseForm({
      id: "",
      supplier: "",
      item_id: inventory[0]?.id || "",
      quantity: "1",
      unit_price: String(inventory[0]?.price || "0"),
      purchased_at: todayStr(),
      notes: "",
    });
    setPurchaseModalOpen(true);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.item_id) {
      toast("请选择采购物料", "warn");
      return;
    }
    const item = inventory.find((i) => i.id === purchaseForm.item_id);
    const po = {
      id: purchaseForm.id || undefined,
      supplier: purchaseForm.supplier.trim(),
      item_id: purchaseForm.item_id,
      item_name: item?.name || purchaseForm.item_id,
      quantity: parseFloat(purchaseForm.quantity) || 0,
      unit: item?.unit || "kg",
      unit_price: parseFloat(purchaseForm.unit_price) || 0,
      total_cost: computedTotal,
      purchased_at: purchaseForm.purchased_at || todayStr(),
      notes: purchaseForm.notes.trim(),
    };
    if (po.quantity <= 0) {
      toast("采购数量必须大于 0", "warn");
      return;
    }
    const saved = await savePurchaseOrder(po as any);
    // 同步增加库存并记录流水
    if (item) {
      await api.saveInventoryItem({
        ...item,
        stock: Number((Number(item.stock) + po.quantity).toFixed(2)),
        updated_at: new Date().toISOString(),
      });
    }
    await addInventoryTransaction({
      id: "",
      item_id: po.item_id,
      item_name: po.item_name,
      type: "purchase_in",
      quantity: po.quantity,
      unit: po.unit,
      unit_cost: po.unit_price,
      reference: saved.id,
      notes: "采购入库: " + (po.supplier || "供应商"),
      created_at: new Date().toISOString(),
    });
    setPurchaseModalOpen(false);
    toast(`采购成功，库存已增加 ${po.quantity} ${po.unit}`, "success");
    await loadAll();
  };

  const handleDeletePurchase = async (id: string) => {
    if (!window.confirm("确定删除该采购记录吗？(不会回滚库存)")) return;
    await deletePurchaseOrder(id);
    toast("采购记录已删除", "info");
    await loadAll();
  };

  // 成本分析：按物料分类汇总理论成本
  const costByCategory = useMemo(() => {
    const map = new Map<string, number>();
    waste.forEach((w) => {
      const item = inventory.find((i) => i.id === w.item_id);
      const cat = item?.category || "其他";
      const cost = Number(w.actual_consumption) * Number(item?.price || 0);
      map.set(cat, (map.get(cat) || 0) + cost);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [waste, inventory]);

  const wasteTotal = useMemo(
    () => waste.reduce((s, w) => s + Number(w.waste_cost || 0), 0),
    [waste],
  );

  const dbConnected = isSupabaseConfigured && isSupabaseHealthy;

  return (
    <div className="space-y-6 text-zinc-100">
      {/* 顶部横幅 */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-emerald-950/30 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                经营财务与库存盈亏分析
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                每日盈亏、采购、成本与周期性损耗测算（基于订单与 BOM
                配方自动核算）
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${dbConnected ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${dbConnected ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}
              />
              {dbConnected ? "Supabase 云端已连接" : "本地离线模式"}
            </span>
            <button
              onClick={loadAll}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors"
              title="刷新数据"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 周期选择 */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-6 relative z-10">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar size={14} className="text-emerald-500" />
            报表周期
          </div>
          <input
            type="date"
            value={rangeStart}
            max={rangeEnd}
            onChange={(e) => setRangeStart(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="text-zinc-500 text-sm">至</span>
          <input
            type="date"
            value={rangeEnd}
            min={rangeStart}
            max={todayStr()}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setRangeStart(daysAgo(d - 1));
                  setRangeEnd(todayStr());
                }}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                近{d}天
              </button>
            ))}
          </div>
        </div>

        {/* 指标卡 */}
        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
              <span className="text-xs text-zinc-400 block mb-1">营业收入</span>
              <div className="text-lg sm:text-xl font-bold text-white flex items-center justify-between gap-2">
                <span>{fmtMoney(totals.revenue)}</span>
                <TrendingUp size={16} className="text-emerald-500 shrink-0" />
              </div>
              <span className="text-[10px] text-zinc-500">
                {totals.order_count} 单
              </span>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
              <span className="text-xs text-zinc-400 block mb-1">食材成本</span>
              <div className="text-lg sm:text-xl font-bold text-amber-400 flex items-center justify-between gap-2">
                <span>{fmtMoney(totals.food_cost)}</span>
                <Receipt size={16} className="text-amber-500 shrink-0" />
              </div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
              <span className="text-xs text-zinc-400 block mb-1">采购总额</span>
              <div className="text-lg sm:text-xl font-bold text-sky-400 flex items-center justify-between gap-2">
                <span>{fmtMoney(totals.purchases)}</span>
                <ShoppingCart size={16} className="text-sky-500 shrink-0" />
              </div>
            </div>
            <div
              className={`bg-zinc-950/60 border rounded-xl p-3.5 ${totals.gross_profit >= 0 ? "border-emerald-500/30" : "border-red-500/30"}`}
            >
              <span className="text-xs text-zinc-400 block mb-1">
                毛利（利润）
              </span>
              <div
                className={`text-lg sm:text-xl font-bold flex items-center justify-between gap-2 ${totals.gross_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                <span>{fmtMoney(totals.gross_profit)}</span>
                {totals.gross_profit >= 0 ? (
                  <TrendingUp size={16} className="shrink-0" />
                ) : (
                  <TrendingDown size={16} className="shrink-0" />
                )}
              </div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
              <span className="text-xs text-zinc-400 block mb-1">毛利率</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-400 flex items-center justify-between gap-2">
                <span>{totals.gross_margin}%</span>
                <Percent size={16} className="text-emerald-500 shrink-0" />
              </div>
            </div>
            <div className="bg-zinc-950/60 border border-red-500/30 rounded-xl p-3.5">
              <span className="text-xs text-red-400 block mb-1">
                测算损耗金额
              </span>
              <div className="text-lg sm:text-xl font-bold text-red-400 flex items-center justify-between gap-2">
                <span>{fmtMoney(totals.waste_cost)}</span>
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
              </div>
              <span className="text-[10px] text-zinc-500">
                占成本 {totals.waste_rate}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 子标签导航 */}
      <div className="flex flex-wrap border-b border-zinc-800 gap-2 pb-2">
        <button
          onClick={() => setActiveTab("pnl")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === "pnl" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
        >
          <TrendingUp size={16} /> 每日盈亏 (P&L)
        </button>
        <button
          onClick={() => setActiveTab("purchase")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === "purchase" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
        >
          <ShoppingCart size={16} /> 采购管理 ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab("cost")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === "cost" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
        >
          <Package size={16} /> 成本分析
        </button>
        <button
          onClick={() => setActiveTab("waste")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === "waste" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
        >
          <AlertTriangle size={16} /> 周期损耗测算
        </button>
      </div>

      {/* ======== 每日盈亏 ======== */}
      {activeTab === "pnl" && (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden custom-scrollbar">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">日期</th>
                    <th className="py-3.5 px-4 text-right">订单数</th>
                    <th className="py-3.5 px-4 text-right">营业收入</th>
                    <th className="py-3.5 px-4 text-right">食材成本</th>
                    <th className="py-3.5 px-4 text-right">采购支出</th>
                    <th className="py-3.5 px-4 text-right">当日毛利</th>
                    <th className="py-3.5 px-4 text-right">毛利率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {summaries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-zinc-500"
                      >
                        该周期内暂无订单数据
                      </td>
                    </tr>
                  ) : (
                    [...summaries].reverse().map((d: any) => (
                      <tr
                        key={d.date}
                        className="hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-zinc-200">
                          {d.date}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {d.order_count}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {fmtMoney(d.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400">
                          {fmtMoney(d.food_cost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-sky-400">
                          {fmtMoney(d.purchases_total)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${d.gross_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {fmtMoney(d.gross_profit)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300">
                          {d.gross_margin}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            说明：营业收入 = 已完成/进行中订单金额合计；食材成本 = 按订单菜品与
            BOM 配方自动折算的理论食材成本（Σ 剂量×数量×单价）；毛利 = 收入 -
            成本。
          </p>
        </div>
      )}

      {/* ======== 采购管理 ======== */}
      {activeTab === "purchase" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-xs text-zinc-400">
              采购入库会自动增加对应物料库存，并记录到库存流水用于损耗测算。
            </div>
            <button
              onClick={openPurchaseModal}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
            >
              <Plus size={16} /> 新增采购记录
            </button>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden custom-scrollbar">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">采购日期</th>
                    <th className="py-3.5 px-4">物料</th>
                    <th className="py-3.5 px-4">供应商</th>
                    <th className="py-3.5 px-4 text-right">数量</th>
                    <th className="py-3.5 px-4 text-right">单价</th>
                    <th className="py-3.5 px-4 text-right">总金额</th>
                    <th className="py-3.5 px-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {purchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-8 text-center text-zinc-500"
                      >
                        暂无采购记录，点击【新增采购记录】开始录入
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-zinc-300">
                          {String(p.purchased_at || "").slice(0, 10)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {p.item_name}
                          </div>
                          <div className="text-xs font-mono text-zinc-500">
                            {p.item_id}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-400">
                          {p.supplier || "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {fmtNum(p.quantity)} {p.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {fmtMoney(p.unit_price)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {fmtMoney(p.total_cost)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeletePurchase(p.id)}
                            className="p-1.5 bg-zinc-800 hover:bg-red-900/40 text-red-400 rounded-lg transition-colors"
                            title="删除采购记录"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======== 成本分析 ======== */}
      {activeTab === "cost" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Package size={18} className="text-emerald-500" />
                分类成本占比
              </h3>
              {costByCategory.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-sm">
                  该周期暂无成本数据
                </div>
              ) : (
                <div className="space-y-3">
                  {costByCategory.map(([cat, cost], idx) => {
                    const max =
                      costByCategory.reduce((m, c) => Math.max(m, c[1]), 0) ||
                      1;
                    const pct = max > 0 ? (cost / max) * 100 : 0;
                    const share =
                      (totals?.food_cost || 1) > 0
                        ? ((cost / (totals?.food_cost || 1)) * 100).toFixed(1)
                        : "0";
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-300 font-medium">
                            {cat}
                          </span>
                          <span className="font-mono text-zinc-400">
                            {fmtMoney(cost)}{" "}
                            <span className="text-zinc-600">({share}%)</span>
                          </span>
                        </div>
                        <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${idx === 0 ? "bg-emerald-500" : idx === 1 ? "bg-sky-500" : idx === 2 ? "bg-amber-500" : "bg-zinc-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Receipt size={18} className="text-emerald-500" />
                成本构成概览
              </h3>
              {totals && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">营业收入</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {fmtMoney(totals.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">理论食材成本</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {fmtMoney(totals.food_cost)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">成本率</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      {totals.revenue > 0
                        ? ((totals.food_cost / totals.revenue) * 100).toFixed(1)
                        : "0"}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">采购支出</span>
                    <span className="font-mono text-sky-400 font-semibold">
                      {fmtMoney(totals.purchases)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">测算损耗金额</span>
                    <span className="font-mono text-red-400 font-semibold">
                      {fmtMoney(wasteTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-zinc-300 font-semibold">
                      预估净利润
                    </span>
                    <span
                      className={`font-mono font-bold ${totals.gross_profit - wasteTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {fmtMoney(totals.gross_profit - wasteTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======== 周期损耗测算 ======== */}
      {activeTab === "waste" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-red-950/20 via-zinc-900 to-zinc-900 border border-red-500/30 rounded-2xl p-5">
            <h4 className="font-bold text-white text-sm flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-red-400" />
              损耗测算逻辑
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              理论消耗 = Σ(BOM 配方剂量 × 订单售出数量)；实际消耗 = 期初库存 +
              采购入库 − 期末库存；损耗量 = 实际消耗 − 理论消耗，损耗率 = 损耗量
              ÷ 实际消耗。
              负数表示盘点富余（可能盘点误差或配方偏保守），正数表示异常损耗（需排查浪费、过期、偷漏）。
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden custom-scrollbar">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950 text-xs uppercase text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4">物料</th>
                    <th className="py-3.5 px-4 text-right">期初</th>
                    <th className="py-3.5 px-4 text-right">采购入库</th>
                    <th className="py-3.5 px-4 text-right">理论消耗</th>
                    <th className="py-3.5 px-4 text-right">实际消耗</th>
                    <th className="py-3.5 px-4 text-right">损耗量</th>
                    <th className="py-3.5 px-4 text-right">损耗率</th>
                    <th className="py-3.5 px-4 text-right">损耗金额</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {waste.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-zinc-500"
                      >
                        该周期内无库存损耗数据
                      </td>
                    </tr>
                  ) : (
                    waste
                      .filter((w) => Number(w.waste_quantity) !== 0)
                      .map((w) => {
                        const isWaste = Number(w.waste_quantity) > 0;
                        return (
                          <tr
                            key={w.item_id}
                            className="hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">
                                {w.item_name}
                              </div>
                              <div className="text-xs font-mono text-zinc-500">
                                {w.item_id}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-400">
                              {fmtNum(w.opening_stock)} {w.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-sky-400">
                              {fmtNum(w.purchases)} {w.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-200">
                              {fmtNum(w.theoretical_consumption)} {w.unit}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-300">
                              {fmtNum(w.actual_consumption)} {w.unit}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold ${isWaste ? "text-red-400" : "text-emerald-400"}`}
                            >
                              {isWaste ? "+" : ""}
                              {fmtNum(w.waste_quantity)} {w.unit}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono ${isWaste ? "text-red-400" : "text-emerald-400"}`}
                            >
                              {isWaste ? "+" : ""}
                              {w.waste_rate}%
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold ${isWaste ? "text-red-400" : "text-emerald-400"}`}
                            >
                              {fmtMoney(w.waste_cost)}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500">
            提示：为确保测算准确，建议在周期开始与结束时各做一次库存盘点，并通过【库存与BOM联控】的“调库存”功能校正期末库存。
          </p>
        </div>
      )}

      {/* 采购弹窗 */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart size={18} className="text-emerald-500" />
                新增采购入库
              </h3>
              <button
                onClick={() => setPurchaseModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  采购物料
                </label>
                <select
                  value={purchaseForm.item_id}
                  onChange={(e) => {
                    const item = inventory.find((i) => i.id === e.target.value);
                    setPurchaseForm({
                      ...purchaseForm,
                      item_id: e.target.value,
                      unit_price: String(item?.price || "0"),
                    });
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.id}) - 余 {i.stock} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    数量
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchaseForm.quantity}
                    onChange={(e) =>
                      setPurchaseForm({
                        ...purchaseForm,
                        quantity: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    单价 ({selectedInvItem?.unit || "kg"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchaseForm.unit_price}
                    onChange={(e) =>
                      setPurchaseForm({
                        ...purchaseForm,
                        unit_price: e.target.value,
                      })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  供应商
                </label>
                <input
                  type="text"
                  value={purchaseForm.supplier}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      supplier: e.target.value,
                    })
                  }
                  placeholder="如：本地肉类批发商"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  采购日期
                </label>
                <input
                  type="date"
                  required
                  value={purchaseForm.purchased_at}
                  max={todayStr()}
                  onChange={(e) =>
                    setPurchaseForm({
                      ...purchaseForm,
                      purchased_at: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">备注</label>
                <input
                  type="text"
                  value={purchaseForm.notes}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, notes: e.target.value })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-zinc-950 border border-emerald-500/30 rounded-xl p-3 flex justify-between items-center">
                <span className="text-xs text-zinc-400">预计入库后库存:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {selectedInvItem
                    ? fmtNum(
                        Number(selectedInvItem.stock) +
                          (parseFloat(purchaseForm.quantity) || 0),
                      )
                    : "0"}{" "}
                  {selectedInvItem?.unit || ""}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPurchaseModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm"
                >
                  确认入库 (¥{computedTotal.toFixed(2)})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
