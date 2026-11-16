import {
  FileText,
  Languages,
  Ruler,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Sheet } from "../../components/Sheet";
import { fmtMoney } from "../../lib/format";
import {
  RECEIPT_DOC_LABEL,
  isNonChineseReceipt,
  hasReceiptTranslation,
  receiptLanguageLabel,
  type ReceiptDraft,
} from "../../lib/receiptAi";
import { AiReviewRowCard } from "./AiReviewRowCard";
import type { ReviewRow, ReviewCheck } from "./helpers";
import type { InventoryItem } from "../../lib/inventory";

/** AI 票据识别结果 · 人工复核弹窗 */
export default function ReceiptReviewSheet({
  open,
  draft,
  rows,
  inv,
  checks,
  flags,
  warnings,
  selectedCount,
  sum,
  aiSaving,
  onPatchRow,
  onRemoveRow,
  onDraft,
  onSave,
  onClose,
}: {
  open: boolean;
  draft: ReceiptDraft | null;
  rows: ReviewRow[];
  inv: InventoryItem[];
  checks: Map<string, ReviewCheck>;
  flags: { price: number; unit: number };
  warnings: string[];
  selectedCount: number;
  sum: number;
  aiSaving: boolean;
  onPatchRow: (key: string, patch: Partial<ReviewRow>) => void;
  onRemoveRow: (key: string) => void;
  onDraft: (patch: Partial<ReceiptDraft>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      title="AI 识别结果 · 人工复核"
      subtitle="核对无误后再入库；未勾选项不会写入"
      onClose={onClose}
      maxW="max-w-2xl"
    >
      {draft && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-sky-500/10 text-sky-400">
              <FileText size={12} />
              {RECEIPT_DOC_LABEL[draft.documentType]}
            </span>
            {isNonChineseReceipt(draft) && (
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full ${
                  hasReceiptTranslation(draft)
                    ? "bg-violet-500/10 text-violet-400"
                    : "bg-amber-500/10 text-amber-400"
                }`}
              >
                <Languages size={12} />
                {receiptLanguageLabel(draft.sourceLanguage)}票据
                {hasReceiptTranslation(draft)
                  ? " · 已附中文翻译"
                  : " · 未附翻译"}
              </span>
            )}
            <span
              className={`text-[11px] px-2 py-1 rounded-full ${
                draft.confidence >= 0.8
                  ? "bg-green-500/10 text-green-400"
                  : draft.confidence >= 0.6
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
              }`}
            >
              置信度 {Math.round(draft.confidence * 100)}%
            </span>
            {draft.invoiceNumber && (
              <span className="text-[11px] text-zinc-500">
                单号 {draft.invoiceNumber}
              </span>
            )}
            <span className="text-[11px] text-zinc-500 ml-auto">
              {selectedCount}/{rows.length} 项待入库
            </span>
          </div>

          {(flags.price > 0 || flags.unit > 0) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {flags.unit > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400">
                  <Ruler size={12} />
                  单位不匹配 {flags.unit} 项
                </span>
              )}
              {flags.price > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400">
                  <TrendingUp size={12} />
                  价格异常 {flags.price} 项
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <label className="col-span-2 text-[11px] text-zinc-500">
              供应商
              <input
                value={draft.supplier}
                onChange={(e) => onDraft({ supplier: e.target.value })}
                placeholder="未识别到，请手工补充"
                className="w-full mt-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
              {draft.supplierZh && draft.supplierZh !== draft.supplier && (
                <span className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-zinc-500">
                  <Languages size={11} className="shrink-0" />
                  <span className="truncate">
                    中文译名{" "}
                    <span className="text-zinc-300">{draft.supplierZh}</span>
                  </span>
                </span>
              )}
            </label>
            <label className="text-[11px] text-zinc-500">
              开票 / 收货日期
              <input
                type="date"
                value={draft.date}
                onChange={(e) => onDraft({ date: e.target.value })}
                className="w-full mt-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
              />
            </label>
            <div className="text-[11px] text-zinc-500">
              票面总额
              <div className="mt-1 h-[42px] flex items-center justify-end px-3 rounded-lg bg-zinc-950 border border-white/5 tnum text-orange-400 font-semibold">
                {fmtMoney(draft.total)}
              </div>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl bg-amber-500/[0.07] border border-amber-500/25 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold mb-1">
                <AlertTriangle size={13} /> 请复核
              </div>
              <ul className="space-y-0.5 text-[11px] text-amber-300/90 list-disc pl-4">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
            {rows.map((row) => {
              const check = checks.get(row.key);
              return check ? (
                <AiReviewRowCard
                  key={row.key}
                  row={row}
                  inv={inv}
                  check={check}
                  onPatch={(patch) => onPatchRow(row.key, patch)}
                  onRemove={() => onRemoveRow(row.key)}
                />
              ) : null;
            })}
            {!rows.length && (
              <div className="text-sm text-zinc-500 text-center py-8">
                识别明细已全部移除
              </div>
            )}
          </div>

          <div className="rounded-xl bg-zinc-950 border border-white/5 px-3.5 py-3 flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-400">
              合计（勾选项）
              <span className="block text-[11px] text-zinc-600">
                入库时按核对后的数量与单价计算
              </span>
            </span>
            <span className="tnum text-lg font-bold text-orange-400">
              {fmtMoney(sum)}
            </span>
          </div>

          <button
            onClick={onSave}
            disabled={aiSaving || !selectedCount}
            className="w-full py-3 rounded-xl btn-brand text-white font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Sparkles size={15} className="inline mr-1.5" />
            {aiSaving ? "入库中…" : `确认入库 ${selectedCount} 项`}
          </button>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            识别结果受图片质量影响，请核对名称、单位、数量、单价；单位与库存不一致时需先换算。
          </p>
        </div>
      )}
    </Sheet>
  );
}
