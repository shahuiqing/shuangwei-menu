import { fmtDateTime, fmtMoney } from "./format";
import {
  itemQty,
  itemRevenue,
  orderComputedTotal,
  orderItems,
  orderTotal,
  parsePrice,
  tableName,
} from "./analytics";

/* ============ 轻量小票打印（老板端只读，简单浏览器打印） ============
 * 两种单据：
 *  - 结账单 receipt：逐菜显示行小计（含配菜），配菜行显示 `+价格`，底部合计
 *  - 加菜单 addition：只列后来加的菜（isAdded 或 order.additions 里出现过的菜名），
 *    同样必须显示配菜价格与「加菜小计 ADDITION TOTAL」
 * 金额口径与顾客端一致：行金额 =（菜品单价 + Σ 配菜单价）× 数量；
 * 配菜单价优先取订单行 addons 快照，缺失时回退菜单定义（settings.categories）。
 * 老订单没有 addons 字段时按无配菜处理，不抛错。
 */

export type TicketType = "receipt" | "addition";

/** 行小计为 0（赠送/免费加料/老单未记价）时显示「免」而不是 0 */
const money = (n: number) => (n > 0 ? fmtMoney(n) : "免");

/** 配菜单价标签：0 元配菜不显示 +0，避免「加料却没加价」的误读 */
const addonPriceTag = (price: number) =>
  parsePrice(price) > 0 ? ` +${fmtMoney(parsePrice(price))}` : "";

/** 加菜单菜品集合：行上 isAdded 标记 + 订单 additions 记录里的菜名 */
function additionNames(order: any): Set<string> {
  const names = new Set<string>();
  const additions = Array.isArray(order?.additions)
    ? order.additions
    : Array.isArray(order?.unprintedAdditions)
      ? order.unprintedAdditions
      : [];
  additions.forEach((a: any) => {
    const list = Array.isArray(a?.items) ? a.items : [];
    list.forEach((it: any) => {
      const n = String(it?.name || it?.title || "").trim();
      if (n) names.add(n);
    });
  });
  return names;
}

export function buildTicketHtml(
  order: any,
  ticketType: TicketType = "receipt",
): string {
  const isAddition = ticketType === "addition";
  const addNames = isAddition ? additionNames(order) : new Set<string>();

  const allRows = orderItems(order);
  // 加菜单只列后加的菜；一张单里没有任何加菜记录时按「整单即加菜」处理，
  // 避免老板点了加菜单却印出一张空白纸。
  const onlyAdded = allRows.filter(
    (it: any) =>
      it?.isAdded || addNames.has(String(it?.name || it?.title || "").trim()),
  );
  const shown = isAddition && onlyAdded.length ? onlyAdded : allRows;

  const body = shown
    .map((it: any) => {
      const addons = Array.isArray(it?.addons) ? it.addons : [];
      const addonLines = addons
        .map(
          (a: any) =>
            `<div class="addon">+ ${String(a?.name ?? "").trim() || "配菜"}${addonPriceTag(a?.price)}</div>`,
        )
        .join("");
      return `<tr>
        <td>
          <div>${String(it?.name || it?.title || "")}</div>
          ${addonLines}
        </td>
        <td class="qty">x${itemQty(it)}</td>
        <td class="money">${money(itemRevenue(it))}</td>
      </tr>`;
    })
    .join("");

  const additionTotal = shown.reduce(
    (s: number, it: any) => s + itemRevenue(it),
    0,
  );
  const totalRow = isAddition
    ? `<div class="total">加菜小计 ADDITION TOTAL ${money(additionTotal)}</div>`
    : `<div class="total">合计 ${fmtMoney(orderTotal(order))}</div>`;

  const empty = shown.length
    ? ""
    : `<div class="m">${isAddition ? "本单没有加菜记录" : "本单没有菜品明细"}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${isAddition ? "加菜单" : "结账单"}</title>
  <style>
    body{font-family:system-ui,sans-serif;width:280px;margin:0 auto;padding:10px;color:#000}
    h1{font-size:16px;text-align:center;margin:4px 0}
    h2{font-size:13px;text-align:center;margin:2px 0 6px;font-weight:600;letter-spacing:1px}
    .m{font-size:11px;color:#555;text-align:center;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    td{padding:3px 0;border-bottom:1px dashed #ccc;vertical-align:top}
    td.qty{width:44px;text-align:center;white-space:nowrap}
    td.money{width:72px;text-align:right;white-space:nowrap}
    .addon{font-size:11px;color:#444;padding-left:8px}
    .total{font-size:16px;font-weight:bold;text-align:right;margin-top:10px}
  </style></head><body>
  <h1>${tableName(order)}</h1>
  <h2>${isAddition ? "加菜单 ADDITION" : "结账单 RECEIPT"}</h2>
  <div class="m">${fmtDateTime(order?.timestamp || order?.created_at)} · ${order?.orderNumber || ""}</div>
  ${empty}
  <table>${body}</table>
  ${shown.length ? totalRow : ""}
  <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
  </body></html>`;
}

export function printOrder(order: any, ticketType: TicketType = "receipt") {
  const html = buildTicketHtml(order, ticketType);
  const w = window.open("", "_blank", "width=360,height=640");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

/** 结账单（兼容旧调用：printOrder 曾是小票名） */
export const printReceipt = (order: any) => printOrder(order, "receipt");

/** 加菜单 */
export const printAddition = (order: any) => printOrder(order, "addition");

/** 底部总额与逐行小计的差额（折扣/改价时为负数；需要提示时使用） */
export function ticketMismatch(order: any): number {
  return round2(orderComputedTotal(order) - orderTotal(order));
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
