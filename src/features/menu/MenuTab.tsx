import type { FormEvent, ChangeEvent } from "react";
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
  Database,
} from "lucide-react";
import { compressImage } from "../../utils/image";
import { uploadBase64ToStorage } from "../../utils/storage";
import type {
  MenuCategory,
  Promotion,
  ReceiptSettings,
} from "../../types/menu";

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
  handleDeleteCategory: (idToRemove: string) => void;
  handleDeleteDish: (categoryId: string, dishId: string) => void;
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
  handleApiKeyChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setCurrency: (v: string) => void;
  setIsUploading: (v: boolean) => void;
  setUploadingItemId: (v: string | null) => void;
  setPromptDialog: (v: any) => void;
  setPromptValue: (v: string) => void;
  setSelectedCategory: (v: string) => void;
  setSortingCategoryId: (v: string | null) => void;
  currency: string;
  restaurantName: string;
  welcomeMessage: string;
  bgUrl: string;
  logoUrl: string;
  layoutStyle: string;
  theme: string;
  soundEnabled: boolean;
  receiptSettings: ReceiptSettings;
  promotions: Promotion[];
  setPromotions?: (p: Promotion[]) => void;
  deletedItemIds?: string[];
  setDeletedItemIds?: (ids: string[]) => void;
  setRestaurantName?: (v: string) => void;
  setWelcomeMessage?: (v: string) => void;
  setBgUrl?: (v: string) => void;
  setLogoUrl?: (v: string) => void;
  setLayoutStyle?: (v: "grid" | "list" | "bento") => void;
  setTheme?: (v: "midnight" | "light") => void;
  setSoundEnabled?: (v: boolean) => void;
  isUploading: boolean;
  promptValue: string;
  promptDialog: any;
  uploadingItemId: string | null;
  selectedCategory: string;
  sortingCategoryId: string | null;
  isOptimizing: boolean;
  optimizationProgress: string;
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
    handleDeleteCategory,
    handleDeleteDish,
    handleMoveCategory,
    handleMoveDish,
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
    setSortingCategoryId,
    currency,
    isUploading,
    uploadingItemId,
    selectedCategory,
    onSaveToCloud,
    isTranslating,
    isEnhancing,
  } = props;
  return (
    <>
      <>
        {/* Category Management */}
        <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings size={20} className="text-orange-500" />{" "}
              现有分类与菜品管理 (Manage Categories & Dishes)
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-orange-500 text-zinc-300 hover:text-orange-500 rounded-xl text-xs font-semibold transition-colors active:scale-95"
              >
                <DownloadCloud size={16} className="text-orange-400" />
                <span>导出 JSON 备份</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-green-500 text-zinc-300 hover:text-green-500 rounded-xl text-xs font-semibold transition-colors active:scale-95"
              >
                <FileSpreadsheet size={16} className="text-green-400" />
                <span>导出 Excel/CSV</span>
              </button>
            </div>
          </div>
          <form
            onSubmit={handleAddCategory}
            className="flex flex-col gap-2 mb-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    name: e.target.value,
                  })
                }
                placeholder="分类名称 (ZH)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                required
              />
              <input
                type="text"
                value={newCategory.enName}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    enName: e.target.value,
                  })
                }
                placeholder="Name (EN)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.frName}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    frName: e.target.value,
                  })
                }
                placeholder="Nom (FR)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.arName}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    arName: e.target.value,
                  })
                }
                placeholder="الاسم (AR)"
                dir="auto"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white text-right focus:outline-none focus:border-orange-500"
              />
              <input
                type="text"
                value={newCategory.maName}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    maName: e.target.value,
                  })
                }
                placeholder="الاسم (MA - Darija)"
                dir="auto"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white text-right focus:outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm border border-zinc-700 self-end"
            >
              添加多语分类 / Add Multi-Lang Category
            </button>
          </form>
          {categories.length > 0 && (
            <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {categories.map((cat, catIdx) => (
                <div
                  key={cat.id}
                  className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden"
                >
                  <div className="flex items-center justify-between p-3 bg-zinc-900 border-b border-zinc-800 flex-wrap gap-2">
                    <span className="text-sm text-zinc-300 font-medium">
                      {cat.name}{" "}
                      <span className="text-zinc-600 text-xs ml-1">
                        ({cat.items?.length || 0} 道菜)
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        disabled={catIdx === 0}
                        onClick={() => handleMoveCategory(catIdx, "up")}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors"
                        title="分类上移 (Move Category Up)"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={catIdx === categories.length - 1}
                        onClick={() => handleMoveCategory(catIdx, "down")}
                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors"
                        title="分类下移 (Move Category Down)"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortingCategoryId(cat.id)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-md transition-colors border border-amber-500/20 font-medium"
                        title="菜品排序调整 (Reorder Dishes)"
                      >
                        <ArrowUpDown size={13} /> 菜品排序
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition-colors"
                        title="Delete category"
                      >
                        <Trash2 size={14} /> 删除分类
                      </button>
                    </div>
                  </div>
                  {cat.items && cat.items.length > 0 && (
                    <div className="p-2 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {(cat.items || []).map((item: any, itemIdx: number) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-zinc-950/50 rounded-lg group"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button
                                type="button"
                                disabled={itemIdx === 0}
                                onClick={() =>
                                  handleMoveDish(cat.id, itemIdx, "up")
                                }
                                className="p-1 text-zinc-400 hover:text-amber-400 disabled:opacity-20 hover:bg-zinc-800 rounded transition-colors"
                                title="菜品上移"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  itemIdx === (cat.items || []).length - 1
                                }
                                onClick={() =>
                                  handleMoveDish(cat.id, itemIdx, "down")
                                }
                                className="p-1 text-zinc-400 hover:text-amber-400 disabled:opacity-20 hover:bg-zinc-800 rounded transition-colors"
                                title="菜品下移"
                              >
                                <ArrowDown size={12} />
                              </button>
                            </div>
                            <label
                              htmlFor={`upload-item-${item.id}`}
                              className="cursor-pointer relative flex flex-shrink-0 w-10 h-10 group/img"
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
                                  if (file) {
                                    try {
                                      setUploadingItemId(item.id);
                                      const compressed =
                                        await compressImage(file);
                                      const finalUrl =
                                        await uploadBase64ToStorage(
                                          compressed,
                                          "dishes",
                                        );
                                      const updatedCategories = categories.map(
                                        (c) => {
                                          if (c.id === cat.id) {
                                            return {
                                              ...c,
                                              items: (c.items || []).map(
                                                (i: any) =>
                                                  i.id === item.id
                                                    ? {
                                                        ...i,
                                                        image: finalUrl,
                                                      }
                                                    : i,
                                              ),
                                            };
                                          }
                                          return c;
                                        },
                                      );
                                      setCategories(updatedCategories);
                                      if (onSaveToCloud)
                                        onSaveToCloud({
                                          categories: updatedCategories,
                                          silent: true,
                                        });
                                    } catch (err: any) {
                                      console.error(
                                        "Image upload failed:",
                                        err,
                                      );
                                      alert(
                                        "上传失败 (Upload failed): " +
                                          (err.message || "unknown error"),
                                      );
                                    } finally {
                                      setUploadingItemId(null);
                                    }
                                  }
                                  e.target.value = ""; // Reset
                                }}
                              />
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  className="w-10 h-10 rounded-md object-cover bg-zinc-800"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-500">
                                  {uploadingItemId !== item.id && (
                                    <UploadCloud size={16} />
                                  )}
                                </div>
                              )}
                            </label>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-zinc-300 truncate">
                                {item.title}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {item.stock !== undefined && item.stock !== null
                                  ? `库存: ${item.stock} 份`
                                  : "库存: 无限制"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                            <button
                              onClick={() => {
                                const updatedCategories = categories.map(
                                  (c) => {
                                    if (c.id === cat.id) {
                                      return {
                                        ...c,
                                        items: (c.items || []).map((i: any) =>
                                          i.id === item.id
                                            ? { ...i, isSoldOut: !i.isSoldOut }
                                            : i,
                                        ),
                                      };
                                    }
                                    return c;
                                  },
                                );
                                setCategories(updatedCategories);
                                if (onSaveToCloud)
                                  onSaveToCloud({
                                    categories: updatedCategories,
                                    silent: true,
                                  });
                              }}
                              className={`flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border rounded-md transition-colors flex-shrink-0 ${
                                item.isSoldOut
                                  ? "border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-white"
                                  : "border-zinc-500/30 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                              }`}
                              title={
                                item.isSoldOut
                                  ? "标记为在售 (Mark as available)"
                                  : "标记为售罄 (Mark as sold out)"
                              }
                            >
                              {item.isSoldOut ? "已售罄" : "售罄"}
                            </button>
                            <button
                              onClick={() => {
                                setPromptValue(item.price);
                                setPromptDialog({
                                  isOpen: true,
                                  message: `修改 ${item.title} 的价格 / Edit price:`,
                                  defaultValue: item.price,
                                  onConfirm: (newPrice: string) => {
                                    if (newPrice.trim() !== "") {
                                      const updatedCategories = categories.map(
                                        (c) => {
                                          if (c.id === cat.id) {
                                            return {
                                              ...c,
                                              items: (c.items || []).map(
                                                (i: any) =>
                                                  i.id === item.id
                                                    ? {
                                                        ...i,
                                                        price: newPrice.trim(),
                                                      }
                                                    : i,
                                              ),
                                            };
                                          }
                                          return c;
                                        },
                                      );
                                      setCategories(updatedCategories);
                                      if (onSaveToCloud)
                                        onSaveToCloud({
                                          categories: updatedCategories,
                                          silent: true,
                                        });
                                    }
                                    setPromptDialog(null);
                                  },
                                });
                              }}
                              className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white rounded-md transition-colors flex-shrink-0"
                              title="Edit price"
                            >
                              <Edit2 size={14} /> 改价
                            </button>
                            <button
                              onClick={() => {
                                const currentStock =
                                  item.stock !== undefined &&
                                  item.stock !== null
                                    ? String(item.stock)
                                    : "";
                                setPromptValue(currentStock);
                                setPromptDialog({
                                  isOpen: true,
                                  message: `修改 ${item.title} 的库存数量 (留空为无限制) / Edit stock quantity:`,
                                  defaultValue: currentStock,
                                  onConfirm: (newStock: string) => {
                                    const stockVal =
                                      newStock.trim() === ""
                                        ? null
                                        : Number(newStock.trim());
                                    const updatedCategories = categories.map(
                                      (c) => {
                                        if (c.id === cat.id) {
                                          return {
                                            ...c,
                                            items: (c.items || []).map(
                                              (i: any) =>
                                                i.id === item.id
                                                  ? {
                                                      ...i,
                                                      stock: isNaN(
                                                        Number(stockVal),
                                                      )
                                                        ? null
                                                        : stockVal,
                                                      isSoldOut:
                                                        stockVal === 0
                                                          ? true
                                                          : i.isSoldOut,
                                                    }
                                                  : i,
                                            ),
                                          };
                                        }
                                        return c;
                                      },
                                    );
                                    setCategories(updatedCategories);
                                    if (onSaveToCloud)
                                      onSaveToCloud({
                                        categories: updatedCategories,
                                        silent: true,
                                      });
                                    setPromptDialog(null);
                                  },
                                });
                              }}
                              className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-md transition-colors flex-shrink-0"
                              title="Edit stock"
                            >
                              <Database size={14} /> 改库存
                            </button>
                            <button
                              onClick={() => handleDeleteDish(cat.id, item.id)}
                              className="flex items-center gap-1 text-[10px] sm:text-xs px-2 py-1.5 bg-zinc-900 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition-colors flex-shrink-0"
                              title="Delete dish"
                            >
                              <Trash2 size={14} /> 删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </>
      <>
        {/* Add Dish Settings */}
        <form
          onSubmit={handleAddDish}
          className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Plus size={20} className="text-orange-500" /> 添加新菜品
            </h3>
            <button
              type="button"
              onClick={handleAITranslate}
              disabled={isTranslating}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-orange-500 hover:text-orange-400 rounded-lg transition-colors text-zinc-300 disabled:opacity-50"
            >
              {isTranslating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              一键 AI 翻译
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                选择分类
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  图片 URL 或 上传本地图片 *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    required
                    type="text"
                    value={newDish.image}
                    onChange={(e) =>
                      setNewDish({
                        ...newDish,
                        image: e.target.value,
                      })
                    }
                    placeholder="输入图片 URL 或点击右侧上传"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
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
                    AI 一键美化图片 (统一菜单风格)
                  </button>
                )}
                {newDish.image && (
                  <div className="mt-3 relative w-full h-40 sm:h-48 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 group">
                    <img
                      src={newDish.image}
                      alt="Preview"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-3 pointer-events-none">
                      <span className="text-[10px] sm:text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                        <ImageIcon size={14} /> 实时外观预览 (Preview)
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  价格 *
                </label>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="28"
                    value={newDish.price}
                    onChange={(e) =>
                      setNewDish({
                        ...newDish,
                        price: e.target.value,
                      })
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-24 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="MAD">MAD (迪拉姆)</option>
                    <option value="€">€</option>
                    <option value="$">$</option>
                    <option value="¥">¥</option>
                    <option value="£">£</option>
                    <option value="none">无标志</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  库存数量 (留空为无限制) / Stock Limit
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="例如：50"
                  value={newDish.stock}
                  onChange={(e) =>
                    setNewDish({
                      ...newDish,
                      stock: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  过敏原信息 / Allergens
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map((allergen) => {
                    const isSelected = newDish.allergens.includes(allergen.id);
                    return (
                      <button
                        type="button"
                        key={allergen.id}
                        onClick={() => {
                          setNewDish((prev: any) => ({
                            ...prev,
                            allergens: isSelected
                              ? prev.allergens.filter(
                                  (a: any) => a !== allergen.id,
                                )
                              : [...prev.allergens, allergen.id],
                          }));
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

              <div className="col-span-2 mt-2 border-t border-zinc-800 pt-2 text-xs font-bold text-zinc-500">
                多语言内容 / Multi-language Content
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  菜品名称 (中) *
                </label>
                <input
                  required
                  type="text"
                  value={newDish.title}
                  onChange={(e) =>
                    setNewDish({ ...newDish, title: e.target.value })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  描述 (中)
                </label>
                <textarea
                  rows={2}
                  value={newDish.description}
                  onChange={(e) =>
                    setNewDish({
                      ...newDish,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Name (EN)
                </label>
                <input
                  type="text"
                  value={newDish.enTitle}
                  onChange={(e) =>
                    setNewDish({
                      ...newDish,
                      enTitle: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
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
                    setNewDish({
                      ...newDish,
                      enDescription: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
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
                    setNewDish({
                      ...newDish,
                      frTitle: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
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
                    setNewDish({
                      ...newDish,
                      frDescription: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
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
                    setNewDish({
                      ...newDish,
                      arTitle: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white text-right"
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
                    setNewDish({
                      ...newDish,
                      arDescription: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none text-right"
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
                    setNewDish({
                      ...newDish,
                      maTitle: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white text-right"
                  dir="auto"
                  placeholder="Moroccan Arabic (Darija)"
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
                    setNewDish({
                      ...newDish,
                      maDescription: e.target.value,
                    })
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none text-right"
                  dir="auto"
                  placeholder="Moroccan Arabic (Darija)"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl px-4 py-3 transition-colors mt-4"
            >
              确认添加菜品
            </button>
          </div>
        </form>
      </>
    </>
  );
}
