import { useMemo } from "react";
import { TrendingUp, ShoppingBag, Wallet, Utensils } from "lucide-react";
import { dayKey, fmtMoney } from "../lib/format";

export default function Dashboard({ orders }: { orders: any[] }) {
  const stats = useMemo(() => {
    const today = dayKey(Date.now());
    const todays = orders.filter(
      (o) => dayKey(o.timestamp || o.created_at) === today,
    );
    const completed = todays.filter((o) => o.status === "completed");
    const revenue = completed.reduce(
      (s, o) => s + Number(o.total || o.total_amount || 0),
      0,
    );
    const count = todays.length;
    const avg = count ? revenue / count : 0;

    const days: {
      label: string;
      revenue: number;
      count: number;
    }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const k = dayKey(d.getTime());
      const dayOrders = orders.filter(
        (o) => dayKey(o.timestamp || o.created_at) === k,
      );
      days.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        revenue: dayOrders
          .filter((o) => o.status === "completed")
          .reduce((s, o) => s + Number(o.total || o.total_amount || 0), 0),
        count: dayOrders.length,
      });
    }
    const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));

    const dishMap = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    todays.forEach((o) =>
      (o.items || []).forEach((it: any) => {
        const name = it?.name || it?.title || "未知";
        const qty = Number(it?.quantity || it?.count || 1);
        const rev = Number(it?.price || 0) * qty;
        const e = dishMap.get(name) || { name, qty: 0, revenue: 0 };
        e.qty += qty;
        e.revenue += rev;
        dishMap.set(name, e);
      }),
    );
    const topDishes = Array.from(dishMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);

    return { revenue, count, avg, days, maxRevenue, topDishes };
  }, [orders]);

  const cards = [
    {
      icon: Wallet,
      label: "今日营收",
      value: fmtMoney(stats.revenue),
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    {
      icon: ShoppingBag,
      label: "今日订单",
      value: String(stats.count),
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: TrendingUp,
      label: "客单价",
      value: fmtMoney(stats.avg),
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
          >
            <div
              className={`w-10 h-10 rounded-xl ${c.bg} ${c.color} flex items-center justify-center mb-3`}
            >
              <c.icon size={20} />
            </div>
            <div className="text-zinc-400 text-sm">{c.label}</div>
            <div className={`text-3xl font-black mt-1 ${c.color}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">近 7 日营收趋势</h3>
        <div className="flex items-end justify-between gap-2 h-44">
          {stats.days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="text-[11px] text-orange-400 font-semibold">
                {d.revenue > 0 ? fmtMoney(d.revenue) : ""}
              </div>
              <div
                className="w-full bg-gradient-to-t from-orange-600 to-orange-400 rounded-t-lg transition-all"
                style={{
                  height: `${Math.max(2, (d.revenue / stats.maxRevenue) * 120)}px`,
                }}
                title={`${d.count} 单`}
              />
              <div className="text-[11px] text-zinc-500">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Utensils size={18} className="text-orange-500" /> 今日热销
        </h3>
        {stats.topDishes.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">今日暂无销售</p>
        ) : (
          <div className="space-y-2">
            {stats.topDishes.map((d, i) => (
              <div
                key={d.name}
                className="flex items-center justify-between bg-zinc-950 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-zinc-200">{d.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-zinc-500 text-sm">x{d.qty}</span>
                  <span className="text-orange-400 font-semibold">
                    {fmtMoney(d.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
