import { CalendarDays } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { Segmented } from "../../components/Segmented";
import { fmtMoney } from "../../lib/format";
import { num } from "../../lib/inventory";
import {
  COVERAGE_DAYS,
  CONSUMPTION_WINDOW_DAYS,
  type PlanRow,
  type PurchasePlan,
} from "../../lib/purchasePlan";

/** 采购计划卡：安全库存 + 消耗预测合成的补货清单 */
export default function PlanCard({
  plan,
  coverage,
  onCoverage,
  bulk,
  onBulkBuy,
  approvedCount,
  onPick,
}: {
  plan: PurchasePlan;
  coverage: number;
  onCoverage: (days: number) => void;
  bulk: boolean;
  onBulkBuy: () => void;
  approvedCount: number;
  onPick: (r: PlanRow) => void;
}) {
  return (
    <ChartCard
      title="采购计划"
      subtitle={`安全库存 + 近 ${CONSUMPTION_WINDOW_DAYS} 天日均消耗 × ${plan.coverageDays} 天 − 现存${
        approvedCount > 0 ? ` · 已并入 ${approvedCount} 条员工申报` : ""
      }`}
      action={<CalendarDays size={18} className="text-amber-400" />}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Segmented
          size="sm"
          value={String(coverage)}
          options={COVERAGE_DAYS.map((d) => [String(d), `${d} 天`] as const)}
          onChange={(v) => onCoverage(Number(v))}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-300">
            合计约 <b className="text-amber-400">{fmtMoney(plan.totalCost)}</b>
          </span>
          <button
            onClick={onBulkBuy}
            disabled={bulk}
            className="px-3.5 py-1.5 rounded-lg btn-brand text-white text-xs font-semibold disabled:opacity-60"
          >
            {bulk ? "下单中…" : `一键采购 ${plan.rows.length} 项`}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        {plan.rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="text-zinc-200">{r.name}</span>
              {r.priority !== "normal" && (
                <span
                  className={`inline-flex ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded ${
                    r.priority === "urgent"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {r.priority === "urgent" ? "缺货" : "低于安全"}
                </span>
              )}
              {!!r.requestQty && (
                <span className="inline-flex ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">
                  员工申报 {num(r.requestQty)}
                  {r.unit}
                  {r.requestStaff?.length
                    ? ` · ${r.requestStaff.join("、")}`
                    : ""}
                  {r.requestUrgent ? " 🔥" : ""}
                </span>
              )}
              <div className="text-zinc-500 text-xs mt-0.5">
                现存 {num(r.stock)}
                {r.unit} · 日均 {num(r.dailyAvg)}
                {r.unit}
                {r.daysLeft !== null && ` · 可撑 ${r.daysLeft} 天`}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-zinc-400 text-xs text-right">
                补 {num(r.gap)}
                {r.unit} · 约 {fmtMoney(r.estCost)}
                <span className="block text-zinc-500 text-[10px]">
                  {r.reason}
                </span>
              </span>
              <button
                onClick={() => onPick(r)}
                className="px-3 py-1.5 rounded-lg btn-brand text-white text-xs font-semibold"
              >
                采购
              </button>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
