import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Download,
  Wallet,
  Truck,
  X,
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, Skeleton } from "../components/ui";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney } from "../lib/format";
import {
  createPurchase,
  fetchInventory,
  fetchPurchases,
  num,
  type InventoryItem,
  type PurchaseOrder,
} from "../lib/inventory";

const newLocalId = () =>
  `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function Procurement() {
  const [list, setList] = useState<PurchaseOrder[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
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

  const load = async () => {
    setLoading(true);
    const [p, i] = await Promise.all([fetchPurchases(), fetchInventory()]);
    setList(p);
    setInv(i);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={Wallet}
          label="累计采购支出"
          value={fmtMoney(stats.total)}
        />
        <KpiCard
          icon={ShoppingCart}
          label="本月采购支出"
          value={fmtMoney(stats.month)}
          accent="text-blue-400"
          bg="bg-blue-500/10"
        />
        <KpiCard
          icon={Truck}
          label="供应商数"
          value={String(stats.suppliers)}
          accent="text-teal-400"
          bg="bg-teal-500/10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-orange-600 hover:bg-orange-500 rounded-xl"
        >
          <Plus size={16} /> 新建采购
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800"
        >
          <Download size={16} /> 导出
        </button>
      </div>

      <ChartCard title="采购记录" subtitle={`共 ${list.length} 笔`}>
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : list.length === 0 ? (
          <EmptyState text="暂无采购记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-zinc-800">
                  <th className="px-3 py-2 font-medium">时间</th>
                  <th className="px-3 py-2 font-medium">供应商</th>
                  <th className="px-3 py-2 font-medium">原料</th>
                  <th className="px-3 py-2 font-medium text-right">数量</th>
                  <th className="px-3 py-2 font-medium text-right">单价</th>
                  <th className="px-3 py-2 font-medium text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
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

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">新建采购入库</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

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
                    onChange={(e) =>
                      setForm({ ...form, itemName: e.target.value })
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                  <input
                    placeholder="单位（如 kg / 个 / 包）"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
                  />
                </>
              ) : (
                <select
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="数量"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
                <input
                  type="number"
                  placeholder="单价(成本)"
                  value={form.unit_price}
                  onChange={(e) =>
                    setForm({ ...form, unit_price: e.target.value })
                  }
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
                />
              </div>
              <input
                type="date"
                value={form.purchased_at}
                onChange={(e) =>
                  setForm({ ...form, purchased_at: e.target.value })
                }
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
              />
              <input
                placeholder="备注（选填）"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white"
              />
              <div className="text-right text-sm text-zinc-400">
                合计{" "}
                <span className="text-orange-400 font-bold">
                  {fmtMoney(num(form.quantity) * num(form.unit_price))}
                </span>
              </div>
            </div>

            <button
              onClick={submit}
              className="mt-4 w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold"
            >
              保存并入库
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
