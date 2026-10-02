import { fmtDateTime, fmtMoney } from "./format";
import {
  itemQty,
  itemRevenue,
  orderItems,
  orderTotal,
  tableName,
} from "./analytics";

/** 轻量小票打印（老板端只读，简单浏览器打印） */
export function printOrder(order: any) {
  const rows = orderItems(order)
    .map(
      (it: any) =>
        `<tr><td>${String(it?.name || it?.title || "")}</td><td style="text-align:center">x${itemQty(it)}</td><td style="text-align:right">${fmtMoney(itemRevenue(it))}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>小票</title>
  <style>
    body{font-family:system-ui,sans-serif;width:280px;margin:0 auto;padding:10px;color:#000}
    h1{font-size:16px;text-align:center;margin:4px 0}
    .m{font-size:11px;color:#555;text-align:center;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    td{padding:3px 0;border-bottom:1px dashed #ccc}
    .total{font-size:16px;font-weight:bold;text-align:right;margin-top:10px}
  </style></head><body>
  <h1>${tableName(order)}</h1>
  <div class="m">${fmtDateTime(order?.timestamp || order?.created_at)} · ${order?.orderNumber || ""}</div>
  <table>${rows}</table>
  <div class="total">合计 ${fmtMoney(orderTotal(order))}</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=360,height=640");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
