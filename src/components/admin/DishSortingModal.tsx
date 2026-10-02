import {
  X,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import type { MenuCategory } from "../../types/menu";

export function DishSortingModal({
  categoryId,
  categories,
  onMoveDish,
  onClose,
}: {
  categoryId: string | null;
  categories: MenuCategory[];
  onMoveDish: (
    catId: string,
    itemIdx: number,
    direction: "up" | "down" | "top" | "bottom",
  ) => void;
  onClose: () => void;
}) {
  if (!categoryId) return null;
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowUpDown size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                调整菜品顺序 (Dish Sorting)
              </h3>
              <p className="text-xs text-zinc-400">
                分类:{" "}
                <span className="text-amber-400 font-semibold">
                  {categories.find((c) => c.id === categoryId)?.name}
                </span>{" "}
                (共{" "}
                {categories.find((c) => c.id === categoryId)?.items?.length ||
                  0}{" "}
                道菜)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Subtitle / Tip */}
        <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/10 text-[11px] text-amber-300 flex items-center justify-between">
          <span>
            💡 提示：点击 [置顶] 或 [↑/↓] 可调整菜品在手机点餐页的排列顺序
          </span>
        </div>

        {/* Dish List */}
        <div className="p-3 sm:p-4 space-y-2 overflow-y-auto custom-scrollbar flex-1">
          {(() => {
            const currentCat = categories.find((c) => c.id === categoryId);
            const items = currentCat?.items || [];
            if (items.length === 0) {
              return (
                <div className="py-8 text-center text-zinc-500 text-sm">
                  暂无菜品
                </div>
              );
            }
            return items.map((item: any, idx: number) => (
              <div
                key={item.id}
                className="p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Rank Index */}
                  <span className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-mono font-bold text-amber-400 flex-shrink-0">
                    {idx + 1}
                  </span>
                  {/* Image */}
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600 flex-shrink-0">
                      <ImageIcon size={16} />
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-white truncate">
                      {item.title}
                    </span>
                    <span className="text-xs text-amber-400/90 font-mono font-medium">
                      {item.price}
                    </span>
                  </div>
                </div>

                {/* Action buttons priority mobile */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveDish(categoryId, idx, "top")}
                    className="px-2 py-1 text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                    title="置顶 (Move to Top)"
                  >
                    置顶
                  </button>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => onMoveDish(categoryId, idx, "up")}
                    className="p-1.5 text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                    title="上移 (Move Up)"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => onMoveDish(categoryId, idx, "down")}
                    className="p-1.5 text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                    title="下移 (Move Down)"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === items.length - 1}
                    onClick={() => onMoveDish(categoryId, idx, "bottom")}
                    className="px-2 py-1 text-[11px] font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-20 rounded-lg transition-colors flex-shrink-0"
                    title="置底 (Move to Bottom)"
                  >
                    置底
                  </button>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20"
          >
            完成排序 (Done)
          </button>
        </div>
      </div>
    </div>
  );
}
