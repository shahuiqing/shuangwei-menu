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
  Languages,
  ListPlus,
  Download,
} from "lucide-react";
import { ChartCard, EmptyState, SkeletonRows } from "../components/ui";
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
  type MenuItemAddon,
} from "../lib/menu";
import {
  LANGS,
  getLangNames,
  langCompletion,
  langCoverage,
  langCsv,
  type DishLangNames,
} from "../lib/langNames";
import { downloadText } from "../lib/localdb";

/** 配菜（口味/加料）草稿：价格用字符串编辑，保存时归一化成数字 */
type AddonDraft = {
  id: string;
  name: string;
  priceText: string;
  free: boolean;
};

/** 菜单里的配菜 → 草稿（老菜单无 addons 时为空） */
function toAddonDrafts(list: unknown): AddonDraft[] {
  if (!Array.isArray(list)) return [];
  return list.map((a: any, i: number) => ({
    id: String(a?.id || `addon-${i}-${a?.name || ""}`),
    name: String(a?.name ?? ""),
    priceText: String(Number(a?.price) || 0),
    free: !(Number(a?.price) > 0),
  }));
}

/** 草稿 → 菜单配菜（保持顾客端字段结构：id / name / price 数字，price 0 = 免费） */
function normalizeAddons(list: unknown): MenuItemAddon[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((a: any, i: number) => {
      const name = String(a?.name ?? "").trim();
      const price = Number(a?.price) || 0;
      return {
        id: String(a?.id || `addon-${Date.now().toString(36)}-${i}`),
        name,
        price: price > 0 ? price : 0,
        // 已有多语言名保留，避免编辑价格时丢掉
        ...(a?.enName ? { enName: String(a.enName) } : {}),
        ...(a?.frName ? { frName: String(a.frName) } : {}),
        ...(a?.arName ? { arName: String(a.arName) } : {}),
        ...(a?.maName ? { maName: String(a.maName) } : {}),
      };
    })
    .filter((a) => a.name);
}

const addonDraftsToMenu = (drafts: AddonDraft[]): MenuItemAddon[] =>
  normalizeAddons(
    drafts.map((d) => ({
      id: d.id,
      name: d.name,
      price: d.free ? 0 : Number(d.priceText) || 0,
    })),
  );

