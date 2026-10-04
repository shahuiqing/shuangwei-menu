import { useEffect, useMemo, useState } from "react";
import {
  UtensilsCrossed,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Info,
} from "lucide-react";
import { ChartCard, EmptyState, SkeletonRows } from "../components/ui";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import {
  deleteBom,
  fetchBoms,
  fetchInventory,
  num,
  saveBom,
  type InventoryItem,
  type RecipeBom,
} from "../lib/inventory";
import { buildDishCostMap } from "../lib/cost";

function parsePrice(v: unknown): number {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}

export default function Recipe({
  settings,
  version = 0,
}: {
  settings: any;
  version?: number;
}) {
  const [boms, setBoms] = useState<RecipeBom[]>([]);
  const [inv, setInv] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [form, setForm] = useState({
    inventory_item_id: "",
    dosage: "",
    station: "",
  });

  const load = async () => {
    setLoading(true);
    const [b, i] = await Promise.all([fetchBoms(), fetchInventory()]);
    setBoms(b);
    setInv(i);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  const dishes = useMemo(() => {
    const out: { name: string; price: number }[] = [];
    const cats = settings?.categories;
    if (Array.isArray(cats))
      cats.forEach((c: any) =>
        (c?.items || []).forEach((it: any) => {
          const name = it?.title || it?.name;
          if (name)
            out.push({ name: String(name), price: parsePrice(it?.price) });
        }),
      );
    return out;
  }, [settings]);

  const costMap = useMemo(() => buildDishCostMap(boms, inv), [boms, inv]);
  const invName = useMemo(() => new Map(inv.map((i) => [i.id, i])), [inv]);

  const byDish = useMemo(() => {
    const m = new Map<string, RecipeBom[]>();
    boms.forEach((b) => {
      const arr = m.get(b.menu_item_name) || [];
      arr.push(b);
      m.set(b.menu_item_name, arr);
    });
    return m;
  }, [boms]);

  const submit = async (dish: string) => {
    if (!form.inventory_item_id) return toast.error("请选择原料");
    const item = invName.get(form.inventory_item_id);
    const ok = await saveBom({
      menu_item_name: dish,
      inventory_item_id: form.inventory_item_id,
      dosage: num(form.dosage),
      unit: item?.unit || "kg",
      station: form.station,
    });
    if (!ok) return toast.error("保存失败");
    toast.success("配方已保存");
    setAdding(null);
    setForm({ inventory_item_id: "", dosage: "", station: "" });
    load();
  };

  const noRecipe = dishes.filter((d) => !byDish.has(d.name));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <span className="text-xs text-zinc-500">
          配方决定结账时扣哪些原料、扣多少；成本 = Σ 用量 × 原料单价
        </span>
      </div>

      {noRecipe.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
          <Info size={15} className="shrink-0 mt-0.5" />
          <span>
            未配配方菜品（结账不会扣库存、成本记 0）：
            {noRecipe.map((d) => d.name).join("、")}
          </span>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={4} />
      ) : dishes.length === 0 ? (
        <EmptyState text="菜单暂无菜品（请先在顾客端配置菜单）" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {dishes.map((d) => {
            const items = byDish.get(d.name) || [];
            const cost = costMap.get(d.name) || 0;
            const margin = d.price ? ((d.price - cost) / d.price) * 100 : 0;
            return (
              <ChartCard
                key={d.name}
                title={d.name}
                subtitle={`售价 ${fmtMoney(d.price)} · 成本 ${fmtMoney(cost)} · 毛利 ${fmtMoney(d.price - cost)} (${margin.toFixed(0)}%)`}
                action={
                  <button
                    onClick={() => {
                      setAdding(d.name);
                      setForm({
                        inventory_item_id: "",
                        dosage: "",
                        station: "",
                      });
                    }}
                    className="text-orange-400 hover:text-orange-300 p-1"
                    title="添加原料"
                  >
                    <Plus size={18} />
                  </button>
                }
              >
                {adding === d.name && (
                  <div className="mb-3 bg-zinc-950 border border-white/5 rounded-xl p-3 space-y-2">
                    <select
                      value={form.inventory_item_id}
                      onChange={(e) =>
                        setForm({ ...form, inventory_item_id: e.target.value })
                      }
                      className="w-full bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="">选择原料…</option>
                      {inv.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}（{i.unit}）
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="用量"
                        value={form.dosage}
                        onChange={(e) =>
                          setForm({ ...form, dosage: e.target.value })
                        }
                        className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <input
                        placeholder="档口(选填)"
                        value={form.station}
                        onChange={(e) =>
                          setForm({ ...form, station: e.target.value })
                        }
                        className="flex-1 bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => submit(d.name)}
                        className="flex-1 py-2 rounded-lg btn-brand text-white text-sm font-semibold"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setAdding(null)}
                        className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {items.length === 0 ? (
                  <EmptyState text="未配置配方" />
                ) : (
                  <div className="space-y-1.5">
                    {items.map((b) => {
                      const it = invName.get(b.inventory_item_id);
                      return (
                        <div
                          key={b.id}
                          className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-200 truncate mr-2">
                            {it?.name || b.inventory_item_id}
                            {b.station ? (
                              <span className="text-[11px] text-zinc-500 ml-1">
                                · {b.station}
                              </span>
                            ) : null}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-zinc-500 text-xs">
                              {num(b.dosage)}
                              {b.unit} ·{" "}
                              {fmtMoney(num(b.dosage) * num(it?.price))}
                            </span>
                            <button
                              onClick={async () => {
                                if (!confirm("删除该配方项？")) return;
                                const ok = await deleteBom(b.id);
                                if (ok) {
                                  toast.success("已删除");
                                  load();
                                } else toast.error("删除失败");
                              }}
                              className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 transition-transform"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ChartCard>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-zinc-600">
        <UtensilsCrossed size={12} />{" "}
        配方匹配使用菜品名，请与顾客端菜单名称保持一致
      </div>
    </div>
  );
}
