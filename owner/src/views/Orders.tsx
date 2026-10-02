import { useMemo, useState } from "react";
import { Search, X, Clock, Eye } from "lucide-react";
import {
  dayKey,
  fmtDateTime,
  fmtMoney,
  STATUS_TEXT,
  tableName,
} from "../lib/format";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-orange-500/20 text-orange-400",
  cooking: "bg-blue-500/20 text-blue-400",
  served: "bg-teal-500/20 text-teal-400",
  completed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

export default function Orders({ orders }: { orders: any[] }) {
  const [range, setRange] = useState<"today" | "7d" | "all">("today");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<any | null>(null);

  const filtered = useMemo(() => {
    const today = dayKey(Date.now());
    const now = Date.now();
    return orders.filter((o) => {
      const k = dayKey(o.timestamp || o.created_at);
      if (range === "today" && k !== today) return false;
      if (range === "7d") {
        const t = new Date(k + "T00:00:00").getTime();
        if (now - t > 7 * 86400000) return false;
      }
      if (status !== "all" && (o.status || "pending") !== status) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const hay =
          `${tableName(o)} ${o.customerName || ""} ${o.orderNumber || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, range, status, q]);

  const totalRevenue = filtered
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + Number(o.total || o.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option value="pending">待接单</option>
          <option value="cooking">制作中</option>
          <option value="served">已上菜</option>
          <option value="completed">已结账</option>
          <option value="cancelled">已取消</option>
        </select>

        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索桌号 / 单号 / 顾客"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <div className="text-sm text-zinc-400">
          {filtered.length} 单 · 营收{" "}
          <span className="text-orange-400 font-bold">
            {fmtMoney(totalRevenue)}
          </span>
        </div>
      </div>

      {/* 手机端：卡片列表 */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-zinc-500 py-10">暂无订单</p>
        ) : (
          filtered.slice(0, 200).map((o, i) => (
            <button
              key={o._id || o.id || i}
              onClick={() => setDetail(o)}
              className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-black text-white">
                  {tableName(o)}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLS[o.status || "pending"] || STATUS_CLS.pending}`}
                >
                  {STATUS_TEXT[o.status || "pending"] || "待接单"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs">
                <span className="text-zinc-500">
                  {fmtDateTime(o.timestamp || o.created_at)}
                </span>
                <span className="text-orange-400 font-bold text-sm">
                  {fmtMoney(Number(o.total || o.total_amount || 0))}
                </span>
              </div>
            </button>
          ))
        )}
        {filtered.length > 200 && (
          <p className="text-center text-xs text-zinc-500 py-2">
            仅显示前 200 条，请用筛选缩小范围
          </p>
        )}
      </div>

      {/* 桌面端：表格 */}
      <div className="hidden sm:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-left border-b border-zinc-800">
                <th className="px-4 py-3 font-medium">桌号</th>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium text-right">菜品数</th>
                <th className="px-4 py-3 font-medium text-right">金额</th>
                <th className="px-4 py-3 font-medium text-right">详情</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-zinc-500 py-10">
                    暂无订单
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 300).map((o, i) => (
                  <tr
                    key={o._id || o.id || i}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3 text-white font-semibold">
                      {tableName(o)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {fmtDateTime(o.timestamp || o.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLS[o.status || "pending"] || STATUS_CLS.pending}`}
                      >
                        {STATUS_TEXT[o.status || "pending"] || "待接单"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">
                      {(o.items || []).reduce(
                        (s: number, it: any) => s + Number(it?.quantity || 1),
                        0,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-400 font-semibold">
                      {fmtMoney(Number(o.total || o.total_amount || 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetail(o)}
                        className="text-zinc-400 hover:text-white inline-flex items-center gap-1"
                      >
                        <Eye size={14} /> 查看
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 300 && (
          <div className="text-center text-xs text-zinc-500 py-2">
            仅显示前 300 条，请用筛选缩小范围
          </div>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
              <div>
                <div className="text-2xl font-black text-white">
                  {tableName(detail)}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                  <Clock size={12} />
                  {fmtDateTime(detail.timestamp || detail.created_at)} · 单号{" "}
                  {detail.orderNumber || "N/A"}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-2">
              {(detail.items || []).map((it: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between items-center bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">{it?.name || it?.title}</span>
                  <span className="text-zinc-500">x{it?.quantity || 1}</span>
                  <span className="text-zinc-300 w-16 text-right">
                    {fmtMoney(
                      Number(it?.price || 0) * Number(it?.quantity || 1),
                    )}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-2 border-t border-zinc-800">
                <span className="text-zinc-400">合计</span>
                <span className="text-2xl font-black text-orange-400">
                  {fmtMoney(Number(detail.total || detail.total_amount || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