const genAddonId = () =>
  `addon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** 保存前校验：空名配菜不落库（否则顾客端会出现「+ 空名字 +¥」） */
function addonDraftToMenuSafe(drafts: AddonDraft[]): {
  list: MenuItemAddon[];
  bad: string[];
} {
  const bad = drafts
    .filter((d) => !String(d.name || "").trim())
    .map(() => "未命名配菜");
  return {
    list: addonDraftsToMenu(drafts.filter((d) => String(d.name || "").trim())),
    bad,
  };
}

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

  const [langModal, setLangModal] = useState<{
    catId: string;
    id: string;
    title: string;
    draft: DishLangNames;
  } | null>(null);

  // 配菜/口味弹窗：非空即打开
  const [addonModal, setAddonModal] = useState<{
    catId: string;
    id: string;
    title: string;
    list: AddonDraft[];
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
        if (stock !== null && !Number.isFinite(stock)) {
          toast.error("库存必须是有效数字");
          return false;
        }
        if (stock !== null && stock < 0) {
          toast.error("库存不能为负");
          return false;
        }
        const payload: Partial<MenuItem> = {
          title: d.title.trim(),
          price: String(d.price ?? ""),
          description: d.description || "",
          image: d.image || "",
          stock,
          // 库存归零即视为售罄，避免「库存 0 却仍可卖」的矛盾
          isSoldOut: stock === 0 ? true : !!d.isSoldOut,
          allergens: d.allergens || [],
          // 配菜/口味必须原样保留：顾客端会把它作为订单行 addons 快照，
          // 丢了这里等于「加了口味却不加价」（老板反馈的原始问题）。
          addons: normalizeAddons(d.addons),
        };
        return dishModal.dishId
          ? updateDish(dishModal.catId, dishModal.dishId, payload)
          : addDish(dishModal.catId, payload as MenuItem);
      },
      dishModal?.dishId ? "菜品已更新" : "菜品已新增",
    ).then(() => setDishModal(null));

  const exportLang = () => {
    const rows = cats.flatMap((c) => c.items || []);
    if (!rows.length) return toast.error("暂无菜品可导出");
    downloadText(
      `dish-lang-${new Date().toISOString().slice(0, 10)}.csv`,
      langCsv(rows),
      "text/csv;charset=utf-8",
    );
    toast.success(`已导出 ${rows.length} 个菜品的多语言名称`);
  };

  const saveLang = async () => {
    if (!langModal) return;
    const patch: Partial<MenuItem> = {
      enTitle: langModal.draft.en || "",
      frTitle: langModal.draft.fr || "",
      arTitle: langModal.draft.ar || "",
      maTitle: langModal.draft.ma || "",
    };
    const ok = await updateDish(langModal.catId, langModal.id, patch);
    if (!ok) return toast.error("保存失败（检查数据库权限）");
    toast.success("多语言名称已保存并同步顾客端");
    setLangModal(null);
    load();
  };

  const saveAddons = async () => {
    if (!addonModal) return;
    const rows = addonDraftToMenuSafe(addonModal.list);
    if (rows.bad.length) {
      return toast.error(`配菜「${rows.bad[0]}」名称不能为空`);
    }
    const ok = await updateDish(addonModal.catId, addonModal.id, {
      addons: rows.list,
    });
    if (!ok) return toast.error("保存失败（检查数据库权限）");
    toast.success(
      rows.list.length
        ? `配菜已保存（${rows.list.length} 项），顾客端下单按此加价`
        : "已清空配菜",
    );
    setAddonModal(null);
    load();
  };

  return (
    <div className="space-y-4 sm:space-y-5">
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
        <span>
          多语言已录 {langCoverage(cats).dishes} 菜（四语齐全{" "}
          {langCoverage(cats).complete}）
        </span>
        <button
          onClick={exportLang}
          className="flex items-center gap-1.5 text-zinc-300 hover:text-white"
        >
          <Download size={13} /> 导出多语言 CSV
        </button>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
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
                      className="p-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                      title="重命名"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`删除分类「${c.name}」及其下所有菜品？`))
                          run(() => deleteCategory(c.id), "分类已删除");
                      }}
                      className="p-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
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
                      className="p-2.5 rounded-lg text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
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
                    {items.map((it) => {
                      const langDone = langCompletion(it);
                      return (
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
                              {Array.isArray(it.addons) &&
                                it.addons.length > 0 &&
                                ` · ${it.addons.length} 种配菜`}
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
                              className="p-2.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10"
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
                                setLangModal({
                                  catId: c.id,
                                  id: it.id,
                                  title: it.title,
                                  draft: getLangNames(it),
                                })
                              }
                              className={`p-2.5 rounded-lg ${
                                langDone === LANGS.length
                                  ? "text-green-400 hover:bg-green-500/10"
                                  : langDone > 0
                                    ? "text-amber-400 hover:bg-amber-500/10"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                              }`}
                              title={
                                langDone
                                  ? `多语言名称（已录 ${langDone}/${LANGS.length}）`
                                  : "多语言名称"
                              }
                            >
                              <Languages size={15} />
                            </button>
                            <button
                              onClick={() =>
                                setAddonModal({
                                  catId: c.id,
                                  id: it.id,
                                  title: it.title,
                                  list: toAddonDrafts(it.addons),
                                })
                              }
                              className={`p-2.5 rounded-lg ${
                                Array.isArray(it.addons) && it.addons.length
                                  ? "text-orange-400 hover:bg-orange-500/10"
                                  : "text-zinc-400 hover:text-white hover:bg-white/5"
                              }`}
                              title={
                                Array.isArray(it.addons) && it.addons.length
                                  ? `配菜/口味（${it.addons.length} 项）`
                                  : "配菜/口味"
                              }
                            >
                              <ListPlus size={15} />
                            </button>
                            <button
                              onClick={() =>
                                setDishModal({
                                  catId: c.id,
                                  dishId: it.id,
                                  draft: { ...it },
                                })
                              }
                              className="p-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
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
                              className="p-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                              title="删除"
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
      {/* 多语言名称弹窗 */}
      <Sheet
        open={!!langModal}
        title="多语言名称"
        subtitle={
          langModal ? `${langModal.title} · 保存后同步顾客端菜单` : undefined
        }
        onClose={() => setLangModal(null)}
      >
        {langModal && (
          <>
            {LANGS.map((l) => (
              <SheetField
                key={l.code}
                label={l.label}
                value={langModal.draft[l.code] || ""}
                onChange={(v) =>
                  setLangModal({
                    ...langModal,
                    draft: { ...langModal.draft, [l.code]: v },
                  })
                }
                placeholder={l.label}
                className="mb-3"
              />
            ))}
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                已录{" "}
                {
                  LANGS.filter((l) => (langModal.draft[l.code] || "").trim())
                    .length
                }
                /{LANGS.length} 种语言
              </span>
              <span className="text-zinc-600">中文名即菜品名称，无需填写</span>
            </div>
            <button
              onClick={saveLang}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold active:scale-[0.98] transition-transform"
            >
              <Save size={16} /> 保存并同步
            </button>
          </>
        )}
      </Sheet>

      {/* 配菜/口味弹窗：加价规则在这里维护，顾客端下单会快照到订单行 */}
      <Sheet
        open={!!addonModal}
        title="配菜 / 口味"
        subtitle={
          addonModal
            ? `${addonModal.title} · 顾客选口味时按这里的价格加价`
            : undefined
        }
        onClose={() => setAddonModal(null)}
      >
        {addonModal && (
          <>
            {addonModal.list.length === 0 && (
              <div className="text-xs text-zinc-500 mb-3">
                还没有配菜。新增「大份 +10」「加芝士
                +5」这类口径后，顾客端下单会自动带价， 结账单和加菜单也会显示
                +价格。
              </div>
            )}
            <div className="space-y-2">
              {addonModal.list.map((a, i) => (
                <div
                  key={a.id}
                  className="bg-zinc-950 rounded-xl p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <SheetField
                      label="配菜名称"
                      className="flex-1"
                      value={a.name}
                      placeholder="如：大份 / 加芝士"
                      onChange={(v) =>
                        setAddonModal({
                          ...addonModal,
                          list: addonModal.list.map((x, k) =>
                            k === i ? { ...x, name: v } : x,
                          ),
                        })
                      }
                    />
                    <button
                      onClick={() =>
                        setAddonModal({
                          ...addonModal,
                          list: addonModal.list.filter((_, k) => k !== i),
                        })
                      }
                      className="mt-4 p-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                      title="删除配菜"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="flex items-end gap-2">
                    <SheetField
                      label="加价"
                      type="number"
                      className="flex-1"
                      value={a.free ? "0" : a.priceText}
                      onChange={(v) =>
                        setAddonModal({
                          ...addonModal,
                          list: addonModal.list.map((x, k) =>
                            k === i
                              ? { ...x, priceText: v, free: !(Number(v) > 0) }
                              : x,
                          ),
                        })
                      }
                    />
                    <label className="flex items-center gap-1.5 text-xs text-zinc-300 pb-2.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={a.free}
                        onChange={(e) =>
                          setAddonModal({
                            ...addonModal,
                            list: addonModal.list.map((x, k) =>
                              k === i
                                ? {
                                    ...x,
                                    free: e.target.checked,
                                    priceText: e.target.checked
                                      ? "0"
                                      : x.priceText,
                                  }
                                : x,
                            ),
                          })
                        }
                      />
                      免费
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={() =>
                  setAddonModal({
                    ...addonModal,
                    list: [
                      ...addonModal.list,
                      {
                        id: genAddonId(),
                        name: "",
                        priceText: "0",
                        free: true,
                      },
                    ],
                  })
                }
                className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300"
              >
                <Plus size={15} /> 新增配菜
              </button>
              <span className="text-[11px] text-zinc-600">
                加价按份数累加，0 = 免费
              </span>
            </div>
            <button
              disabled={busy}
              onClick={saveAddons}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Save size={16} /> 保存并同步
            </button>
          </>
        )}
      </Sheet>
    </div>
  );
}
