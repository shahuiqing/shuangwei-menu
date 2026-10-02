import { useEffect, useState } from "react";
import {
  Search,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Printer,
} from "lucide-react";
import { EmptyState, Skeleton } from "../components/ui";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney, STATUS_TEXT } from "../lib/format";
import {
  orderItems,
  orderTotal,
  tableName,
  itemQty,
  itemRevenue,
  type RangeKey,
} from "../lib/analytics";
import { rangeToIso, fetchOrdersPage } from "../lib/aggregate";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-orange-500/20 text-orange-400",
  cooking: "bg-blue-500/20 text-blue-400",
  served: "bg-teal-500/20 text-teal-400",
  completed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const PAGE_SIZE = 50;

function exportCsv(rows: any[]) {
  const header = ["桌号", "时间", "状态", "菜品数", "金额", "支付方式", "单号"];
  const body = rows.map((o) => [
    tableName(o),
    fmtDateTime(o.timestamp || o.created_at),
    STATUS_TEXT[o.status || "pending"] || "",
    orderItems(o).reduce((s, it) => s + itemQty(it), 0),
    orderTotal(o),
    o.paymentMethod || "",
    o.orderNumber || o._id || o.id || "",
  ]);
  const csv =
    "\uFEFF" +
    [header, ...body]
      .map((r) =>
        r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Orders() {
  const [range, setRange] = useState<RangeKey>("today");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"time_desc" | "time_asc" | "amount_desc">(
    "time_desc",
  );
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const b = rangeToIso(range);
      const res = await fetchOrdersPage({
        start: b.start,
        end: b.end,
        status,
        search: qDebounced,
        sort,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (!alive) return;
      setRows(res.rows);
      setCount(res.count);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range, status, sort, page, qDebounced]);

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const resetPage = () => setPage(0);

  const onExport = async () => {
    const b = rangeToIso(range);
    const res = await fetchOrdersPage({
      start: b.start,
      end: b.end,
      status,
      search: qDebounced,
      sort,
      offset: 0,
      limit: 1000,
    });
    if (!res.rows.length) return toast.error("没有可导出的数据");
    exportCsv(res.rows);
    toast.success(
      `已导出 ${res.rows.length} 条订单${res.count > 1000 ? "（上限 1000）" : ""}`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          {(
            [
              ["today", "今天"],
              ["7d", "近7天"],
              ["30d", "近30天"],
              ["all", "全部"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setRange(id);
                resetPage();
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${range === id ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            resetPage();
          }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option value="pending">待接单</option>
          <option value="cooking">制作中</option>
          <option value="served">已上菜</option>
          <option value="completed">已结账</option>
          <option value="cancelled">已取消</option>
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            resetPage();
          }}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
        >
          <option value="time_desc">时间 ↓（新→旧）</option>
          <option value="time_asc">时间 ↑（旧→新）</option>
          <option value="amount_desc">金额 ↓</option>
        </select>

        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="搜索桌号 / 姓名 / 单号"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800"
        >
          <Download size={16} /> 导出 CSV
        </button>
      </div>

      <div className="text-sm text-zinc-400">
        共 <span className="text-orange-400 font-bold">{count}</span> 单 ·
        服务端分页（每页 {PAGE_SIZE}）
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {/* 手机卡片 */}
          <div className="sm:hidden space-y-2">
            {rows.length === 0 ? (
              <EmptyState text="暂无订单" />
            ) : (
              rows.map((o, i) => (
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
                      {fmtMoney(orderTotal(o))}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 桌面表格 */}
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
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-zinc-500 py-10"
                      >
                        暂无订单
                      </td>
                    </tr>
                  ) : (
                    rows.map((o, i) => (
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
                          {orderItems(o).reduce((s, it) => s + itemQty(it), 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-400 font-semibold">
                          {fmtMoney(orderTotal(o))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetail(o)}
                            className="text-zinc-400 hover:text-white inline-flex items-center gap-1"
                          >
                            <Clock size={14} /> 查看
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 分页 */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-zinc-400">
            第 {page + 1} / {pageCount} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 详情抽屉 */}
      {detail && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex justify-end"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-zinc-900 border-l border-zinc-800 w-full max-w-md h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-start justify-between">
              <div>
                <div className="text-3xl font-black text-white">
                  {tableName(detail)}
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                  <Clock size={12} />
                  {fmtDateTime(detail.timestamp || detail.created_at)} · 单号{" "}
                  {detail.orderNumber || detail.id || "N/A"}
                </div>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${STATUS_CLS[detail.status || "pending"] || STATUS_CLS.pending}`}
                >
                  {STATUS_TEXT[detail.status || "pending"] || "待接单"}
                </span>
                {detail.paymentMethod && (
                  <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-1 rounded-full">
                    <CreditCard size={12} /> {detail.paymentMethod}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {orderItems(detail).map((it, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-zinc-950 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-300 truncate mr-2">
                      {it?.name || it?.title}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-zinc-500">x{itemQty(it)}</span>
                      <span className="text-zinc-300 w-16 text-right">
                        {fmtMoney(itemRevenue(it))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 mt-4 border-t border-zinc-800">
                <span className="text-zinc-400">合计</span>
                <span className="text-3xl font-black text-orange-400">
                  {fmtMoney(detail.finalTotal ?? orderTotal(detail))}
                </span>
              </div>

              <button
                onClick={() =>
                  import("../lib/print-lite").then((m) => m.printOrder(detail))
                }
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm"
              >
                <Printer size={16} /> 打印小票
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
