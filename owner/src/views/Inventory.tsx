import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Wallet,
  Layers,
  Pencil,
  Save,
  PackageX,
  ClipboardList,
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, SkeletonRows } from "../components/ui";
import { Sheet, SheetField } from "../components/Sheet";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import {
  adjustStock,
  deleteInventoryItem,
  fetchInventory,
  fetchTransactions,
  inventoryValue,
  lowStockItems,
  num,
  recordWaste,
  saveInventoryItem,
  type InventoryItem,
} from "../lib/inventory";
import { REASONS, todayWasteAmount, type Reason } from "../lib/waste";
import {
  buildStocktake,
  pendingAdjustments,
  STOCKTAKE_REASON,
} from "../lib/stocktake";

const EMPTY: Partial<InventoryItem> = {
  name: "",
  category: "食材",
  stock: 0,
  unit: "kg",
  safety_stock: 0,
  price: 0,
};

export default function Inventory({ version = 0 }: { version?: number }) {
  const [list, setList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<InventoryItem> | null>(null);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [delta, setDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [wasting, setWasting] = useState<InventoryItem | null>(null);
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState<Reason>("过期");
  const [wasteNote, setWasteNote] = useState("");
  const [todayWaste, setTodayWaste] = useState(0);
  const [q, setQ] = useState("");
  const [stocktaking, setStocktaking] = useState(false);
  const [taking, setTaking] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [items, txns] = await Promise.all([
      fetchInventory(),
      fetchTransactions(500, "waste", start.toISOString()),
    ]);
    setList(items);
    setTodayWaste(todayWasteAmount(txns));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  const low = useMemo(() => lowStockItems(list), [list]);
  const categories = useMemo(
    () => Array.from(new Set(list.map((i) => i.category))).length,
    [list],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(needle) ||
        (i.category || "").toLowerCase().includes(needle),
    );
  }, [list, q]);

  const take = useMemo(() => buildStocktake(list, counts), [list, counts]);

  const submitEdit = async () => {
    if (!editing?.name?.trim()) return toast.error("名称不能为空");
    const ok = await saveInventoryItem(editing as InventoryItem);
    if (!ok) return toast.error("保存失败（检查库存表权限）");
    toast.success("已保存");
    setEditing(null);
    load();
  };

  const submitAdjust = async () => {
    if (!adjusting) return;
    const d = num(delta);
    if (!d) return toast.error("请输入调整数量（正数入库 / 负数出库）");
    const ok = await adjustStock(
      adjusting,
      d,
      "adjustment",
      adjustNote || "手工调整",
    );
    if (!ok) return toast.error("调整失败");
    toast.success("库存已调整");
    setAdjusting(null);
    setDelta("");
    setAdjustNote("");
    load();
  };

  const submitWaste = async () => {
    if (!wasting) return;
    const qty = Math.abs(num(wasteQty));
    if (!qty) return toast.error("请输入报损数量");
    if (qty > num(wasting.stock))
      return toast.error(
        `报损数量不能超过现存 ${num(wasting.stock)} ${wasting.unit}`,
      );
    const ok = await recordWaste(wasting, qty, wasteReason, wasteNote);
    if (!ok) return toast.error("报损失败（检查库存表权限）");
    toast.success(
      `已报损 ${qty}${wasting.unit} · ${fmtMoney(qty * num(wasting.price))}`,
    );
    setWasting(null);
    setWasteQty("");
    setWasteNote("");
    setWasteReason("过期");
    load();
  };

  /** 盘点：按实盘与账面差异一次性调整，写流水（reason=盘点差异） */
  const submitTake = async () => {
    const adj = pendingAdjustments(take);
    if (!adj.length) {
      toast.success(
        take.summary.counted ? "实盘与账面一致，无需调整" : "请先填写实盘数量",
      );
      if (take.summary.counted) {
        setStocktaking(false);
        setCounts({});
      }
      return;
    }
    if (
      !confirm(
        `将按实盘调整 ${adj.length} 项库存（流水原因：${STOCKTAKE_REASON}），\n净差异 ${fmtMoney(take.summary.diffValue)}（盘亏 ${fmtMoney(take.summary.lossValue)} / 盘盈 ${fmtMoney(take.summary.gainValue)}）。确定继续？`,
      )
    )
      return;
    setTaking(true);
    let ok = 0;
    for (const r of adj) {
      const item = list.find((i) => i.id === r.id);
      if (!item || r.diff === null) continue;
      const done = await adjustStock(
        item,
        r.diff,
        "adjustment",
        `盘点 ${r.book}${r.unit} → ${r.actual}${r.unit}`,
        STOCKTAKE_REASON,
      );
      if (done) ok += 1;
    }
    setTaking(false);
    if (ok === adj.length) toast.success(`已按实盘调整 ${ok} 项库存`);
    else if (ok > 0)
      toast.error(`部分失败：${ok}/${adj.length} 已调整，请复核`);
    else toast.error("盘点调整失败（检查库存表权限）");
    setStocktaking(false);
    setCounts({});
    load();
  };

  const remove = async (i: InventoryItem) => {
    if (
      !confirm(
        `删除原料「${i.name}」？若已被菜品配方引用，将一并移除相关配方项。`,
      )
    )
      return;
    const r = await deleteInventoryItem(i.id);
    if (!r.ok) {
      if (r.referencedBoms)
        return toast.error(
          `删除失败：该原料被 ${r.referencedBoms} 条配方引用，请先到「配方 BOM」解除引用`,
        );
      return toast.error(`删除失败：${r.error || "未知错误"}`);
    }
    toast.success(
      r.referencedBoms
        ? `已删除，并移除 ${r.referencedBoms} 条相关配方`
        : "已删除",
    );
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          label="库存总值"
          value={fmtMoney(inventoryValue(list))}
          valueNum={inventoryValue(list)}
          format={fmtMoney}
        />
        <KpiCard
          icon={Layers}
          label="原料品类"
          value={String(categories)}
          valueNum={categories}
          sub={`共 ${list.length} 种`}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={AlertTriangle}
          label="低库存预警"
          value={String(low.length)}
          valueNum={low.length}
          accent={low.length ? "text-red-400" : "text-green-400"}
          bg={low.length ? "bg-red-500/10" : "bg-green-500/10"}
        />
        <KpiCard
          icon={PackageX}
          label="今日损耗"
          value={fmtMoney(todayWaste)}
          valueNum={todayWaste}
          format={fmtMoney}
          accent={todayWaste > 0 ? "text-amber-400" : "text-teal-400"}
          bg={todayWaste > 0 ? "bg-amber-500/10" : "bg-teal-500/10"}
        />
      </div>

      {low.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>
            需补货：
            {low.map((i) => `${i.name}(${i.stock}${i.unit})`).join("、")}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white btn-brand rounded-xl"
        >
          <Plus size={16} /> 新增原料
        </button>
        <button
          onClick={() => {
            setCounts({});
            setStocktaking(true);
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <ClipboardList size={16} /> 盘点
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称 / 分类"
          className="flex-1 min-w-[160px] bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <ChartCard
        title="库存列表"
        subtitle="采购与结账会自动更新现存量"
        action={<Boxes size={18} className="text-orange-500" />}
      >
        {loading ? (
          <SkeletonRows rows={4} />
        ) : shown.length === 0 ? (
          <EmptyState text="暂无原料，点「新增原料」" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-white/5">
                  <th className="px-3 py-2 font-medium">名称</th>
                  <th className="px-3 py-2 font-medium">分类</th>
                  <th className="px-3 py-2 font-medium text-right">现存</th>
                  <th className="px-3 py-2 font-medium text-right">安全库存</th>
                  <th className="px-3 py-2 font-medium text-right">单价</th>
                  <th className="px-3 py-2 font-medium text-right">金额</th>
                  <th className="px-3 py-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const isLow =
                    num(i.safety_stock) > 0 &&
                    num(i.stock) <= num(i.safety_stock);
                  return (
                    <tr
                      key={i.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="px-3 py-2.5 text-white font-medium">
                        {i.name}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400">
                        {i.category}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold ${isLow ? "text-red-400" : "text-zinc-200"}`}
                      >
                        {num(i.stock)} {i.unit}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-500">
                        {num(i.safety_stock) || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">
                        {fmtMoney(i.price)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300">
                        {fmtMoney(num(i.stock) * num(i.price))}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setWasteReason("过期");
                            setWasteQty("");
                            setWasteNote("");
                            setWasting(i);
                          }}
                          disabled={num(i.stock) <= 0}
                          className="text-zinc-400 hover:text-amber-400 disabled:opacity-30 mr-2"
                          title="报损登记"
                        >
                          报损
                        </button>
                        <button
                          onClick={() => setAdjusting(i)}
                          className="text-zinc-400 hover:text-orange-400 mr-2"
                          title="盘点/调整"
                        >
                          调整
                        </button>
                        <button
                          onClick={() => setEditing(i)}
                          className="text-zinc-400 hover:text-white mr-2"
                          title="编辑"
                        >
                          <Pencil size={14} className="inline" />
                        </button>
                        <button
                          onClick={() => remove(i)}
                          className="text-zinc-400 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 size={14} className="inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {/* 编辑原料 */}
      <Sheet
        open={!!editing}
        title={editing?.id ? "编辑原料" : "新增原料"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SheetField
                label="名称"
                value={editing.name || ""}
                onChange={(v) => setEditing({ ...editing, name: v })}
                className="col-span-2"
              />
              <SheetField
                label="分类"
                value={editing.category || ""}
                onChange={(v) => setEditing({ ...editing, category: v })}
              />
              <SheetField
                label="单位"
                value={editing.unit || ""}
                onChange={(v) => setEditing({ ...editing, unit: v })}
              />
              <SheetField
                label="现存量"
                type="number"
                value={editing.stock}
                onChange={(v) => setEditing({ ...editing, stock: num(v) })}
              />
              <SheetField
                label="安全库存"
                type="number"
                value={editing.safety_stock}
                onChange={(v) =>
                  setEditing({ ...editing, safety_stock: num(v) })
                }
              />
              <SheetField
                label="单价(成本)"
                type="number"
                value={editing.price}
                onChange={(v) => setEditing({ ...editing, price: num(v) })}
                className="col-span-2"
              />
            </div>
            <button
              onClick={submitEdit}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold active:scale-[0.98] transition-transform"
            >
              <Save size={16} /> 保存
            </button>
          </>
        )}
      </Sheet>

      {/* 调整库存 */}
      <Sheet
        open={!!adjusting}
        title={`调整库存 · ${adjusting?.name ?? ""}`}
        subtitle={
          adjusting
            ? `当前 ${num(adjusting.stock)} ${adjusting.unit} · 正数入库、负数出库`
            : ""
        }
        onClose={() => setAdjusting(null)}
      >
        {adjusting && (
          <>
            <SheetField
              label="调整数量"
              type="number"
              value={delta}
              onChange={setDelta}
            />
            <div className="h-3" />
            <SheetField
              label="备注"
              value={adjustNote}
              onChange={setAdjustNote}
            />
            <button
              onClick={submitAdjust}
              className="mt-4 w-full py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold active:scale-[0.98] transition-transform"
            >
              确认调整
            </button>
          </>
        )}
      </Sheet>

      {/* 报损登记 */}
      <Sheet
        open={!!wasting}
        title={`报损登记 · ${wasting?.name ?? ""}`}
        subtitle={
          wasting
            ? `现存 ${num(wasting.stock)} ${wasting.unit} · 按现价 ${fmtMoney(wasting.price)}/${wasting.unit} 计入损耗`
            : ""
        }
        onClose={() => setWasting(null)}
      >
        {wasting && (
          <>
            <SheetField
              label="报损数量"
              type="number"
              value={wasteQty}
              onChange={setWasteQty}
            />
            <div className="h-3" />
            <div className="text-xs text-zinc-500 mb-1.5">报损原因</div>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setWasteReason(r)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    wasteReason === r
                      ? "bg-amber-500/15 border-amber-500/60 text-amber-400 font-semibold"
                      : "bg-zinc-950 border-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="h-3" />
            <SheetField
              label="备注（选填）"
              value={wasteNote}
              onChange={setWasteNote}
            />
            <div className="mt-3 text-right text-sm text-zinc-400">
              本次损耗{" "}
              <span className="text-amber-400 font-bold">
                {fmtMoney(Math.abs(num(wasteQty)) * num(wasting.price))}
              </span>
            </div>
            <button
              onClick={submitWaste}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold active:scale-[0.98] transition-transform"
            >
              <PackageX size={16} /> 确认报损（扣减库存）
            </button>
          </>
        )}
      </Sheet>

      {/* 库存盘点 */}
      <Sheet
        open={stocktaking}
        title="库存盘点"
        subtitle={`实盘与账面逐项比对；只调整有差异的项，流水原因记为「${STOCKTAKE_REASON}」`}
        onClose={() => setStocktaking(false)}
        maxW="max-w-lg"
      >
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs bg-zinc-950 rounded-xl px-3 py-2.5 mb-2">
          <span className="text-zinc-400">
            已盘{" "}
            <b className="text-white">
              {take.summary.counted}/{take.summary.total}
            </b>
          </span>
          <span className="text-zinc-400">
            差异{" "}
            <b
              className={
                take.summary.diffCount ? "text-amber-400" : "text-emerald-400"
              }
            >
              {take.summary.diffCount}
            </b>{" "}
            项
          </span>
          <span className="text-zinc-400">
            盘亏{" "}
            <b className="text-red-400">{fmtMoney(take.summary.lossValue)}</b>
          </span>
          <span className="text-zinc-400">
            盘盈{" "}
            <b className="text-emerald-400">
              {fmtMoney(take.summary.gainValue)}
            </b>
          </span>
        </div>

        <div className="grid grid-cols-[1fr_88px_64px] gap-3 px-1 pb-1 text-[10px] text-zinc-600">
          <span>原料 / 账面</span>
          <span className="text-right">实盘</span>
          <span className="text-right">差异</span>
        </div>
        <div className="max-h-[46vh] overflow-y-auto pr-1">
          {take.rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_88px_64px] items-center gap-3 py-2 border-b border-white/5 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm text-zinc-200 truncate">{r.name}</div>
                <div className="text-[11px] text-zinc-500">
                  账面 {num(r.book)}
                  {r.unit} · {fmtMoney(r.price)}/{r.unit}
                </div>
              </div>
              <input
                inputMode="decimal"
                value={counts[r.id] ?? ""}
                placeholder={String(r.book)}
                onChange={(e) =>
                  setCounts((c) => ({ ...c, [r.id]: e.target.value }))
                }
                className="w-full bg-zinc-950 border border-white/5 rounded-lg px-2.5 py-2 text-sm text-white text-right focus:outline-none focus:border-orange-500"
              />
              <div
                className={`text-right text-sm font-semibold ${
                  r.diff === null
                    ? "text-zinc-700"
                    : r.diff === 0
                      ? "text-zinc-600"
                      : r.diff > 0
                        ? "text-emerald-400"
                        : "text-red-400"
                }`}
              >
                {r.diff === null
                  ? "—"
                  : `${r.diff > 0 ? "+" : ""}${num(r.diff)}`}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={submitTake}
          disabled={taking}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          <Save size={16} />
          {taking
            ? "调整中…"
            : `按实盘调整（${pendingAdjustments(take).length} 项）`}
        </button>
      </Sheet>
    </div>
  );
}
