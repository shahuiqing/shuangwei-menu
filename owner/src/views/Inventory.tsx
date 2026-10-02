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
  X,
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, Skeleton } from "../components/ui";
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
    if (!confirm(`删除原料「${i.name}」？`)) return;
    const ok = await deleteInventoryItem(i.id);
    if (!ok) return toast.error("删除失败");
    toast.success("已删除");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={Wallet}
          label="库存总值"
          value={fmtMoney(inventoryValue(list))}
        />
        <KpiCard
          icon={Layers}
          label="原料品类"
          value={String(categories)}
          sub={`共 ${list.length} 种`}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={AlertTriangle}
          label="低库存预警"
          value={String(low.length)}
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
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-orange-600 hover:bg-orange-500 rounded-xl"
        >
          <Plus size={16} /> 新增原料
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索名称 / 分类"
          className="flex-1 min-w-[160px] bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <ChartCard
        title="库存列表"
        subtitle="采购与结账会自动更新现存量"
        action={<Boxes size={18} className="text-orange-500" />}
      >
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : shown.length === 0 ? (
          <EmptyState text="暂无原料，点「新增原料」" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-800">
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
      {editing && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">
                {editing.id ? "编辑原料" : "新增原料"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="名称"
                value={editing.name || ""}
                onChange={(v) => setEditing({ ...editing, name: v })}
                className="col-span-2"
              />
              <Field
                label="分类"
                value={editing.category || ""}
                onChange={(v) => setEditing({ ...editing, category: v })}
              />
              <Field
                label="单位"
                value={editing.unit || ""}
                onChange={(v) => setEditing({ ...editing, unit: v })}
              />
              <Field
                label="现存量"
                type="number"
                value={editing.stock}
                onChange={(v) => setEditing({ ...editing, stock: num(v) })}
              />
              <Field
                label="安全库存"
                type="number"
                value={editing.safety_stock}
                onChange={(v) =>
                  setEditing({ ...editing, safety_stock: num(v) })
                }
              />
              <Field
                label="单价(成本)"
                type="number"
                value={editing.price}
                onChange={(v) => setEditing({ ...editing, price: num(v) })}
                className="col-span-2"
              />
            </div>
            <button
              onClick={submitEdit}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold"
            >
              <Save size={16} /> 保存
            </button>
          </div>
        </div>
      )}

      {/* 调整库存 */}
      {adjusting && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAdjusting(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-semibold">
                调整库存 · {adjusting.name}
              </h3>
              <button
                onClick={() => setAdjusting(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              当前 {num(adjusting.stock)} {adjusting.unit} · 正数入库、负数出库
            </p>
            <Field
              label="调整数量"
              type="number"
              value={delta}
              onChange={setDelta}
            />
            <div className="h-3" />
            <Field label="备注" value={adjustNote} onChange={setAdjustNote} />
            <button
              onClick={submitAdjust}
              className="mt-4 w-full py-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white font-semibold"
            >
              确认调整
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
      />
    </label>
  );
}
