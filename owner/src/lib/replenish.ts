import { buildPriceAlerts } from "./priceAlert";
import { consumptionByItem } from "./aggregate";
import {
  createPurchase,
  fetchInventory,
  fetchPurchases,
  newPurchaseId,
  type InventoryItem,
  type PurchaseOrder,
} from "./inventory";
import {
  buildPurchasePlan,
  CONSUMPTION_WINDOW_DAYS,
  dailyFromConsumption,
  mergeRequestsIntoPlan,
  requestsByItem,
  type PurchasePlan,
  type RequestLike,
} from "./purchasePlan";
import {
  fetchPurchaseRequests,
  markPurchaseRequestsFulfilled,
} from "./staffOps";
import { fmtMoney } from "./format";

/**
 * AI 一键补货：在助手页把「低库存 + 消耗预测 + 参考价」合成为采购草稿，
 * 确认后直接生成采购单（与采购页「按计划生成」同一条链路）。
 */

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export interface ReplenishSummary {
  total: number;
  urgent: number;
  soon: number;
  normal: number;
  totalCost: number;
  /** 员工申报中已并入计划的条数（去重后） */
  mergedRequests: number;
  /** 未能匹配到库存品的申报条数 */
  unmatchedRequests: number;
  top: {
    name: string;
    qty: number;
    unit: string;
    estCost: number;
    reason: string;
    priority: string;
  }[];
}

export function replenishSummary(
  plan: PurchasePlan,
  unmatched = 0,
): ReplenishSummary {
  const priority = (p: string) =>
    p === "urgent" ? "紧急" : p === "soon" ? "偏低" : "备货";
  return {
    total: plan.rows.length,
    urgent: plan.rows.filter((r) => r.priority === "urgent").length,
    soon: plan.rows.filter((r) => r.priority === "soon").length,
    normal: plan.rows.filter((r) => r.priority === "normal").length,
    totalCost: plan.totalCost,
    mergedRequests: plan.rows.reduce(
      (s, r) => s + (r.requestIds?.length || 0),
      0,
    ),
    unmatchedRequests: unmatched,
    top: plan.rows.slice(0, 8).map((r) => ({
      name: r.name,
      qty: r.gap,
      unit: r.unit,
      estCost: r.estCost,
      reason: r.reason,
      priority: priority(r.priority),
    })),
  };
}

/** 采购单备注（采购页可识别来源） */
export function replenishNotes(coverageDays: number): string {
  return `AI 补货 · 覆盖 ${Math.max(1, Math.round(coverageDays))} 天`;
}

/** 拉取数据并合成补货计划（低库存 + 消耗 + 参考价 + 已批准申报） */
export async function loadReplenishPlan(coverageDays = 7): Promise<{
  plan: PurchasePlan;
  inventory: InventoryItem[];
  unmatched: RequestLike[];
}> {
  const end = new Date();
  const start = new Date(end.getTime() - CONSUMPTION_WINDOW_DAYS * 86400000);
  const [purchases, inv, cons, reqs] = await Promise.all([
    fetchPurchases(500),
    fetchInventory(),
    consumptionByItem(start.toISOString(), end.toISOString()),
    fetchPurchaseRequests(),
  ]);

  const alerts = buildPriceAlerts(purchases as PurchaseOrder[]);
  const daily = dailyFromConsumption(cons, CONSUMPTION_WINDOW_DAYS);
  const approved = reqs.filter((r) => r.status === "approved");
  const reqByItem = requestsByItem(approved, inv);
  const base = buildPurchasePlan({
    items: inv,
    daily,
    alerts,
    coverageDays,
  });
  const plan = mergeRequestsIntoPlan(base, reqByItem.byItem, inv);
  return { plan, inventory: inv, unmatched: reqByItem.unmatched };
}

/** 确认后把补货计划生成采购单；返回成功条数与已闭环的申报条数 */
export async function createReplenishPurchases(
  plan: PurchasePlan,
  coverageDays = 7,
): Promise<{ created: number; fulfilled: number }> {
  const notes = replenishNotes(coverageDays);
  let created = 0;
  let fulfilled = 0;
  for (const r of plan.rows) {
    const pid = newPurchaseId();
    const ok = await createPurchase({
      id: pid,
      supplier: "",
      inventory_item_id: r.id,
      item_name: r.name,
      quantity: round2(r.gap),
      unit: r.unit,
      unit_price: r.refPrice,
      notes,
    });
    if (ok) {
      created += 1;
      if (r.requestIds?.length) {
        fulfilled += await markPurchaseRequestsFulfilled(r.requestIds, pid);
      }
    }
  }
  return { created, fulfilled };
}

/** 草稿可复制文本（发供应商 / 存档） */
export function replenishText(plan: PurchasePlan): string {
  const money = (n: number) => fmtMoney(round2(n));
  const lines = [
    `AI 补货清单（覆盖 ${plan.coverageDays} 天，共 ${plan.rows.length} 项，预估 ${money(
      plan.totalCost,
    )} 元）`,
    "",
    ...plan.rows.map(
      (r, i) =>
        `${i + 1}. ${r.name} ${r.gap}${r.unit}（${
          r.priority === "urgent"
            ? "紧急"
            : r.priority === "soon"
              ? "偏低"
              : "备货"
        }，约 ${money(r.estCost)} 元，${r.reason}）`,
    ),
  ];
  return lines.join("\n");
}
