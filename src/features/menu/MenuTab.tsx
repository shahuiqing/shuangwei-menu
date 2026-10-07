import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Settings,
  Plus,
  DownloadCloud,
  UploadCloud,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  ArrowUpDown,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Languages,
} from "lucide-react";
import { compressImage } from "../../utils/image";
import { uploadBase64ToStorage } from "../../utils/storage";
import type { MenuCategory } from "../../types/menu";

const ALLERGEN_OPTIONS = [
  { id: "gluten", label: "麸质", en: "Gluten", icon: "🌾" },
  { id: "milk", label: "乳制品", en: "Dairy", icon: "🥛" },
  { id: "eggs", label: "蛋类", en: "Eggs", icon: "🥚" },
  { id: "fish", label: "鱼类", en: "Fish", icon: "🐟" },
  { id: "shellfish", label: "贝壳类", en: "Shellfish", icon: "🦐" },
  { id: "peanuts", label: "花生", en: "Peanuts", icon: "🥜" },
  { id: "soy", label: "大豆", en: "Soy", icon: "🫘" },
  { id: "sesame", label: "芝麻", en: "Sesame", icon: "⚪" },
  { id: "mustard", label: "芥末", en: "Mustard", icon: "🟡" },
  { id: "celery", label: "芹菜", en: "Celery", icon: "🥬" },
  { id: "sulphites", label: "亚硫酸盐", en: "Sulphites", icon: "🧪" },
  { id: "lupin", label: "羽扇豆", en: "Lupin", icon: "🫛" },
  { id: "molluscs", label: "软体动物", en: "Molluscs", icon: "🐚" },
  { id: "nuts", label: "坚果", en: "Tree Nuts", icon: "🌰" },
  { id: "none", label: "无", en: "None", icon: "🚫" },
];

interface MenuTabProps {
  categories: MenuCategory[];
  setCategories: (c: MenuCategory[]) => void;
  newCategory: any;
  setNewCategory: (v: any) => void;
  newDish: any;
  setNewDish: (v: any) => void;
  handleAddCategory: (e: FormEvent) => void;
  handleAddDish: (e: FormEvent) => void;
  handleQuickAddDish?: (
    categoryId: string,
    title: string,
    price: string,
  ) => void;
  handleDeleteCategory: (idToRemove: string) => void;
  handleDeleteDish: (categoryId: string, dishId: string) => void;
  handleEditDish: (categoryId: string, dishId: string) => void;
  handleCancelEdit: () => void;
  editingDishId?: string | null;
  handleMoveCategory: (catIdx: number, direction: "up" | "down") => void;
  handleMoveDish: (
    catId: string,
    itemIdx: number,
    direction: "up" | "down" | "top" | "bottom",
  ) => void;
  handleExportJson: () => void;
  handleExportCsv: () => void;
  handleAITranslate: () => Promise<void>;
  handleAIEnhanceImage: () => Promise<void>;
  setCurrency: (v: string) => void;
  setIsUploading: (v: boolean) => void;
  setUploadingItemId: (v: string | null) => void;
  setPromptDialog: (v: any) => void;
  setPromptValue: (v: string) => void;
  setSelectedCategory: (v: string) => void;
  setSortingCategoryId: (v: string | null) => void;
  currency: string;
  isUploading: boolean;
  uploadingItemId: string | null;
  selectedCategory: string;
  onSaveToCloud?: (overrides?: any) => void;
  isTranslating: boolean;
  isEnhancing: boolean;
}

