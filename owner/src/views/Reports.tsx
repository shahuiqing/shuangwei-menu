import { useMemo, useState } from "react";
import { dayKey, fmtMoney } from "../lib/format";

export default function Reports({ orders }: { orders: any[]; settings?: any }) {
  const [range, setRange] = useState<"today" | "7d" | "all">("7d");

  const rows = useMemo(() => {
    const today = dayKey(Date.now());
    const now = Date.now();
    const filtered = orders.filter((o) => {
      const k = dayKey(o.timestamp || o.created_at);
      if (range === "today") return k === today;
      if (range === "7d") {
        const t = new Date(k + "T00:00:00").getTime();
        return now - t <= 7 * 86400000;
      }
      return true;
    });

    const map = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    filtered.forEach((o) =>
      (o.items || []).forEach((it: any) => {
        const name = it?.name || it?.title || "未知";
        const qty = Number(it?.quantity || it?.count || 1);
        const rev = Number(it?.price || 0) * qty;
        const e = map.get(name) || { name, qty: 0, revenue: 0 };
        e.qty += qty;
        e.revenue += rev;
        map.set(name, e);
      }),
    );
    const list = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const total = list.reduce((s, r) => s + r.revenue, 0);
    return { list, total };
  }, [orders, range]);

  const maxRev = Math.max(1, ...rows.list.map((r) => r.revenue));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          {(
            [
              ["today", "今天"],
              ["7d", "近7天"],
              ["all", "全部"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setRange(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${range === id ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-sm text-zinc-400">
          共 {rows.list.length} 种菜品 · 合计{" "}
          <span className="text-orange-400 font-bold">
            {fmtMoney(rows.total)}
          </span>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">菜品销售排行</h3>
        {rows.list.length === 0 ? (
          <p className="text-zinc-500 text-sm py-6 text-center">暂无数据</p>
        ) : (
          <div className="space-y-2">
            {rows.list.slice(0, 50).map((r, i) => {
              const pct = rows.total ? (r.revenue / rows.total) * 100 : 0;
              return (
                <div key={r.name} className="relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-orange-500/10 rounded-lg"
                    style={{ width: `${(r.revenue / maxRev) * 100}%` }}
                  />
                  <div className="relative flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-zinc-200 truncate">{r.name}</span>
                    </div>
                    <div className="flex items-center gap-5 shrink-0">
                      <span className="text-zinc-500 text-sm">x{r.qty}</span>
                      <span className="text-zinc-500 text-xs w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                      <span className="text-orange-400 font-semibold w-20 text-right">
                        {fmtMoney(r.revenue)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
