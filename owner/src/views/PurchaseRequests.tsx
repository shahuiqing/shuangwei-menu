import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ShoppingCart,
  RefreshCw,
  Check,
  X,
  PackageCheck,
  Layers,
  Flame,
  Link2,
} from "lucide-react";
import { ChartCard, EmptyState } from "../components/ui";
import { toast } from "../components/Toast";
import { fetchInventory, type InventoryItem } from "../lib/inventory";
import { matchRequestToItem } from "../lib/purchasePlan";
import {
  fetchPurchaseRequests,
  reviewPurchaseRequest,
  markPurchasePurchased,
  linkPurchaseRequestItem,
  PURCHASE_STATUS_LABEL,
  type PurchaseRequest,
  type PurchaseStatus,
} from "../lib/staffOps";

const ST_CLS: Record<PurchaseStatus, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  approved: "bg-sky-500/15 text-sky-400",
  rejected: "bg-rose-500/15 text-rose-400",
  purchased: "bg-green-500/15 text-green-400",
};

/** 采购汇总：同名称+单位合并数量 */
export function summarize(list: PurchaseRequest[]): {
  key: string;
  name: string;
  unit: string;
  qty: number;
  urgent: boolean;
  sources: string[];
}[] {
  const map = new Map<
    string,
    {
      name: string;
      unit: string;
      qty: number;
      urgent: boolean;
      sources: string[];
    }
  >();
  for (const r of list) {
    const key = `${r.item_name.trim()}|${r.unit.trim()}`;
    const cur = map.get(key) || {
      name: r.item_name.trim(),
      unit: r.unit.trim(),
      qty: 0,
      urgent: false,
      sources: [],
    };
    cur.qty += Number(r.quantity) || 0;
    cur.urgent = cur.urgent || r.urgency === "urgent";
    if (r.staff_name && !cur.sources.includes(r.staff_name))
      cur.sources.push(r.staff_name);
    map.set(key, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v }));
}

