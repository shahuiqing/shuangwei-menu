import { useMemo } from "react";
import { ChartCard, EmptyState, SkeletonRows } from "../../components/ui";
import { fmtDateTime, fmtMoney } from "../../lib/format";
import { num } from "../../lib/inventory";
import type { PurchaseOrder } from "../../lib/inventory";

/** 采购记录列表（手机卡片 + 桌面表格） */
export default function PurchaseRecordsCard({
  list,
  loading,
  q,
}: {
  list: PurchaseOrder[];
  loading: boolean;
  q: string;
}) {
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (p) =>
        String(p.item_name || "")
          .toLowerCase()
          .includes(needle) ||
        String(p.supplier || "")
          .toLowerCase()
          .includes(needle),
    );
  }, [list, q]);

  return (
    <ChartCard title="采购记录" subtitle={`共 ${filtered.length} 笔`}>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState text="暂无采购记录" />
      ) : (
        <>
          <div className="sm:hidden space-y-2.5">
            {filtered.map((p) => (
              <div key={p.id} className="card-surface p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {p.item_name}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      {p.supplier || "-"} ·{" "}
                      {fmtDateTime(p.purchased_at || p.created_at)}
                    </div>
                  </div>
                  <span className="shrink-0 text-orange-400 font-semibold tnum">
                    {fmtMoney(p.total_cost)}
                  </span>
                </div>
                <div className="flex items-center gap-x-3 mt-1.5 text-xs text-zinc-400">
                  <span>
                    {num(p.quantity)} {p.unit}
                  </span>
                  <span>单价 {fmtMoney(p.unit_price)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-left border-b border-white/5">
                  <th className="px-3 py-2 font-medium">时间</th>
                  <th className="px-3 py-2 font-medium">供应商</th>
                  <th className="px-3 py-2 font-medium">原料</th>
                  <th className="px-3 py-2 font-medium text-right">数量</th>
                  <th className="px-3 py-2 font-medium text-right">单价</th>
                  <th className="px-3 py-2 font-medium text-right">金额</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="px-3 py-2.5 text-zinc-400">
                      {fmtDateTime(p.purchased_at || p.created_at)}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">
                      {p.supplier || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-white">{p.item_name}</td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {num(p.quantity)} {p.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-zinc-300">
                      {fmtMoney(p.unit_price)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-orange-400 font-semibold">
                      {fmtMoney(p.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ChartCard>
  );
}
