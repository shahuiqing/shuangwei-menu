import { rangeToIso, salesSummary, dishStats, costSummary } from "./aggregate";
import {
  fetchBoms,
  fetchInventory,
  fetchPurchases,
  fetchTransactions,
  inventoryValue,
  lowStockItems,
  num,
} from "./inventory";
import { dishMargins } from "./cost";
import { buildPriceAlerts, flaggedAlerts } from "./priceAlert";
import { computeExpiry } from "./expiry";
import { todayWasteAmount } from "./waste";
import { loadStocktakeHistory } from "./stocktakeHistory";
import { businessDayStart, todayKey } from "./businessDay";
import { fmtMoney } from "./format";
import {
  fetchPurchaseRequests,
  fetchStaffTasks,
  fetchStocktakeTasks,
  isOverdue,
} from "./staffOps";

/**
 * 全店经营快照：给 AI 助手用的结构化上下文。
 * 只取聚合结果与少量明细，控制体积，避免把整库数据发给模型。
 */

export interface BusinessSnapshot {
  generatedAt: string;
  today: string;
  sales: {
    today: { revenue: number; orders: number; aov: number };
    week: { revenue: number; orders: number; aov: number };
  };
  menu: {
    top: { name: string; qty: number; revenue: number }[];
    slow: { name: string; qty: number; revenue: number }[];
    lowMargin: { name: string; margin: number; qty: number; revenue: number }[];
  };
  cost: { foodCostRate: number; foodCost: number; profit: number };
  inventory: {
    low: { name: string; stock: number; unit: string; safety: number }[];
    expiring: { name: string; daysLeft: number | null }[];
    totalValue: number;
  };
  purchasing: {
    weekAmount: number;
    rising: { name: string; pct: number }[];
    suppliers: number;
  };
  waste: { today: number; week: number; ratioPct: number };
  stocktake: {
    last: {
      day: string;
      items: number;
      diffs: number;
      netValue: number;
    } | null;
    pendingToday: number;
  };
  staff: {
    pendingTasks: number;
    overdueTasks: number;
    pendingRequests: number;
  };
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export async function loadBusinessSnapshot(): Promise<BusinessSnapshot> {
  const t = rangeToIso("today");
  const w = rangeToIso("7d");
  const todayStart = new Date(businessDayStart());
  const weekStartIso = new Date(
    todayStart.getTime() - 6 * 86400000,
  ).toISOString();

  const [
    todaySales,
    weekSales,
    weekDishes,
    todayCost,
    boms,
    inv,
    purchases,
    txns,
    tasks,
    stk,
    reqs,
  ] = await Promise.all([
    salesSummary(t.start, t.end),
    salesSummary(w.start, w.end),
    dishStats(w.start, w.end),
    costSummary(t.start, t.end),
    fetchBoms(),
    fetchInventory(),
    fetchPurchases(500),
    fetchTransactions(3000, "waste", w.start),
    fetchStaffTasks(),
    fetchStocktakeTasks(todayKey()),
    fetchPurchaseRequests(),
  ]);

  const margins = dishMargins(
    weekDishes.map((d) => ({
      name: d.name,
      qty: d.qty,
      revenue: d.revenue,
    })),
    boms,
    inv,
  );
  const byQty = [...margins].sort((a, b) => b.qty - a.qty);

  // 临期：用最近采购批次推算（与库存页同口径）
  const batches = new Map<string, { at: string; qty: number }[]>();
  for (const p of purchases) {
    const id = p.item_id;
    const at = p.purchased_at || p.created_at || "";
    const qty = num(p.quantity);
    if (!id || !at || qty <= 0) continue;
    const arr = batches.get(id) || [];
    arr.push({ at, qty });
    batches.set(id, arr);
  }
  for (const arr of batches.values())
    arr.sort((a, b) => (a.at < b.at ? -1 : 1));
  const expiring = computeExpiry(inv, batches, new Date())
    .filter((e) => e.daysLeft !== null && e.daysLeft <= 3)
    .map((e) => ({ name: e.itemName, daysLeft: e.daysLeft }));

  const weekPurchases = purchases.filter((p) => {
    const at = p.purchased_at || p.created_at || "";
    return at && at >= weekStartIso;
  });
  const weekAmount = weekPurchases.reduce((s, p) => s + num(p.total_cost), 0);
  const suppliers = new Set(
    weekPurchases.map((p) => String(p.supplier || "").trim()).filter(Boolean),
  ).size;
  const rising = flaggedAlerts(buildPriceAlerts(purchases)).map((a) => ({
    name: a.itemName,
    pct: round2(a.changePct * 100),
  }));

  const wasteWeek = (txns || []).reduce(
    (s, x) => s + Math.abs(num(x.quantity)) * num(x.unit_cost),
    0,
  );
  const wasteToday = todayWasteAmount(
    (txns || []).filter(
      (x) => (x.created_at || "") >= todayStart.toISOString(),
    ),
  );

  const lastRecord = loadStocktakeHistory()[0] || null;

  const pending = tasks.filter((x) => x.status === "pending");

  return {
    generatedAt: new Date().toISOString(),
    today: todayKey(),
    sales: {
      today: {
        revenue: round2(todaySales.revenue),
        orders: todaySales.orders,
        aov: todaySales.orders
          ? round2(todaySales.revenue / todaySales.orders)
          : 0,
      },
      week: {
        revenue: round2(weekSales.revenue),
        orders: weekSales.orders,
        aov: weekSales.orders
          ? round2(weekSales.revenue / weekSales.orders)
          : 0,
      },
    },
    menu: {
      top: byQty.slice(0, 5).map((d) => ({
        name: d.name,
        qty: d.qty,
        revenue: round2(d.revenue),
      })),
      slow: byQty
        .filter((d) => d.qty > 0)
        .slice(-5)
        .reverse()
        .map((d) => ({ name: d.name, qty: d.qty, revenue: round2(d.revenue) })),
      lowMargin: byQty
        .filter((d) => d.hasCost && d.qty > 0)
        .sort((a, b) => a.margin - b.margin)
        .slice(0, 3)
        .map((d) => ({
          name: d.name,
          margin: Math.round(d.margin),
          qty: d.qty,
          revenue: round2(d.revenue),
        })),
    },
    cost: {
      foodCostRate: todaySales.revenue
        ? round2(((todayCost?.cogs ?? 0) / todaySales.revenue) * 100)
        : 0,
      foodCost: round2(todayCost?.cogs ?? 0),
      profit: round2(todaySales.revenue - (todayCost?.cogs ?? 0)),
    },
    inventory: {
      low: lowStockItems(inv)
        .slice(0, 12)
        .map((i) => ({
          name: i.name,
          stock: num(i.stock),
          unit: i.unit,
          safety: num(i.safety_stock),
        })),
      expiring: expiring.slice(0, 10),
      totalValue: round2(inventoryValue(inv)),
    },
    purchasing: {
      weekAmount: round2(weekAmount),
      rising: rising.slice(0, 8),
      suppliers,
    },
    waste: {
      today: round2(wasteToday),
      week: round2(wasteWeek),
      ratioPct: weekSales.revenue
        ? round2((wasteWeek / weekSales.revenue) * 100)
        : 0,
    },
    stocktake: {
      last: lastRecord
        ? {
            day: lastRecord.day,
            items: lastRecord.items,
            diffs: lastRecord.diffs,
            netValue: round2(lastRecord.netValue),
          }
        : null,
      pendingToday: stk.filter(
        (x) => x.status === "pending" || x.status === "drafted",
      ).length,
    },
    staff: {
      pendingTasks: pending.length,
      overdueTasks: pending.filter((x) => isOverdue(x.due_at)).length,
      pendingRequests: reqs.filter((r) => r.status === "pending").length,
    },
  };
}

/** 快照 → 提示词事实（紧凑中文，控制 token） */
export function snapshotToPrompt(s: BusinessSnapshot): string {
  const lines: string[] = [];
  lines.push(`营业日：${s.today}`);
  lines.push(
    `今日：营业额 ${fmtMoney(s.sales.today.revenue)}，${s.sales.today.orders} 单，客单 ${fmtMoney(
      s.sales.today.aov,
    )}；食材成本 ${fmtMoney(s.cost.foodCost)}（成本率 ${s.cost.foodCostRate.toFixed(
      1,
    )}%），毛利 ${fmtMoney(s.cost.profit)}`,
  );
  lines.push(
    `近 7 天：营业额 ${fmtMoney(s.sales.week.revenue)}，${s.sales.week.orders} 单，客单 ${fmtMoney(
      s.sales.week.aov,
    )}`,
  );
  if (s.menu.top.length) {
    lines.push(
      `近 7 天销量前 5：` +
        s.menu.top.map((d) => `${d.name}(${d.qty}份)`).join("、"),
    );
  }
  if (s.menu.slow.length) {
    lines.push(
      `近 7 天销量后 5：` +
        s.menu.slow.map((d) => `${d.name}(${d.qty}份)`).join("、"),
    );
  }
  if (s.menu.lowMargin.length) {
    lines.push(
      `毛利最低：` +
        s.menu.lowMargin
          .map((d) => `${d.name}(毛利率 ${d.margin}%)`)
          .join("、"),
    );
  }
  lines.push(
    s.inventory.low.length
      ? `低于安全库存 ${s.inventory.low.length} 种：` +
          s.inventory.low
            .map(
              (i) =>
                `${i.name}(存 ${i.stock}${i.unit}/安全 ${i.safety}${i.unit})`,
            )
            .join("、")
      : `库存正常，无低于安全库存的原料`,
  );
  if (s.inventory.expiring.length) {
    lines.push(
      `临期(≤3天) ${s.inventory.expiring.length} 项：` +
        s.inventory.expiring
          .map((e) => `${e.name}(${e.daysLeft}天)`)
          .join("、"),
    );
  }
  lines.push(`库存总额 ${fmtMoney(s.inventory.totalValue)}`);
  lines.push(
    `采购：近 7 天采购额 ${fmtMoney(s.purchasing.weekAmount)}，${s.purchasing.suppliers} 家供应商` +
      (s.purchasing.rising.length
        ? `；涨价项：` +
          s.purchasing.rising
            .map((a) => `${a.name}${a.pct > 0 ? "+" : ""}${a.pct}%`)
            .join("、")
        : `；无价格异常`),
  );
  lines.push(
    `损耗：今日 ${fmtMoney(s.waste.today)}，近 7 天 ${fmtMoney(s.waste.week)}（占营业额 ${s.waste.ratioPct.toFixed(
      1,
    )}%）`,
  );
  lines.push(
    s.stocktake.last
      ? `最近盘点 ${s.stocktake.last.day}：盘 ${s.stocktake.last.items} 项，差异 ${s.stocktake.last.diffs} 项，净差异金额 ${fmtMoney(s.stocktake.last.netValue)}；今日待提交 ${s.stocktake.pendingToday} 项`
      : `暂无盘点记录；今日待提交 ${s.stocktake.pendingToday} 项`,
  );
  lines.push(
    `员工：任务待完成 ${s.staff.pendingTasks}（逾期 ${s.staff.overdueTasks}），采购申报待审批 ${s.staff.pendingRequests} 条`,
  );
  return lines.join("\n");
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** 系统提示：角色、数据、回答规范 */
export function buildChatSystemPrompt(s: BusinessSnapshot): string {
  return [
    "你是餐厅老板的全能经营助手，懂销售、菜单、成本、库存、采购、损耗和员工协同。",
    "回答规范：",
    "- 只用下面的数据回答，不要编造；数据不足就直说缺什么。",
    "- 先给结论，再给 2-3 条可执行动作；总字数 250 字以内。",
    "- 涉及数字时引用具体值，不要泛泛而谈。",
    "- 用中文回答。",
    "",
    "全店经营快照：",
    snapshotToPrompt(s),
  ].join("\n");
}

/** 把最近对话拼进用户消息（chatLLM 只支持单轮 user） */
export function buildChatUserMessage(
  history: ChatTurn[],
  question: string,
  maxTurns = 8,
): string {
  const recent = history
    .slice(-maxTurns)
    .map(
      (m) =>
        `${m.role === "user" ? "老板" : "助手"}：${m.content.slice(0, 400)}`,
    )
    .join("\n");
  return recent ? `此前对话：\n${recent}\n\n老板现在问：${question}` : question;
}

/** 没配 AI 时的规则版回答（覆盖常见经营问题） */
export function answerWithoutLlm(
  s: BusinessSnapshot,
  question: string,
): string {
  const q = (question || "").toLowerCase();
  if (!q.trim())
    return "可以问我营业额、菜单、成本、库存、采购、损耗、盘点和员工任务。";

  if (/菜单|菜品|哪些菜|下架|涨价|毛利/.test(q)) {
    const parts: string[] = [];
    if (s.menu.lowMargin.length)
      parts.push(
        `毛利最低：` +
          s.menu.lowMargin.map((d) => `${d.name}（${d.margin}%）`).join("、"),
      );
    if (s.menu.slow.length)
      parts.push(
        `近 7 天卖得最少：` +
          s.menu.slow
            .slice(0, 3)
            .map((d) => `${d.name}（${d.qty} 份）`)
            .join("、"),
      );
    if (s.menu.top.length)
      parts.push(
        `卖得最好：` +
          s.menu.top
            .slice(0, 3)
            .map((d) => `${d.name}（${d.qty} 份）`)
            .join("、"),
      );
    parts.push(
      "建议：低毛利高销量的菜先核算配方成本；低销量低毛利的菜考虑下架或改套餐。",
    );
    return parts.join("\n");
  }

  if (/损耗|报损|浪费/.test(q)) {
    return s.waste.week > 0
      ? `今日损耗 ${fmtMoney(s.waste.today)}，近 7 天 ${fmtMoney(
          s.waste.week,
        )}（占营业额 ${s.waste.ratioPct.toFixed(
          1,
        )}%）。建议按原料统计损耗原因，临期品优先做促销或员工餐。`
      : "近 7 天没有报损记录。";
  }

  if (/盘点/.test(q)) {
    const last = s.stocktake.last;
    return (
      (last
        ? `最近一次盘点 ${last.day}：盘 ${last.items} 项，差异 ${last.diffs} 项，净差异 ${fmtMoney(
            last.netValue,
          )}。`
        : "还没有盘点记录。") +
      ` 今日盘点待提交 ${s.stocktake.pendingToday} 项。`
    );
  }

  if (/采购|供应商|进价/.test(q)) {
    return (
      `近 7 天采购额 ${fmtMoney(s.purchasing.weekAmount)}，${s.purchasing.suppliers} 家供应商。` +
      (s.purchasing.rising.length
        ? ` 涨价项：` +
          s.purchasing.rising
            .slice(0, 5)
            .map((a) => `${a.name}${a.pct > 0 ? "+" : ""}${a.pct}%`)
            .join("、") +
          "，建议比价后再下单。"
        : " 近期没有明显涨价。")
    );
  }

  if (/库存|缺货|缺|没货|补货|临期|过期/.test(q)) {
    const parts: string[] = [];
    if (s.inventory.low.length) {
      parts.push(
        `低于安全库存 ${s.inventory.low.length} 种：` +
          s.inventory.low
            .slice(0, 5)
            .map((i) => `${i.name}（${i.stock}${i.unit}）`)
            .join("、"),
      );
    } else parts.push("库存充足，没有低于安全库存的原料");
    if (s.inventory.expiring.length) {
      parts.push(
        `临期：` +
          s.inventory.expiring
            .slice(0, 5)
            .map((e) => `${e.name}（${e.daysLeft} 天）`)
            .join("、"),
      );
    }
    parts.push(`库存总额 ${fmtMoney(s.inventory.totalValue)}。`);
    return parts.join("\n");
  }

  if (/员工|任务|申报|盘点进度/.test(q)) {
    const parts = [
      `员工任务待完成 ${s.staff.pendingTasks} 项`,
      s.staff.overdueTasks > 0 ? `逾期 ${s.staff.overdueTasks} 项` : "",
      `今日盘点待提交 ${s.stocktake.pendingToday} 项`,
      `采购申报待审批 ${s.staff.pendingRequests} 条`,
    ].filter(Boolean);
    return parts.join("，") + "。";
  }

  if (/营业额|营收|生意|客单|利润|成本/.test(q)) {
    return `今日营业额 ${fmtMoney(s.sales.today.revenue)}（${s.sales.today.orders} 单，客单 ${fmtMoney(
      s.sales.today.aov,
    )}），成本率 ${s.cost.foodCostRate.toFixed(
      1,
    )}%，毛利 ${fmtMoney(s.cost.profit)}。近 7 天营业额 ${fmtMoney(
      s.sales.week.revenue,
    )}。`;
  }

  return "这个问题需要更完整的数据。可以试试点下面的常见问题，或配置 AI 接口获得深度分析。";
}
