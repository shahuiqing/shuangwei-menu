import type { FormEvent } from "react";
import { Flame, List } from "lucide-react";
import type { Promotion } from "../../types/menu";

export interface NewPromotionDraft {
  title: string;
  enTitle: string;
  frTitle: string;
  arTitle: string;
  maTitle: string;
  description: string;
  enDescription: string;
  frDescription: string;
  arDescription: string;
  maDescription: string;
  image: string;
}

export function PromotionsTab({
  newPromotion,
  onNewPromotionChange,
  onAddPromotion,
  promotions,
  setPromotions,
  onRemovePromotion,
}: {
  newPromotion: NewPromotionDraft;
  onNewPromotionChange: (value: NewPromotionDraft) => void;
  onAddPromotion: (e: FormEvent) => void;
  promotions?: Promotion[];
  setPromotions?: (promotions: Promotion[]) => void;
  onRemovePromotion: (id: string) => void;
}) {
  return (
    <>
      <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Flame size={20} className="text-orange-500" /> 添加新活动 (Add
          Promotion)
        </h3>
        <form onSubmit={onAddPromotion} className="space-y-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newPromotion.title}
              onChange={(e) =>
                onNewPromotionChange({
                  ...newPromotion,
                  title: e.target.value,
                })
              }
              placeholder="活动标题 (中文) / Promotion Title"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              required
            />
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl px-4 py-2.5 transition-colors text-sm"
            >
              添加活动
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                图片 URL / Image URL
              </label>
              <input
                type="text"
                value={newPromotion.image}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
                    image: e.target.value,
                  })
                }
                placeholder="活动图片 (必填)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                描述 (中)
              </label>
              <textarea
                value={newPromotion.description}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
                    description: e.target.value,
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                rows={2}
              />
            </div>
            <div className="col-span-1 md:col-span-2 text-xs text-zinc-500 italic mt-2 border-t border-zinc-800 pt-2">
              多语版本 (Multi-language) - 如果为空将在界面中降级显示
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Title (EN)
              </label>
              <input
                type="text"
                value={newPromotion.enTitle}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
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
                value={newPromotion.enDescription}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
                    enDescription: e.target.value,
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                rows={1}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Titre (FR)
              </label>
              <input
                type="text"
                value={newPromotion.frTitle}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
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
                value={newPromotion.frDescription}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
                    frDescription: e.target.value,
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none"
                rows={1}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                عنوان (AR)
              </label>
              <input
                type="text"
                value={newPromotion.arTitle}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
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
                value={newPromotion.arDescription}
                onChange={(e) =>
                  onNewPromotionChange({
                    ...newPromotion,
                    arDescription: e.target.value,
                  })
                }
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white resize-none text-right"
                dir="auto"
                rows={1}
              />
            </div>
          </div>
        </form>
      </div>

      {promotions && promotions.length > 0 && (
        <div className="mb-6 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <List size={20} className="text-orange-500" /> 现有活动 (Current
            Promotions)
          </h3>
          <div className="space-y-3">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800"
              >
                {promo.image && (
                  <img
                    src={promo.image}
                    alt="promo"
                    className="w-24 h-16 object-cover rounded-md"
                  />
                )}
                <div className="flex-1 text-sm text-white font-medium">
                  <div>{promo.title}</div>
                  <div className="text-xs text-zinc-500 truncate max-w-[200px]">
                    {promo.description}
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={() => {
                      const newList = promotions.map((p) =>
                        p.id === promo.id ? { ...p, isActive: !p.isActive } : p,
                      );
                      if (setPromotions) setPromotions(newList);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${promo.isActive ? "bg-green-900/30 text-green-400 border-green-500/30" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                  >
                    {promo.isActive ? "可见 (Active)" : "隐藏 (Hidden)"}
                  </button>
                  <button
                    onClick={() => onRemovePromotion(promo.id)}
                    className="px-3 py-1.5 bg-zinc-800 text-red-400 hover:bg-red-900/30 border border-zinc-700 hover:border-red-500/30 rounded-lg text-xs font-bold transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