export default function PurchaseRequests({
  version = 0,
}: {
  version?: number;
}) {
  const [tab, setTab] = useState<"pending" | "summary" | "records">("pending");
  const [list, setList] = useState<PurchaseRequest[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseStatus>(
    "all",
  );

  const load = async () => {
    setLoading(true);
    const [l, inv] = await Promise.all([
      fetchPurchaseRequests(),
      fetchInventory(),
    ]);
    setList(l);
    setItems(inv);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [version]);

  /** 申报 → 库存物品匹配：手动关联优先，否则按名称自动匹配 */
  const matchOf = (r: PurchaseRequest) => {
    const linked = r.inventory_item_id?.trim();
    if (linked && items.some((i) => i.id === linked))
      return { id: linked, linked: true as const };
    const auto = matchRequestToItem(r.item_name, items);
    return auto ? { id: auto, linked: false as const } : null;
  };

  const linkTo = async (r: PurchaseRequest, itemId: string) => {
    if (!itemId) return;
    if (await linkPurchaseRequestItem(r.id, itemId)) {
      toast.success(`「${r.item_name}」已关联库存物品，进入采购计划`);
      load();
    } else toast.error("关联失败");
  };

  const pending = list.filter((r) => r.status === "pending");
  const approvedUnbought = list.filter((r) => r.status === "approved");
  const records = useMemo(
    () =>
      statusFilter === "all"
        ? list
        : list.filter((r) => r.status === statusFilter),
    [list, statusFilter],
  );

  const review = async (r: PurchaseRequest, approve: boolean) => {
    let reason = "";
    if (!approve) {
      reason = prompt("驳回原因（会显示给申报员工）") || "";
      if (!reason) return toast.error("驳回必须填写原因");
    }
    if (await reviewPurchaseRequest(r.id, approve, reason)) {
      toast.success(approve ? "已通过，进入采购汇总" : "已驳回");
      load();
    } else toast.error("操作失败");
  };

  const markBought = async (r: PurchaseRequest) => {
    if (await markPurchasePurchased(r.id)) {
      toast.success(`「${r.item_name}」已标记采购完成`);
      load();
    } else toast.error("操作失败");
  };

  /** 汇总行上的匹配状态：已进采购计划 / 待确认可手动关联 */
  const matchNode = (r: PurchaseRequest) => {
    const m = matchOf(r);
    if (m) {
      const item = items.find((i) => i.id === m.id);
      return (
        <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
          ✓ 已进采购计划 · {item?.name || m.id}
          {m.linked ? "（手动关联）" : ""}
        </span>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
          <Link2 size={11} /> 待确认：未匹配库存物品
        </span>
        <select
          value=""
          onChange={(e) => linkTo(r, e.target.value)}
          className="bg-zinc-900 border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white"
        >
          <option value="">关联库存物品…</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}（{it.unit}）
            </option>
          ))}
        </select>
      </div>
    );
  };

  const card = (
    r: PurchaseRequest,
    actions: "review" | "buy" | null,
    extra?: ReactNode,
  ) => (
    <div key={r.id} className="bg-zinc-950 rounded-xl px-3.5 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${ST_CLS[r.status]}`}
        >
          {PURCHASE_STATUS_LABEL[r.status]}
        </span>
        {r.urgency === "urgent" && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
            <Flame size={11} /> 紧急
          </span>
        )}
        <span className="text-sm text-zinc-100 font-semibold">
          {r.item_name}
        </span>
        <span className="text-sm text-zinc-300">
          {r.quantity} {r.unit}
        </span>
        {r.category && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {r.category}
          </span>
        )}
        <span className="ml-auto text-[11px] text-zinc-500">
          申报人：{r.staff_name || "—"}
          {r.expected_date ? ` · 期望 ${r.expected_date} 到货` : ""}
        </span>
      </div>
      {extra}
      {r.status === "purchased" && r.purchase_id && (
        <div className="text-[11px] text-zinc-500">入库单：{r.purchase_id}</div>
      )}
      {(r.note ||
        r.photos.length > 0 ||
        (r.status === "rejected" && r.reject_reason)) && (
        <div className="text-xs text-zinc-400 bg-zinc-900 rounded-xl px-3 py-2 space-y-1">
          {r.note && <div>📝 {r.note}</div>}
          {r.status === "rejected" && r.reject_reason && (
            <div className="text-rose-400">驳回原因：{r.reject_reason}</div>
          )}
          {r.photos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {r.photos.map((p, i) => (
                <a key={i} href={p} target="_blank" rel="noreferrer">
                  <img
                    src={p}
                    alt=""
                    className="w-12 h-12 object-cover rounded-lg border border-white/10"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {actions === "review" && (
        <div className="flex gap-2">
          <button
            onClick={() => review(r, true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500"
          >
            <Check size={13} /> 通过
          </button>
          <button
            onClick={() => review(r, false)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 text-rose-400"
          >
            <X size={13} /> 驳回
          </button>
        </div>
      )}
      {actions === "buy" && (
        <button
          onClick={() => markBought(r)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-500"
        >
          <PackageCheck size={13} /> 标记已采购（通知申报人）
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center flex-wrap gap-2">
        {(
          [
            {
              id: "pending",
              label: `待审批 (${pending.length})`,
              icon: ShoppingCart,
            },
            {
              id: "summary",
              label: `采购汇总 (${approvedUnbought.length})`,
              icon: Layers,
            },
            { id: "records", label: "申报记录", icon: ShoppingCart },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl ${
              tab === t.id
                ? "bg-orange-600 text-white"
                : "bg-zinc-900 text-zinc-400 border border-white/5 hover:text-zinc-200"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 bg-zinc-900 border border-white/5 rounded-xl hover:bg-zinc-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 刷新
        </button>
      </div>

      {tab === "pending" && (
        <ChartCard
          title="待审批申报"
          subtitle="员工申报的「明天要买什么」，通过后进入采购汇总"
        >
          {pending.length === 0 ? (
            <EmptyState text="没有待审批的申报" />
          ) : (
            <div className="space-y-2">
              {pending.map((r) => card(r, "review"))}
            </div>
          )}
        </ChartCard>
      )}

      {tab === "summary" && (
        <ChartCard title="采购汇总" subtitle="已通过未采购，同品合并数量">
          {approvedUnbought.length === 0 ? (
            <EmptyState text="暂无待采购项" />
          ) : (
            <>
              <div className="space-y-2">
                {summarize(approvedUnbought).map((s) => (
                  <div
                    key={s.key}
                    className="flex flex-wrap items-center gap-2 bg-zinc-950 rounded-xl px-3.5 py-3"
                  >
                    {s.urgent && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                        <Flame size={11} /> 紧急
                      </span>
                    )}
                    <span className="text-sm text-zinc-100 font-semibold">
                      {s.name}
                    </span>
                    <span className="text-sm text-zinc-300 tnum">
                      合计 {Math.round(s.qty * 100) / 100} {s.unit}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      来自：{s.sources.join("、")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <div className="text-xs text-zinc-500">
                  已关联库存物品的申报会自动进入「采购」页的采购计划，入库后自动标记已采购；
                  直接手工买的可在此标记：
                </div>
                {approvedUnbought.map((r) => card(r, "buy", matchNode(r)))}
              </div>
            </>
          )}
        </ChartCard>
      )}

      {tab === "records" && (
        <ChartCard title="申报记录">
          <div className="flex flex-wrap gap-2 mb-3">
            {(
              ["all", "pending", "approved", "rejected", "purchased"] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  statusFilter === f
                    ? "bg-orange-600 text-white border-transparent"
                    : "bg-zinc-950 border-white/5 text-zinc-500"
                }`}
              >
                {f === "all" ? "全部" : PURCHASE_STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          {records.length === 0 ? (
            <EmptyState text="暂无申报记录" />
          ) : (
            <div className="space-y-2">{records.map((r) => card(r, null))}</div>
          )}
        </ChartCard>
      )}
    </div>
  );
}
