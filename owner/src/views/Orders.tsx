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
  Pencil,
  Trash2,
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
import {
  rangeToIso,
  fetchOrdersPage,
  updateOrderStatus,
  updateOrderFields,
  deleteOrder,
  NEXT_STATUS,
} from "../lib/aggregate";

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

export default function Orders({ version = 0 }: { version?: number }) {
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
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({
    table_no: "",
    customer_name: "",
    total: "",
    paymentMethod: "",
    notes: "",
  });

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
  }, [range, status, sort, page, qDebounced, version]);

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const resetPage = () => setPage(0);

  const openDetail = (o: any) => {
    setDetail(o);
    setEditing(false);
    setEditDraft({
      table_no: String(o.table_no || o.tableNo || ""),
      customer_name: String(o.customer_name || o.customerName || ""),
      total: String(o.finalTotal ?? o.total ?? o.total_amount ?? ""),
      paymentMethod: String(o.paymentMethod || ""),
      notes: String(o.notes || ""),
    });
  };

  const saveEdit = async () => {
    if (!detail) return;
    const id = String(detail.id || detail._id);
    const total = Number(editDraft.total) || 0;
    setBusy(true);
    const ok = await updateOrderFields(id, {
      table_no: editDraft.table_no,
      customer_name: editDraft.customer_name,
      customerName: editDraft.customer_name,
      notes: editDraft.notes,
      total,
      total_amount: total,
      paymentMethod: editDraft.paymentMethod,
    });
    setBusy(false);
    if (!ok) return toast.error("保存失败");
    toast.success("订单已更新");
    setDetail({
      ...detail,
      table_no: editDraft.table_no,
      customer_name: editDraft.customer_name,
      customerName: editDraft.customer_name,
      notes: editDraft.notes,
      total,
      total_amount: total,
      paymentMethod: editDraft.paymentMethod,
    });
    setRows((prev) =>
      prev.map((o) =>
        String(o.id || o._id) === id
          ? {
              ...o,
              table_no: editDraft.table_no,
              customer_name: editDraft.customer_name,
              customerName: editDraft.customer_name,
              total,
              total_amount: total,
            }
          : o,
      ),
    );
    setEditing(false);
  };

  const removeOrder = async () => {
    if (!detail) return;
    const id = String(detail.id || detail._id);
    if (!confirm(`删除订单「${detail.orderNumber || id}」？此操作不可恢复。`))
      return;
    setBusy(true);
    const ok = await deleteOrder(id);
    setBusy(false);
    if (!ok) return toast.error("删除失败");
    toast.success("订单已删除");
    setRows((prev) => prev.filter((o) => String(o.id || o._id) !== id));
    setDetail(null);
  };

  const changeStatus = async (s: string) => {
    if (!detail) return;
    if (
      (s === "completed" || s === "cancelled") &&
      !confirm(`确认将订单设为「${STATUS_TEXT[s]}」？`)
    )
      return;
    setBusy(true);
    const ok = await updateOrderStatus(String(detail.id || detail._id), s);
    setBusy(false);
    if (!ok) return toast.error("状态更新失败");
    toast.success(`已更新为「${STATUS_TEXT[s]}」`);
    setDetail({ ...detail, status: s });
    setRows((prev) =>
      prev.map((o) =>
        String(o.id || o._id) === String(detail.id || detail._id)
          ? { ...o, status: s }
          : o,
      ),
    );
  };

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
    <div className="space-y-3.5 sm:space-y-4">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5 overflow-x-auto max-w-full">
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
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[13px] sm:text-sm font-semibold transition-colors ${range === id ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-white"}`}
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
          className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
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
          className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none"
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
            className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
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
                  onClick={() => openDetail(o)}
                  className="w-full text-left bg-zinc-900 border border-white/5 rounded-xl p-3 active:scale-[0.99] transition-transform"
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
          <div className="hidden sm:block bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left border-b border-white/5">
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
                            onClick={() => openDetail(o)}
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
            className="p-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-zinc-400">
            第 {page + 1} / {pageCount} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="p-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-300 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 详情抽屉 */}
      {detail && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex justify-end items-end sm:items-stretch"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-zinc-900 border-l border-white/10 rounded-t-[28px] sm:rounded-none w-full max-w-md max-h-[92vh] sm:max-h-none sm:h-full overflow-y-auto safe-bottom animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-zinc-700" />
            <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-start justify-between">
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

              <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/5">
                <span className="text-zinc-400">合计</span>
                <span className="text-3xl font-black text-orange-400">
                  {fmtMoney(detail.finalTotal ?? orderTotal(detail))}
                </span>
              </div>

              {(NEXT_STATUS[detail.status || "pending"] || []).length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-zinc-500 mb-2">推进订单状态</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(NEXT_STATUS[detail.status || "pending"] || []).map(
                      (s) => (
                        <button
                          key={s}
                          disabled={busy}
                          onClick={() => changeStatus(s)}
                          className={`py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                            s === "cancelled"
                              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                              : "bg-orange-600 hover:bg-orange-500 text-white"
                          }`}
                        >
                          {STATUS_TEXT[s] || s}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    import("../lib/print-lite").then((m) =>
                      m.printOrder(detail),
                    )
                  }
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm"
                >
                  <Printer size={16} /> 打印小票
                </button>
                <button
                  disabled={busy}
                  onClick={() => setEditing((v) => !v)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm disabled:opacity-50"
                >
                  <Pencil size={16} /> 编辑
                </button>
              </div>

              <button
                disabled={busy}
                onClick={removeOrder}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm disabled:opacity-50"
              >
                <Trash2 size={16} /> 删除订单
              </button>

              {editing && (
                <div className="mt-4 bg-zinc-950 border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-white">
                    编辑订单
                  </div>
                  <OrderField
                    label="桌号"
                    value={editDraft.table_no}
                    onChange={(v) =>
                      setEditDraft({ ...editDraft, table_no: v })
                    }
                  />
                  <OrderField
                    label="顾客/姓名"
                    value={editDraft.customer_name}
                    onChange={(v) =>
                      setEditDraft({ ...editDraft, customer_name: v })
                    }
                  />
                  <OrderField
                    label="金额"
                    type="number"
                    value={editDraft.total}
                    onChange={(v) => setEditDraft({ ...editDraft, total: v })}
                  />
                  <OrderField
                    label="支付方式"
                    value={editDraft.paymentMethod}
                    onChange={(v) =>
                      setEditDraft({ ...editDraft, paymentMethod: v })
                    }
                  />
                  <OrderField
                    label="备注"
                    value={editDraft.notes}
                    onChange={(v) => setEditDraft({ ...editDraft, notes: v })}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={saveEdit}
                      className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      保存修改
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
      />
    </label>
  );
}