export function MenuTab(props: MenuTabProps) {
  const {
    categories,
    setCategories,
    newCategory,
    setNewCategory,
    newDish,
    setNewDish,
    handleAddCategory,
    handleAddDish,
    handleQuickAddDish,
    handleDeleteCategory,
    handleDeleteDish,
    handleEditDish,
    handleCancelEdit,
    editingDishId,
    handleMoveCategory,
    setSortingCategoryId,
    handleExportJson,
    handleExportCsv,
    handleAITranslate,
    handleAIEnhanceImage,
    setCurrency,
    setIsUploading,
    setUploadingItemId,
    setPromptDialog,
    setPromptValue,
    setSelectedCategory,
    currency,
    isUploading,
    uploadingItemId,
    selectedCategory,
    onSaveToCloud,
    isTranslating,
    isEnhancing,
  } = props;

  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showNewCat, setShowNewCat] = useState(false);
  const [showDishForm, setShowDishForm] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [quick, setQuick] = useState<
    Record<string, { title: string; price: string }>
  >({});

  const dishFormOpen = showDishForm || !!editingDishId;
  const q = query.trim().toLowerCase();
  const isSearching = q.length > 0;

  const visible = useMemo(() => {
    const matches = (it: any) =>
      [
        it.title,
        it.name,
        it.enTitle,
        it.frTitle,
        it.arTitle,
        it.maTitle,
        it.description,
        it.enDescription,
        it.price,
      ].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      );

    return categories
      .map((cat: any) => {
        const items: any[] = cat.items || [];
        if (!isSearching) return { cat, items, matchedByCat: false as boolean };
        const catMatch = `${cat.name || ""} ${cat.enName || ""}`
          .toLowerCase()
          .includes(q);
        return {
          cat,
          items: catMatch ? items : items.filter(matches),
          matchedByCat: catMatch,
        };
      })
      .filter((x) => !isSearching || x.items.length > 0);
  }, [categories, q, isSearching]);

  const updateItem = (
    catId: string,
    itemId: string,
    patch: Record<string, any>,
  ) => {
    const updated = categories.map((c: any) =>
      c.id === catId
        ? {
            ...c,
            items: (c.items || []).map((i: any) =>
              i.id === itemId ? { ...i, ...patch } : i,
            ),
          }
        : c,
    );
    setCategories(updated);
    if (onSaveToCloud) onSaveToCloud({ categories: updated, silent: true });
  };

  const openPriceEditor = (catId: string, item: any) => {
    setPromptValue(item.price || "");
    setPromptDialog({
      isOpen: true,
      message: `修改「${item.title}」的价格 / Edit price:`,
      defaultValue: item.price || "",
      onConfirm: (v: string) => {
        if (v.trim() !== "") updateItem(catId, item.id, { price: v.trim() });
        setPromptDialog(null);
      },
    });
  };

  const openStockEditor = (catId: string, item: any) => {
    const current =
      item.stock !== undefined && item.stock !== null ? String(item.stock) : "";
    setPromptValue(current);
    setPromptDialog({
      isOpen: true,
      message: `修改「${item.title}」的库存（留空为无限制）/ Edit stock:`,
      defaultValue: current,
      onConfirm: (v: string) => {
        const t = v.trim();
        const stockVal = t === "" || isNaN(Number(t)) ? null : Number(t);
        updateItem(catId, item.id, {
          stock: stockVal,
          isSoldOut: stockVal === 0 ? true : item.isSoldOut,
        });
        setPromptDialog(null);
      },
    });
  };

  const uploadDishImage = async (catId: string, itemId: string, file: File) => {
    try {
      setUploadingItemId(itemId);
      const compressed = await compressImage(file);
      const finalUrl = await uploadBase64ToStorage(compressed, "dishes");
      updateItem(catId, itemId, { image: finalUrl });
    } catch (err: any) {
      console.error("Image upload failed:", err);
      alert("上传失败 (Upload failed): " + (err?.message || "unknown error"));
    } finally {
      setUploadingItemId(null);
    }
  };

  const submitQuick = (catId: string) => {
    const qa = quick[catId];
    if (!qa || !qa.title.trim()) return;
    handleQuickAddDish?.(catId, qa.title, qa.price);
    setQuick((p) => ({ ...p, [catId]: { title: "", price: "" } }));
  };

  const setQuickField = (
    catId: string,
    field: "title" | "price",
    value: string,
  ) =>
    setQuick((p) => ({
      ...p,
      [catId]: {
        title: field === "title" ? value : (p[catId]?.title ?? ""),
        price: field === "price" ? value : (p[catId]?.price ?? ""),
      },
    }));

  return (
    <>
      {/* Header + export */}
      <div className="mb-4 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings size={20} className="text-orange-500" /> 菜单管理
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-orange-500 rounded-xl text-xs font-semibold transition-colors active:scale-95"
            >
              <DownloadCloud size={16} className="text-orange-400" />
              <span>导出 JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-green-500 text-zinc-300 hover:text-green-500 rounded-xl text-xs font-semibold transition-colors active:scale-95"
            >
              <FileSpreadsheet size={16} className="text-green-400" />
              <span>导出 CSV</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索菜品 / 分类名称…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowNewCat((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-orange-500 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus size={15} /> 新建分类
            <ChevronDown
              size={14}
              className={`transition-transform ${showNewCat ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {showNewCat && (
          <form
            onSubmit={(e) => {
              handleAddCategory(e);
              setShowNewCat(false);
            }}
            className="flex flex-col gap-2 mt-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="分类名称 (中文) *"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.enName}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, enName: e.target.value })
                }
                placeholder="Name (EN)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.frName}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, frName: e.target.value })
                }
                placeholder="Nom (FR)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.arName}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, arName: e.target.value })
                }
                placeholder="الاسم (AR)"
                dir="auto"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white text-right focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.maName}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, maName: e.target.value })
                }
                placeholder="الاسم (MA)"
                dir="auto"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white text-right focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm self-end"
            >
              添加分类 / Add Category
            </button>
          </form>
        )}
      </div>

      {/* Categories accordion */}
      <div className="mb-6 space-y-3">
        {visible.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500 bg-zinc-950 rounded-2xl border border-zinc-800/50">
            {isSearching
              ? "没有匹配的菜品"
              : "还没有分类，点上方「新建分类」开始"}
          </div>
        )}
        {visible.map(({ cat, items }: any, catIdx: number) => {
          const open = isSearching || !!expanded[cat.id];
          const count = (cat.items || []).length;
          return (
            <div
              key={cat.id}
              className="bg-zinc-950 rounded-2xl border border-zinc-800/50 overflow-hidden"
            >
              <div className="flex items-center gap-2 p-3 bg-zinc-900/60 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((p) => ({ ...p, [cat.id]: !p[cat.id] }))
                  }
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <ChevronRight
                    size={16}
                    className={`flex-shrink-0 text-zinc-500 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <span className="text-sm text-zinc-100 font-semibold truncate">
                    {cat.name}
                  </span>
                  <span className="text-zinc-500 text-xs flex-shrink-0">
                    {isSearching ? `${items.length} 项匹配` : `${count} 道菜`}
                  </span>
                </button>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={catIdx === 0}
                    onClick={() => handleMoveCategory(catIdx, "up")}
                    className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors"
                    title="分类上移"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={catIdx === visible.length - 1}
                    onClick={() => handleMoveCategory(catIdx, "down")}
                    className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors"
                    title="分类下移"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortingCategoryId(cat.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-md transition-colors border border-amber-500/20 font-medium"
                    title="菜品排序调整"
                  >
                    <ArrowUpDown size={13} /> 排序
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="flex items-center gap-1 text-xs px-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                    title="删除分类"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
              </div>

              {open && (
                <div className="p-2">
                  {/* Quick add */}
                  <div className="flex items-center gap-2 p-2 mb-2 bg-zinc-900/40 rounded-lg border border-dashed border-zinc-800">
                    <Plus size={14} className="text-orange-500 flex-shrink-0" />
                    <input
                      type="text"
                      value={quick[cat.id]?.title ?? ""}
                      onChange={(e) =>
                        setQuickField(cat.id, "title", e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitQuick(cat.id);
                        }
                      }}
                      placeholder="快速加菜：输入菜名后回车"
                      className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={quick[cat.id]?.price ?? ""}
                      onChange={(e) =>
                        setQuickField(cat.id, "price", e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitQuick(cat.id);
                        }
                      }}
                      placeholder="价格"
                      className="w-20 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => submitQuick(cat.id)}
                      className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex-shrink-0"
                    >
                      添加
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="text-xs text-zinc-600 px-3 py-5 text-center">
                      {isSearching
                        ? "该分类无匹配菜品"
                        : "暂无菜品，用上面的快速加菜添加，或展开下方「添加新菜品」"}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 bg-zinc-900/40 rounded-lg"
                        >
                          <label
                            htmlFor={`upload-item-${item.id}`}
                            className="cursor-pointer relative flex flex-shrink-0 w-11 h-11 group/img"
                          >
                            <div
                              className={`absolute inset-0 bg-black/60 flex items-center justify-center rounded-md z-10 transition-all ${uploadingItemId === item.id ? "opacity-100" : "opacity-0 md:group-hover/img:opacity-100"}`}
                            >
                              {uploadingItemId === item.id ? (
                                <Loader2
                                  size={16}
                                  className="text-white animate-spin"
                                />
                              ) : (
                                <UploadCloud
                                  size={16}
                                  className="text-white drop-shadow-md"
                                />
                              )}
                            </div>
                            <input
                              id={`upload-item-${item.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file)
                                  await uploadDishImage(cat.id, item.id, file);
                                e.target.value = "";
                              }}
                            />
                            {item.image ? (
                              <img
                                src={item.image}
                                alt=""
                                className="w-11 h-11 rounded-md object-cover bg-zinc-800"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-500">
                                {uploadingItemId !== item.id && (
                                  <UploadCloud size={16} />
                                )}
                              </div>
                            )}
                          </label>

                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-zinc-200 font-medium truncate">
                              {item.title}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openPriceEditor(cat.id, item)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                                title="点击改价"
                              >
                                {item.price || "未定价"} <Edit2 size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => openStockEditor(cat.id, item)}
                                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono"
                                title="点击改库存"
                              >
                                {item.stock !== undefined && item.stock !== null
                                  ? `库存 ${item.stock}`
                                  : "库存不限"}
                              </button>
                              {Array.isArray(item.allergens) &&
                                item.allergens.length > 0 && (
                                  <span className="text-[10px] text-amber-400/80">
                                    ⚠ 过敏原 {item.allergens.length}
                                  </span>
                                )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                updateItem(cat.id, item.id, {
                                  isSoldOut: !item.isSoldOut,
                                })
                              }
                              className={`text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border rounded-md transition-colors ${
                                item.isSoldOut
                                  ? "border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-white"
                                  : "border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                              }`}
                              title={
                                item.isSoldOut ? "标记为在售" : "标记为售罄"
                              }
                            >
                              {item.isSoldOut ? "已售罄" : "售罄"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditDish(cat.id, item.id)}
                              className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border border-orange-500/30 text-orange-400 hover:bg-orange-500 hover:text-white rounded-md transition-colors"
                              title="编辑菜品（名称/描述/价格/库存等）"
                            >
                              <Edit2 size={13} /> 编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDish(cat.id, item.id)}
                              className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                              title="删除菜品"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / edit dish */}
      <div>
        <button
          type="button"
          onClick={() => setShowDishForm((v) => !v)}
          className="w-full flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 hover:border-orange-500/50 transition-colors"
        >
          <span className="flex items-center gap-2 text-base font-semibold text-white">
            <Plus size={18} className="text-orange-500" />
            {editingDishId ? "编辑菜品" : "添加新菜品（含图片/多语言/过敏原）"}
          </span>
          <ChevronDown
            size={18}
            className={`text-zinc-500 transition-transform ${dishFormOpen ? "rotate-180" : ""}`}
          />
        </button>

        {dishFormOpen && (
          <form
            data-menu-form
            noValidate
            onSubmit={handleAddDish}
            className="mt-3 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  选择分类
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                >
                  {categories.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  菜品名称 (中) *
                </label>
                <input
                  type="text"
                  value={newDish.title}
                  onChange={(e) =>
                    setNewDish({ ...newDish, title: e.target.value })
                  }
                  placeholder="例如：孜然羊肉"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  价格 *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="28"
                    value={newDish.price}
                    onChange={(e) =>
                      setNewDish({ ...newDish, price: e.target.value })
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-24 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="MAD">MAD</option>
                    <option value="€">€</option>
                    <option value="$">$</option>
                    <option value="¥">¥</option>
                    <option value="£">£</option>
                    <option value="none">无</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  库存 (留空为无限制)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="例如：50"
                  value={newDish.stock}
                  onChange={(e) =>
                    setNewDish({ ...newDish, stock: e.target.value })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  图片 URL 或 上传本地图片（选填）
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newDish.image}
                    onChange={(e) =>
                      setNewDish({ ...newDish, image: e.target.value })
                    }
                    placeholder="输入图片 URL 或点击右侧上传"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                  <label className="flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl px-4 cursor-pointer transition-colors text-sm font-semibold text-zinc-300">
                    {isUploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-1" />{" "}
                        上传中
                      </>
                    ) : (
                      <span>上传图片</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setIsUploading(true);
                            const compressed = await compressImage(file);
                            const publicUrl = await uploadBase64ToStorage(
                              compressed,
                              "dishes",
                            );
                            setNewDish((prev: any) => ({
                              ...prev,
                              image: publicUrl,
                            }));
                          } catch (err: any) {
                            console.error("Image upload failed:", err);
                            alert(err.message || "上传失败");
                          } finally {
                            setIsUploading(false);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                {newDish.image && newDish.image.startsWith("data:image") && (
                  <button
                    type="button"
                    onClick={handleAIEnhanceImage}
                    disabled={isEnhancing}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 mt-2 bg-zinc-900 border border-orange-500/50 hover:bg-orange-500/10 text-orange-400 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isEnhancing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    AI 一键美化图片
                  </button>
                )}
                {newDish.image &&
                  /^(https?:\/\/|data:image\/|\/|\.\/)/.test(newDish.image) && (
                    <div className="mt-3 relative w-full h-40 sm:h-48 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 group">
                      <img
                        src={newDish.image}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3 pointer-events-none">
                        <span className="text-[10px] sm:text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                          <ImageIcon size={14} /> 预览 (Preview)
                        </span>
                      </div>
                    </div>
                  )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  过敏原信息 / Allergens
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map((allergen) => {
                    const isSelected = (newDish.allergens || []).includes(
                      allergen.id,
                    );
                    return (
                      <button
                        type="button"
                        key={allergen.id}
                        onClick={() => {
                          setNewDish((prev: any) => {
                            const cur = prev.allergens || [];
                            return {
                              ...prev,
                              allergens: isSelected
                                ? cur.filter((a: any) => a !== allergen.id)
                                : [...cur, allergen.id],
                            };
                          });
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-orange-500/20 border-orange-500 text-orange-400"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <span>{allergen.icon}</span>
                        <span>{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  配菜选项 / Add-ons（顾客点餐时可多选，可加价）
                </label>
                <div className="space-y-2">
                  {(newDish.addons || []).map((addon: any, idx: number) => (
                    <div
                      key={addon.id || idx}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        placeholder="配菜名（如：加香菜）"
                        value={addon.name || ""}
                        onChange={(e) => {
                          const addons = [...(newDish.addons || [])];
                          addons[idx] = {
                            ...addons[idx],
                            name: e.target.value,
                          };
                          setNewDish({ ...newDish, addons });
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="加价 0"
                        value={addon.price ?? ""}
                        onChange={(e) => {
                          const addons = [...(newDish.addons || [])];
                          addons[idx] = {
                            ...addons[idx],
                            price:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          };
                          setNewDish({ ...newDish, addons });
                        }}
                        className="w-24 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const addons = (newDish.addons || []).filter(
                            (_: any, i: number) => i !== idx,
                          );
                          setNewDish({ ...newDish, addons });
                        }}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const addons = [
                        ...(newDish.addons || []),
                        {
                          id:
                            "tmp-" +
                            Date.now().toString(36) +
                            Math.random().toString(36).slice(2, 5),
                          name: "",
                          enName: "",
                          frName: "",
                          price: 0,
                        },
                      ];
                      setNewDish({ ...newDish, addons });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 hover:text-orange-400 hover:border-orange-500/50 transition-colors"
                  >
                    <Plus size={14} /> 添加配菜
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  描述 (中)
                </label>
                <textarea
                  rows={2}
                  value={newDish.description}
                  onChange={(e) =>
                    setNewDish({ ...newDish, description: e.target.value })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Multi-language (collapsed) */}
            <button
              type="button"
              onClick={() => setShowLang((v) => !v)}
              className="w-full flex items-center justify-between mt-4 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 hover:border-orange-500/50 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Languages size={15} className="text-orange-400" />
                多语言内容（英 / 法 / 阿 / 摩洛哥语）
              </span>
              <ChevronDown
                size={16}
                className={`text-zinc-500 transition-transform ${showLang ? "rotate-180" : ""}`}
              />
            </button>

            {showLang && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleAITranslate}
                  disabled={isTranslating}
                  className="sm:col-span-2 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2 bg-zinc-900 border border-orange-500/50 hover:bg-orange-500/10 text-orange-400 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isTranslating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  一键 AI 翻译（根据中文自动填充以下字段）
                </button>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Name (EN)
                  </label>
                  <input
                    type="text"
                    value={newDish.enTitle}
                    onChange={(e) =>
                      setNewDish({ ...newDish, enTitle: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Description (EN)
                  </label>
                  <textarea
                    rows={2}
                    value={newDish.enDescription}
                    onChange={(e) =>
                      setNewDish({ ...newDish, enDescription: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Nom (FR)
                  </label>
                  <input
                    type="text"
                    value={newDish.frTitle}
                    onChange={(e) =>
                      setNewDish({ ...newDish, frTitle: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Description (FR)
                  </label>
                  <textarea
                    rows={2}
                    value={newDish.frDescription}
                    onChange={(e) =>
                      setNewDish({ ...newDish, frDescription: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    الاسم (AR)
                  </label>
                  <input
                    type="text"
                    value={newDish.arTitle}
                    onChange={(e) =>
                      setNewDish({ ...newDish, arTitle: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-orange-500"
                    dir="auto"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    الوصف (AR)
                  </label>
                  <textarea
                    rows={2}
                    value={newDish.arDescription}
                    onChange={(e) =>
                      setNewDish({ ...newDish, arDescription: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none text-right focus:outline-none focus:border-orange-500"
                    dir="auto"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    الاسم (MA)
                  </label>
                  <input
                    type="text"
                    value={newDish.maTitle}
                    onChange={(e) =>
                      setNewDish({ ...newDish, maTitle: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-orange-500"
                    dir="auto"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    الوصف (MA)
                  </label>
                  <textarea
                    rows={2}
                    value={newDish.maDescription}
                    onChange={(e) =>
                      setNewDish({ ...newDish, maDescription: e.target.value })
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none text-right focus:outline-none focus:border-orange-500"
                    dir="auto"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-3 transition-colors"
              >
                {editingDishId ? "保存修改" : "确认添加菜品"}
              </button>
              {editingDishId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  取消
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </>
  );
}
