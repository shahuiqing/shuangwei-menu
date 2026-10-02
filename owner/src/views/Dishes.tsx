import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  Save,
  FolderPlus,
  Search,
  Ban,
  Check,
} from "lucide-react";
import { ChartCard, EmptyState, Skeleton } from "../components/ui";
import { Sheet, SheetField } from "../components/Sheet";
import { toast } from "../components/Toast";
import { fmtMoney } from "../lib/format";
import {
  addCategory,
  addDish,
  deleteCategory,
  deleteDish,
  fetchCategories,
  parsePrice,
  renameCategory,
  updateDish,
  type MenuCategory,
  type MenuItem,
} from "../lib/menu";

export default function Dishes({ version = 0 }: { version?: number }) {
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const [catModal, setCatModal] = useState<{
    id?: string;
    name: string;
  } | null>(null);
  const [dishModal, setDishModal] = useState<{
    catId: string;
    dishId?: string;
    draft: Partial<MenuItem>;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setCats(await fetchCategories());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  const searchHit = (it: MenuItem) =>
    !q.trim() || it.title.toLowerCase().includes(q.trim().toLowerCase());

  const stats = useMemo(() => {
    let dishes = 0;
    let soldOut = 0;
    let lowStock = 0;
    cats.forEach((c) =>
      (c.items || []).forEach((it) => {
        dishes++;
        if (it.isSoldOut) soldOut++;
        if (it.stock !== null && it.stock !== "" && Number(it.stock) <= 3)
          lowStock++;
      }),
    );
    return { dishes, soldOut, lowStock };
  }, [cats]);

  const run = async (fn: () => Promise<boolean>, okMsg: string) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) {
      toast.success(okMsg);
      load();
    } else toast.error("操作失败（检查数据库权限）");
  };

  const submitCat = () =>
    run(
      async () => {
        if (!catModal?.name.trim()) {
          toast.error("分类名称不能为空");
          return false;
        }
        return catModal.id
          ? renameCategory(catModal.id, catModal.name)
          : addCategory(catModal.name);
      },
      catModal?.id ? "分类已重命名" : "分类已新增",
    ).then(() => setCatModal(null));

  const submitDish = () =>
    run(
      async () => {
        if (!dishModal) return false;
        const d = dishModal.draft;
        if (!d.title?.trim()) {
          toast.error("菜品名称不能为空");
          return false;
        }
        const stockRaw = d.stock;
        const stock =
          stockRaw === "" || stockRaw === null || stockRaw === undefined
            ? null
            : Number(stockRaw);
        const payload: Partial<MenuItem> = {
          title: d.title.trim(),
          price: String(d.price ?? ""),
          description: d.description || "",
          image: d.image || "",
          stock,
          isSoldOut: !!d.isSoldOut,
          allergens: d.allergens || [],
        };
        return dishModal.dishId
          ? updateDish(dishModal.catId, dishModal.dishId, payload)
          : addDish(dishModal.catId, payload as MenuItem);
      },
      dishModal?.dishId ? "菜品已更新" : "菜品已新增",
    ).then(() => setDishModal(null));

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
        <button
          onClick={() => setCatModal({ name: "" })}
          className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-zinc-700 hover:bg-zinc-600 rounded-xl"
        >
          <FolderPlus size={16} /> 新建分类
        </button>
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索菜品"
            className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
        <span>
          共 {cats.length} 分类 · {stats.dishes} 菜品
        </span>
        <span className="text-amber-400">售罄 {stats.soldOut}</span>
        <span className="text-red-400">低库存 {stats.lowStock}</span>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : cats.length === 0 ? (
        <EmptyState text="暂无菜单，点「新建分类」开始" />
      ) : (
        <div className="space-y-5">
          {cats.map((c) => {
            const items = (c.items || []).filter(searchHit);
            return (
              <ChartCard
                key={c.id}
                title={c.name}
                subtitle={`${(c.items || []).length} 个菜品`}
                action={
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCatModal({ id: c.id, name: c.name })}
                      className="p-1.5 text-zinc-400 hover:text-white"
                      title="重命名"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`删除分类「${c.name}」及其下所有菜品？`))
                          run(() => deleteCategory(c.id), "分类已删除");
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-400"
                      title="删除分类"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() =>
                        setDishModal({
                          catId: c.id,
                          draft: { title: "", price: "" },
                        })
                      }
                      className="p-1.5 text-orange-400 hover:text-orange-300"
                      title="新增菜品"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                }
              >
                {items.length === 0 ? (
                  <EmptyState text={q ? "无匹配菜品" : "该分类暂无菜品"} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center gap-3 bg-zinc-950 rounded-xl px-3 py-2.5"
                      >
                        {it.image ? (
                          <img
                            src={it.image}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-100 font-medium truncate">
                              {it.title}
                            </span>
                            {it.isSoldOut && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">
                                售罄
                              </span>
                            )}
                            {it.stock !== null &&
                              it.stock !== "" &&
                              Number(it.stock) <= 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">
                                  剩{String(it.stock)}
                                </span>
                              )}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {fmtMoney(parsePrice(it.price))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              run(
                                () =>
                                  updateDish(c.id, it.id, {
                                    isSoldOut: !it.isSoldOut,
                                  }),
                                it.isSoldOut ? "已恢复售卖" : "已标售罄",
                              )
                            }
                            className="p-1.5 text-zinc-400 hover:text-amber-400"
                            title={it.isSoldOut ? "恢复售卖" : "标为售罄"}
                          >
                            {it.isSoldOut ? (
                              <Check size={15} />
                            ) : (
                              <Ban size={15} />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setDishModal({
                                catId: c.id,
                                dishId: it.id,
                                draft: { ...it },
                              })
                            }
                            className="p-1.5 text-zinc-400 hover:text-white"
                            title="编辑"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`删除菜品「${it.title}」？`))
                                run(
                                  () => deleteDish(c.id, it.id),
                                  "菜品已删除",
                                );
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-400"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
            );
          })}
        </div>
      )}

      {/* 分类弹窗 */}
      <Sheet
        open={!!catModal}
        title={catModal?.id ? "重命名分类" : "新建分类"}
        onClose={() => setCatModal(null)}
      >
        {catModal && (
          <>
            <SheetField
              label="分类名称"
              value={catModal.name}
              onChange={(v) => setCatModal({ ...catModal, name: v })}
            />
            <button
              disabled={busy}
              onClick={submitCat}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Save size={16} /> 保存
            </button>
          </>
        )}
      </Sheet>

      {/* 菜品弹窗 */}
      <Sheet
        open={!!dishModal}
        title={dishModal?.dishId ? "编辑菜品" : "新增菜品"}
        onClose={() => setDishModal(null)}
      >
        {dishModal && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SheetField
                label="菜品名称"
                className="col-span-2"
                value={dishModal.draft.title || ""}
                onChange={(v) =>
                  setDishModal({
                    ...dishModal,
                    draft: { ...dishModal.draft, title: v },
                  })
                }
              />
              <SheetField
                label="价格"
                type="number"
                value={dishModal.draft.price || ""}
                onChange={(v) =>
                  setDishModal({
                    ...dishModal,
                    draft: { ...dishModal.draft, price: v },
                  })
                }
              />
              <SheetField
                label="库存(空=不限)"
                type="number"
                value={(dishModal.draft.stock as any) ?? ""}
                onChange={(v) =>
                  setDishModal({
                    ...dishModal,
                    draft: { ...dishModal.draft, stock: v },
                  })
                }
              />
              <SheetField
                label="图片 URL"
                className="col-span-2"
                value={dishModal.draft.image || ""}
                onChange={(v) =>
                  setDishModal({
                    ...dishModal,
                    draft: { ...dishModal.draft, image: v },
                  })
                }
              />
              <SheetField
                label="描述"
                className="col-span-2"
                value={dishModal.draft.description || ""}
                onChange={(v) =>
                  setDishModal({
                    ...dishModal,
                    draft: { ...dishModal.draft, description: v },
                  })
                }
              />
              <label className="col-span-2 flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!dishModal.draft.isSoldOut}
                  onChange={(e) =>
                    setDishModal({
                      ...dishModal,
                      draft: {
                        ...dishModal.draft,
                        isSoldOut: e.target.checked,
                      },
                    })
                  }
                />
                标记为售罄
              </label>
            </div>
            <button
              disabled={busy}
              onClick={submitDish}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Save size={16} /> 保存
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
