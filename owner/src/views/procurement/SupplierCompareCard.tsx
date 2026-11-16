import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { ChartCard } from "../../components/ui";
import { fmtDateTime, fmtMoney } from "../../lib/format";
import {
  rivalItems,
  supplierCompare,
  compareInsight,
} from "../../lib/supplierCompare";
import type { PurchaseOrder } from "../../lib/inventory";

/** 供应商比价：同一原料各供应商的加权均价、中位价与金额份额 */
export default function SupplierCompareCard({
  list,
}: {
  list: PurchaseOrder[];
}) {
  const rivals = useMemo(() => rivalItems(list), [list]);
  const [cmpId, setCmpId] = useState("");
  const activeId = rivals.some((r) => r.itemId === cmpId)
    ? cmpId
    : rivals[0]?.itemId || "";
  const cmpStats = useMemo(
    () => (activeId ? supplierCompare(list, activeId) : []),
    [list, activeId],
  );
  const insight = useMemo(() => compareInsight(cmpStats), [cmpStats]);

  return (
    <ChartCard
      title="供应商比价"
      subtitle="同一原料各供应商的加权均价、单价中位数与金额份额"
      action={<Scale size={18} className="text-teal-400" />}
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <select
          value={activeId}
          onChange={(e) => setCmpId(e.target.value)}
          className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
        >
          {rivals.map((r) => (
            <option key={r.itemId} value={r.itemId}>
              {r.itemName}（{r.suppliers} 家 · {r.count} 笔）
            </option>
          ))}
        </select>
        {insight && (
          <span className="text-xs text-zinc-400">
            换到 <b className="text-emerald-400">{insight.best.supplier}</b>，
            每单位省{" "}
            <b className="text-emerald-400">{fmtMoney(insight.savePerUnit)}</b>
            （约 {Math.round(insight.savePct * 100)}%，一次可省{" "}
            {fmtMoney(insight.savePerBuy)}）
          </span>
        )}
      </div>
      <div className="sm:hidden space-y-2.5">
        {cmpStats.map((s) => (
          <div key={s.supplier} className="card-surface p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white font-medium truncate">
                  {s.supplier}
                </span>
                {s.level !== "mid" && (
                  <span
                    className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                      s.level === "best"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {s.level === "best" ? "最低" : "最高"}
                  </span>
                )}
              </div>
              <span
                className={`shrink-0 font-semibold tnum ${
                  s.level === "best"
                    ? "text-emerald-400"
                    : s.level === "worst"
                      ? "text-red-400"
                      : "text-zinc-200"
                }`}
              >
                {fmtMoney(s.avg)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-500">
              <span>中位 {fmtMoney(s.medianUnit)}</span>
              <span>{s.count} 笔</span>
              <span>占比 {Math.round(s.share * 100)}%</span>
              <span>
                最近 {s.lastAt ? fmtDateTime(s.lastAt).slice(0, 10) : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-left border-b border-white/5">
              <th className="px-3 py-2 font-medium">供应商</th>
              <th className="px-3 py-2 font-medium text-right">加权均价</th>
              <th className="px-3 py-2 font-medium text-right">中位单价</th>
              <th className="px-3 py-2 font-medium text-right">笔数</th>
              <th className="px-3 py-2 font-medium text-right">金额占比</th>
              <th className="px-3 py-2 font-medium text-right">最近采购</th>
            </tr>
          </thead>
          <tbody>
            {cmpStats.map((s) => (
              <tr
                key={s.supplier}
                className="border-b border-zinc-800/50 last:border-0"
              >
                <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap">
                  {s.supplier}
                  {s.level !== "mid" && (
                    <span
                      className={`inline-flex ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded ${
                        s.level === "best"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {s.level === "best" ? "最低" : "最高"}
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-2.5 text-right font-semibold ${
                    s.level === "best"
                      ? "text-emerald-400"
                      : s.level === "worst"
                        ? "text-red-400"
                        : "text-zinc-200"
                  }`}
                >
                  {fmtMoney(s.avg)}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-400">
                  {fmtMoney(s.medianUnit)}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-400">
                  {s.count}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-400">
                  {Math.round(s.share * 100)}%
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-500 whitespace-nowrap">
                  {s.lastAt ? fmtDateTime(s.lastAt).slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
