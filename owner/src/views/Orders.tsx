import { useEffect, useMemo, useState } from "react";
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
import { EmptyState, SkeletonTable } from "../components/ui";
import { Segmented } from "../components/Segmented";
import { Dictation } from "../components/Dictation";
import { toast } from "../components/Toast";
import { fmtDateTime, fmtMoney, STATUS_TEXT } from "../lib/format";
import { lateOrders, useLateConfig } from "../lib/lateOrders";
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
import {
  getOrderTag,
  setOrderTag,
  ORDER_TAG_LABEL,
  type OrderTag,
} from "../lib/orderTags";

const TAG_CLS: Record<OrderTag, string> = {
  normal: "",
  refund: "bg-red-500/15 text-red-400",
  gift: "bg-purple-500/15 text-purple-400",
  staff: "bg-sky-500/15 text-sky-400",
  trial: "bg-amber-500/15 text-amber-400",
};

const TAG_ORDER: OrderTag[] = ["refund", "gift", "staff", "trial"];

function TagBadge({ tag }: { tag: OrderTag }) {
  if (tag === "normal") return null;
  return (
    <span
      className={`inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-full font-bold ${TAG_CLS[tag]}`}
    >
      {ORDER_TAG_LABEL[tag]}
    </span>
  );
}

const STATUS_CLS: Record<string, string> = {
  pending: "bg-orange-500/20 text-orange-400",
  cooking: "bg-blue-500/20 text-blue-400",
  served: "bg-teal-500/20 text-teal-400",
  completed: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

/** 订单状态色条：卡片左侧 / 表格首列 */
const STATUS_HEX: Record<string, string> = {
  pending: "#f97316",
  cooking: "#3b82f6",
  served: "#14b8a6",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const statusOf = (o: any) => o?.status || "pending";
const tagOf = (o: any) => getOrderTag(String(o?.id || o?._id || ""));
const statusColor = (s: string) => STATUS_HEX[s] || STATUS_HEX.pending;
const itemCount = (o: any) =>
  orderItems(o).reduce((s: number, it: any) => s + itemQty(it), 0);

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
  const [tagTick, setTagTick] = useState(0);
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [qDebounced, setQDebounced] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  // 超时高亮：阈值可配，每分钟重算
  const [lateCfg] = useLateConfig();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const lateMap = useMemo(
    () => new Map(lateOrders(rows, lateCfg, now).map((l) => [l.id, l])),
    [rows, lateCfg, now],
  );
  const tagMap = useMemo(() => {
    const m = new Map<string, OrderTag>();
    for (const o of rows) {
      const id = String(o.id || o._id || "");
      m.set(id, getOrderTag(id));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tagTick]);
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

  // 异常订单队列：退菜/赠送/员工餐/试菜（本地标记）在当前页内过滤
  const shown = onlyAbnormal
    ? rows.filter((o) => getOrderTag(String(o.id || o._id)) !== "normal")
    : rows;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        <Segmented
          value={range}
          onChange={(v) => {
            setRange(v);
            resetPage();
          }}
          size="sm"
          options={
            [
              ["today", "今天"],
              ["7d", "近7天"],
              ["30d", "近30天"],
              ["all", "全部"],
            ] as const
          }
        />

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
            className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-9 pr-9 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          />
          <Dictation
            value={q}
            onChange={(v) => {
              setQ(v);
              resetPage();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
          />
        </div>

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <Download size={16} /> 导出 CSV
        </button>

        <button
          onClick={() => setOnlyAbnormal((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition-colors ${
            onlyAbnormal
              ? "bg-purple-500/15 border-purple-500/60 text-purple-400 font-semibold"
              : "bg-zinc-900 border-white/5 text-zinc-300 hover:text-white"
          }`}
        >
          异常订单
        </button>
      </div>

      <div className="text-sm text-zinc-400">
        共 <span className="text-orange-400 font-bold">{count}</span> 单 ·
        服务端分页（每页 {PAGE_SIZE}）
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : (
        <>
          {/* 手机卡片 */}
          <div className="sm:hidden space-y-2.5">
            {shown.length === 0 ? (
              <EmptyState
                text={onlyAbnormal ? "暂无异常订单" : "暂无订单"}
                hint="可切换时间范围，或到看板查看实时订单"
              />
            ) : (
              shown.map((o, i) => {
                const st = statusOf(o);
                const late = lateMap.get(String(o.id || o._id || ""));
                return (
                  <button
                    key={o._id || o.id || i}
                    onClick={() => openDetail(o)}
                    className={`relative w-full text-left card-surface overflow-hidden pl-4 pr-3.5 py-3 active:scale-[0.99] transition-transform ${
                      late ? "ring-1 ring-red-500/40" : ""
                    }`}
                  >
                    {/* 状态色条 */}
                    <span
                      className="absolute left-0 inset-y-0 w-[4px]"
                      style={{ background: statusColor(st) }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-white leading-none">
                            {tableName(o)}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {itemCount(o)} 项
                          </span>
                          <TagBadge
                            tag={
                              tagMap.get(String(o.id || o._id || "")) ||
                              "normal"
                            }
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mt-1.5">
                          <Clock size={12} className="shrink-0" />
                          {fmtDateTime(o.timestamp || o.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_CLS[st] || STATUS_CLS.pending}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: statusColor(st) }}
                          />
                          {STATUS_TEXT[st] || "待接单"}
                        </span>
                        {late && (
                          <span className="inline-flex items-center text-[11px] px-2 py-1 rounded-full font-bold bg-red-500/15 text-red-400">
                            超时 {late.overdueMin} 分
                          </span>
                        )}
                        <span className="tnum text-orange-400 font-bold text-base leading-none">
                          {fmtMoney(orderTotal(o))}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* 桌面表格 */}
          <div className="hidden sm:block card-surface overflow-hidden">
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
                  {shown.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center text-zinc-500 py-10"
                      >
                        {onlyAbnormal ? "暂无异常订单" : "暂无订单"}
                      </td>
                    </tr>
                  ) : (
                    shown.map((o, i) => {
                      const st = statusOf(o);
                      const late = lateMap.get(String(o.id || o._id || ""));
                      return (
                        <tr
                          key={o._id || o.id || i}
                          className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 group ${
                            late ? "bg-red-500/[0.06]" : ""
                          }`}
                        >
                          <td className="relative px-4 py-3 text-white font-semibold">
                            <span
                              className="absolute left-0 inset-y-0 w-[3px] opacity-70 group-hover:opacity-100"
                              style={{ background: statusColor(st) }}
                            />
                            {tableName(o)}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {fmtDateTime(o.timestamp || o.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLS[st] || STATUS_CLS.pending}`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: statusColor(st) }}
                              />
                              {STATUS_TEXT[st] || "待接单"}
                            </span>{" "}
                            <TagBadge
                              tag={
                                tagMap.get(String(o.id || o._id || "")) ||
                                "normal"
                              }
                            />
                            {late && (
                              <span className="inline-flex items-center mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400">
                                超时 {late.overdueMin} 分
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400">
                            {itemCount(o)}
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
                      );
                    })
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
          className="scrim fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex justify-end items-end sm:items-stretch"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-zinc-900 border-l border-white/10 rounded-t-[28px] sm:rounded-none w-full max-w-md max-h-[92vh] sm:max-h-none sm:h-full overflow-y-auto safe-bottom animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-zinc-700" />
            <div
              className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-white/5 px-5 py-4 flex items-start justify-between"
              style={{
                borderTop: `4px solid ${statusColor(statusOf(detail))}`,
              }}
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl font-bold text-white leading-none">
                    {tableName(detail)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_CLS[statusOf(detail)] || STATUS_CLS.pending}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: statusColor(statusOf(detail)) }}
                    />
                    {STATUS_TEXT[statusOf(detail)] || "待接单"}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1.5">
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
              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className="text-zinc-500">
                  共 {itemCount(detail)} 项商品
                </span>
                {detail.paymentMethod && (
                  <span className="flex items-center gap-1 text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-1 rounded-full">
                    <CreditCard size={12} /> {detail.paymentMethod}
                  </span>
                )}
              </div>

              {/* 订单标记：退菜/赠送/员工餐/试菜 不参与理论消耗 */}
              <div className="mb-4 rounded-xl bg-zinc-950 border border-white/5 px-3 py-2.5">
                <div className="text-[11px] text-zinc-500 mb-2">
                  订单标记（退菜/赠送/员工餐/试菜不计入理论消耗）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_ORDER.map((t) => {
                    const on = tagOf(detail) === t;
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          setOrderTag(String(detail.id || detail._id), t);
                          setTagTick((v) => v + 1);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          on
                            ? "bg-orange-500/15 border-orange-500/60 text-orange-400"
                            : "bg-zinc-900 border-white/5 text-zinc-400 hover:border-white/20"
                        }`}
                      >
                        {ORDER_TAG_LABEL[t]}
                      </button>
                    );
                  })}
                  {tagOf(detail) !== "normal" && (
                    <button
                      onClick={() => {
                        setOrderTag(String(detail.id || detail._id), "normal");
                        setTagTick((v) => v + 1);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white"
                    >
                      恢复正常
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {orderItems(detail).map((it, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-zinc-950 rounded-xl px-3 py-2.5 text-sm"
                  >
                    <span className="text-zinc-200 truncate mr-2">
                      {it?.name || it?.title}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="tnum text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400">
                        ×{itemQty(it)}
                      </span>
                      <span className="tnum text-zinc-300 w-16 text-right">
                        {fmtMoney(itemRevenue(it))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-zinc-950 border border-white/5 px-4 py-3.5 flex items-center justify-between">
                <span className="text-sm text-zinc-400">合计</span>
                <span
                  className="tnum text-2xl font-bold"
                  style={{ color: "var(--color-orange-500)" }}
                >
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
                              : "btn-brand text-white"
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
                      className="flex-1 py-2.5 rounded-xl btn-brand text-white text-sm font-semibold disabled:opacity-50"
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
