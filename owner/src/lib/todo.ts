import { fmtMoney } from "./format";
import { type InventoryItem } from "./inventory";
import { type LateOrder } from "./lateOrders";
import { type PriceAlert } from "./priceAlert";

/* ============ 首页待办中心 ============
 * 把散落在订单 / 库存 / 采购 / 损耗四个模块的异常聚合成一屏待办，
 * 纯函数、无请求，数据由视图层拉取后传入。
 */

export type TodoLevel = "high" | "warn" | "info";

export interface TodoItem {
  id: "pending" | "stock" | "price" | "waste" | "late" | "stocktake";
  level: TodoLevel;
  title: string;
  desc: string;
  badge: string;
  /** 点击跳转的目标页（OwnerTab） */
  tab: string;
  /** 排序权重，越大越靠前 */
  weight: number;
}

export interface TodoInput {
  /** 低于安全库存的原料 */
  low: InventoryItem[];
  /** 已判定为异常的采购价（high/warn） */
  priceAlerts: PriceAlert[];
  /** 今日损耗金额 */
  todayWaste: number;
  /** 待接单数量 */
  pendingOrders: number;
  /** 超时未处理的订单（漏单风险） */
  late?: LateOrder[];
  /** 是否已到盘点周期 */
  stocktakeDue?: boolean;
}

/** 取前 n 个名字拼成摘要，超出用「等 N 个」收尾 */
export function namesPreview(names: string[], n = 3): string {
  if (!names.length) return "";
  const head = names.slice(0, n).join("、");
  return names.length > n ? `${head} 等 ${names.length} 个` : head;
}

export function buildTodos(input: TodoInput): TodoItem[] {
  const out: TodoItem[] = [];
  const {
    low,
    priceAlerts,
    todayWaste,
    pendingOrders,
    late = [],
    stocktakeDue = false,
  } = input;

  if (stocktakeDue) {
    out.push({
      id: "stocktake",
      level: "warn",
      title: "该盘点了",
      desc: "距上次盘点已超周期，A 类食材建议优先盘",
      badge: "盘点",
      tab: "inventory",
      weight: 130,
    });
  }

  if (late.length > 0) {
    out.push({
      id: "late",
      level: "high",
      title: `${late.length} 笔订单已超时未处理`,
      desc: namesPreview(
        late.map((l) => `${l.label}·${l.kindLabel}${l.elapsedMin}分`),
      ),
      badge: String(late.length),
      tab: "orders",
      weight: 140 + late.length,
    });
  }

  if (pendingOrders > 0) {
    out.push({
      id: "pending",
      level: "high",
      title: `${pendingOrders} 笔订单待接单`,
      desc: "顾客已下单，超时未接会影响出餐与口碑",
      badge: String(pendingOrders),
      tab: "orders",
      weight: 100 + pendingOrders,
    });
  }

  if (low.length > 0) {
    const outOfStock = low.filter((i) => Number(i.stock) <= 0);
    out.push({
      id: "stock",
      level: outOfStock.length ? "high" : "warn",
      title: `${low.length} 种原料低于安全库存`,
      desc: `${outOfStock.length ? `${outOfStock.length} 种已断货 · ` : ""}${namesPreview(
        low.map((i) => i.name),
      )}`,
      badge: String(low.length),
      tab: "inventory",
      weight: 80 + low.length,
    });
  }

  if (priceAlerts.length > 0) {
    out.push({
      id: "price",
      level: priceAlerts.some((a) => a.level === "high") ? "high" : "warn",
      title: `${priceAlerts.length} 个原料采购价异常`,
      desc: namesPreview(
        priceAlerts.map(
          (a) =>
            `${a.itemName} ${a.changePct >= 0 ? "+" : ""}${Math.round(a.changePct * 100)}%`,
        ),
      ),
      badge: String(priceAlerts.length),
      tab: "procurement",
      weight: 60 + priceAlerts.length,
    });
  }

  if (todayWaste > 0) {
    out.push({
      id: "waste",
      level: "info",
      title: `今日已报损 ${fmtMoney(todayWaste)}`,
      desc: "到损耗分析查看原因分布，控制出血点",
      badge: fmtMoney(todayWaste),
      tab: "waste",
      weight: 40,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}
