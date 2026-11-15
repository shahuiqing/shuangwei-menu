import {
  Languages,
  Ruler,
  TrendingUp,
  TrendingDown,
  X,
  History,
} from "lucide-react";
import { num, type InventoryItem } from "../../lib/inventory";
import { fmtDateTime, fmtMoney } from "../../lib/format";
import { SAMPLE_MIN } from "../../lib/priceAlert";
import {
  sameUnit,
  signedPct,
  type ReviewCheck,
  type ReviewRow,
} from "./helpers";

export function AiReviewRowCard({
  row,
  inv,
  check,
  onPatch,
  onRemove,
}: {
  row: ReviewRow;
  inv: InventoryItem[];
  check: ReviewCheck;
  onPatch: (patch: Partial<ReviewRow>) => void;
  onRemove: () => void;
}) {
  const item = row.itemId ? inv.find((i) => i.id === row.itemId) : undefined;
  const { unit, mismatch, factor, history } = check;
  const amount = num(row.quantity) * num(row.unitPrice);
  const displayName = item?.name || row.name || "未命名原料";
  const headerSource =
    item && row.sourceName && row.sourceName !== item.name
      ? row.sourceName
      : "";
  const headerZh =
    item && row.nameZh && row.nameZh !== item.name ? row.nameZh : "";
  const sourceLine = [
    headerSource ? `原文 ${headerSource}` : "",
    headerZh ? `译名 ${headerZh}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const priceFlagged = history?.level === "high" || history?.level === "warn";
  const priceRising = (history?.changePct || 0) >= 0;
  const priceLabel =
    history?.level === "high"
      ? `价格异常 ${signedPct(history.changePct)}`
      : history?.level === "warn"
        ? `价格${priceRising ? "偏高" : "偏低"} ${signedPct(history.changePct)}`
        : "";
  const inputCls =
    "w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-orange-500";

  return (
    <div
      className={`rounded-xl border p-3 transition-opacity ${
        row.included
          ? "border-white/10 bg-zinc-950/60"
          : "border-white/5 bg-zinc-950/30 opacity-55"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <label className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={row.included}
            onChange={(e) => onPatch({ included: e.target.checked })}
          />
          <div className="min-w-0">
            <span className="block text-sm text-zinc-200 truncate">
              {displayName}
            </span>
            {sourceLine && (
              <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-zinc-500">
                <Languages size={10} className="shrink-0" />
                <span className="truncate">{sourceLine}</span>
              </span>
            )}
          </div>
          {item ? (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
              已匹配 {Math.round(row.matchScore * 100)}%
            </span>
          ) : (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
              新原料
            </span>
          )}
          {mismatch && (
            <span
              className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                factor > 0
                  ? "bg-sky-500/10 text-sky-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              <Ruler size={10} />
              {factor > 0 ? "单位可换算" : "单位不匹配"}
            </span>
          )}
          {priceFlagged && (
            <span
              className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                history!.level === "high"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-amber-500/10 text-amber-400"
              }`}
            >
              {priceRising ? (
                <TrendingUp size={10} />
              ) : (
                <TrendingDown size={10} />
              )}
              {priceLabel}
            </span>
          )}
        </label>
        <button
          onClick={onRemove}
          aria-label="移除该项"
          className="shrink-0 text-zinc-500 hover:text-red-400"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5">
        <label className="col-span-2 text-[11px] text-zinc-500">
          入库原料
          <select
            value={row.itemId || "__new__"}
            onChange={(e) => {
              const itemId = e.target.value === "__new__" ? "" : e.target.value;
              const target = inv.find((i) => i.id === itemId);
              const current = row.unit.trim();
              onPatch({
                itemId,
                unit: target
                  ? current && !sameUnit(current, target.unit)
                    ? current
                    : target.unit
                  : current,
              });
            }}
            className={inputCls}
          >
            <option value="__new__">新原料（保存时自动创建）</option>
            {inv.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}（库存 {num(i.stock)}
                {i.unit}）
              </option>
            ))}
          </select>
        </label>

        {!row.itemId && (
          <div className="col-span-2">
            <label className="block text-[11px] text-zinc-500">
              原料名称
              <input
                value={row.name}
                onChange={(e) => onPatch({ name: e.target.value })}
                className={inputCls}
              />
            </label>
            {row.nameZh && row.nameZh !== row.name && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
                <Languages size={11} className="shrink-0" />
                <span className="min-w-0 truncate">
                  中文译名 <span className="text-zinc-300">{row.nameZh}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onPatch({ name: row.nameZh })}
                  className="ml-auto shrink-0 text-sky-400 hover:text-sky-300"
                >
                  采用
                </button>
              </div>
            )}
            {row.sourceName && row.name !== row.sourceName && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-600">
                <span className="min-w-0 truncate">
                  票据原文 {row.sourceName}
                </span>
              </div>
            )}
          </div>
        )}

        <label className="text-[11px] text-zinc-500">
          数量
          <input
            type="number"
            inputMode="decimal"
            value={row.quantity}
            onChange={(e) => onPatch({ quantity: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          单位
          <input
            value={row.unit}
            onChange={(e) => onPatch({ unit: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-[11px] text-zinc-500">
          单价
          <input
            type="number"
            inputMode="decimal"
            value={row.unitPrice}
            onChange={(e) => onPatch({ unitPrice: e.target.value })}
            className={inputCls}
          />
        </label>
        <div className="text-[11px] text-zinc-500">
          金额
          <div className="mt-1 h-[38px] flex items-center justify-end tnum text-sm text-orange-400 font-semibold">
            {fmtMoney(amount)}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed">
        <History size={12} className="mt-0.5 shrink-0 text-zinc-500" />
        {!item ? (
          <span className="text-zinc-500">
            新原料 · 暂无历史采购价，入库后将作为首笔历史
          </span>
        ) : mismatch && factor <= 0 ? (
          <span className="text-red-400">
            单位不匹配，暂无法折算并与历史采购价比较
          </span>
        ) : !history ? (
          <span className="text-zinc-500">暂无历史采购价</span>
        ) : (
          <span className="min-w-0 text-zinc-500">
            历史中位{" "}
            <span className="text-zinc-300 tnum">
              {fmtMoney(history.median)}/{item.unit}
            </span>
            <span className="text-zinc-600">（{history.sampleCount} 笔）</span>
            {history.lastAt && (
              <>
                {" "}
                · 最近{" "}
                <span className="text-zinc-400 tnum">
                  {fmtMoney(history.last)}
                </span>{" "}
                <span className="text-zinc-600">
                  {fmtDateTime(history.lastAt)}
                </span>
              </>
            )}
            {history.sampleCount < SAMPLE_MIN ? (
              <span className="block text-zinc-500 mt-0.5">
                样本不足 {SAMPLE_MIN} 笔，暂不判定价格异常
              </span>
            ) : (
              <span className="block mt-0.5">
                本次折合{" "}
                <span className="text-zinc-300 tnum">
                  {fmtMoney(check.basePrice)}/{item.unit}
                </span>
                ，较中位{" "}
                <span
                  className={
                    history.level === "high"
                      ? "text-red-400"
                      : history.level === "warn"
                        ? "text-amber-400"
                        : "text-green-400"
                  }
                >
                  {signedPct(history.changePct)}
                </span>
              </span>
            )}
          </span>
        )}
      </div>

      {mismatch && (
        <div className="mt-2 text-[11px] leading-relaxed">
          {factor > 0 ? (
            <button
              onClick={() =>
                onPatch({
                  quantity: String(
                    Number((num(row.quantity) * factor).toFixed(3)),
                  ),
                  unit: item!.unit,
                  unitPrice: String(
                    Number((num(row.unitPrice) / factor).toFixed(2)),
                  ),
                })
              }
              className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
            >
              票据单位 {unit} ≠ 库存单位 {item!.unit}，按 1{unit}={factor}
              {item!.unit} 换算
            </button>
          ) : (
            <span className="text-red-400">
              单位不一致：票据 {unit} / 库存 {item!.unit}
              ，请手工换算数量，或改为新原料
            </span>
          )}
        </div>
      )}
    </div>
  );
}
