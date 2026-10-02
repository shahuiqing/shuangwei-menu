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
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, SkeletonRows } from "../components/ui";
import { Sheet, SheetField } from "../components/Sheet";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import {
  adjustStock,
  deleteInventoryItem,
  fetchInventory,
  inventoryValue,
  lowStockItems,
  num,
  saveInventoryItem,
  type InventoryItem,
} from "../lib/inventory";

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
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setList(await fetchInventory());
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                          onClick={() => setAdjusting(i)}
                          className="text-zinc-400 hover:text-orange-400 mr-2"
                          title="盘点/损耗"
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
    </div>
  );
}
