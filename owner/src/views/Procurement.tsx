import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  Download,
  Wallet,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { ChartCard, EmptyState, KpiCard, Skeleton } from "../components/ui";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney } from "../lib/format";
import {
  costImpactForPriceChange,
  createPurchase,
  fetchBoms,
  fetchInventory,
  fetchPurchases,
  num,
  restockSuggestions,
  type InventoryItem,
  type PurchaseOrder,
  type RecipeBom,
  type RestockSuggestion,
} from "../lib/inventory";

const newLocalId = () =>
  `INV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

  const load = async () => {
    setLoading(true);
    const [p, i, b] = await Promise.all([
      fetchPurchases(),
      fetchInventory(),
      fetchBoms(),
    ]);
    setList(p);
    setInv(i);
    setBoms(b);
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

  const restock = useMemo(() => restockSuggestions(inv), [inv]);

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

  const preselect = (item: RestockSuggestion) => {
    setIsNew(false);
    setForm((f) => ({
      ...f,
      itemId: item.id,
      quantity: String(item.gap > 0 ? item.gap : "1"),
      unit_price: String(item.price || ""),
    }));
    setOpen(true);
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

      {restock.length > 0 && (
        <ChartCard
          title="补货建议"
          subtitle="低于安全库存的原料，一键补货"
          action={<AlertTriangle size={18} className="text-amber-400" />}
        >
          <div className="space-y-1.5">
            {restock.map((i) => (
              <div
                key={i.id}
                className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-zinc-200">{i.name}</span>
                  <span className="text-zinc-500 text-xs ml-2">
                    现存 {num(i.stock)}
                    {i.unit} / 安全 {num(i.safety_stock)}
                    {i.unit}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-zinc-400 text-xs">
                    建议补 {i.gap}
                    {i.unit} · 约 {fmtMoney(i.estCost)}
                  </span>
                  <button
                    onClick={() => preselect(i)}
                    className="px-3 py-1.5 rounded-lg btn-brand text-white text-xs font-semibold"
                  >
                    补货
                  </button>
                </div>
              </div>
            ))}
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
          <Skeleton className="h-40 w-full" />
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
              className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white"
            />
          </div>
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
