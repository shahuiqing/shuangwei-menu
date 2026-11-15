import { fmtMoney } from "../../lib/format";
import type { PriceAlert } from "../../lib/priceAlert";
import { Spark } from "./Spark";

/** 价格异常行：等级色条 + 走势 + 幅度 */
export function PriceAlertRow({ alert: a }: { alert: PriceAlert }) {
  const up = a.changePct > 0;
  const severe = a.level === "high";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 border-l-4 ${
        severe
          ? "border-l-red-500 bg-red-500/[0.07]"
          : "border-l-amber-500 bg-amber-500/[0.07]"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm text-zinc-200 truncate">{a.itemName}</div>
        <div className="text-xs text-zinc-500">
          近 {a.sampleCount} 次 {fmtMoney(a.priceMin)}~{fmtMoney(a.priceMax)} ·
          中位 {fmtMoney(a.baseline)}/{a.unit} · {a.supplierCount} 家供应商
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Spark
          points={a.spark.map((s) => s.price)}
          className={severe ? "stroke-red-400" : "stroke-amber-400"}
        />
        <div className="text-right">
          <div
            className={`text-sm font-semibold ${
              severe ? "text-red-400" : "text-amber-400"
            }`}
          >
            {up ? "+" : ""}
            {Math.round(a.changePct * 100)}%
          </div>
          <div className="text-xs text-zinc-500">现 {fmtMoney(a.current)}</div>
        </div>
      </div>
    </div>
  );
}
