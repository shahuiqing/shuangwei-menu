// P1-8 修复：打印前转义，防止顾客名/备注 XSS 注入 innerHTML
function escHtml(s: any) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}

export type TicketType = "kitchen" | "addition" | "receipt";

// ---------------------------------------------------------------------------
// 金额口径（唯一的真相来源）
//
// 一张单据上的金额必须满足：逐菜小计之和 == 底部总额。
// 历史 bug：加菜单（addition）被当成厨房单处理，把所有金额都隐藏了，
// 导致「加了口味（配菜）的单子不显示加的价格」；同时底部「原价」直接用了
// 调用方传进来的 order.total（加菜场景传的是加菜金额，不是整单总额），
// 与逐菜小计不是同一口径。
// 这里统一成：菜品单价 + 配菜单价，再乘数量。
// ---------------------------------------------------------------------------

/** 容差：逐菜累加与订单 total 的偏差在此范围内视为一致（浮点误差） */
export const TOTALS_TOLERANCE = 0.01;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 价格归一化：接受 number / 字符串（"75"、"MAD75"、"¥75"）/ null / NaN。
 * 取字符串里第一个数字（可带小数、千分位逗号、负号），无法解析时返回 0。
 */
export function toAmount(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const m = value.replace(/[,\s]/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!m) return 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** 金额展示：去掉无意义的尾随 0（50.5 / 50 / 0） */
export function formatAmount(value: unknown): string {
  return String(round2(toAmount(value)));
}

export interface NormalizedAddon {
  id: string;
  name: string;
  price: number;
}

export interface NormalizedLine {
  id: string;
  key: string;
  name: string;
  enTitle?: string;
  frTitle?: string;
  arTitle?: string;
  maTitle?: string;
  quantity: number;
  /** 菜品单价（不含配菜） */
  unitPrice: number;
  addons: NormalizedAddon[];
  /** 每份配菜加价合计 */
  addonUnitTotal: number;
  /** (菜品单价 + 配菜单价) × 数量 */
  lineSubtotal: number;
  isAdded: boolean;
}

/**
 * 配菜归一化：老订单 items 没有 addons 字段、addons 不是数组、
 * price 是字符串 / NaN / null 都必须安全，不能抛错。
 */
export function normalizeAddons(raw: unknown): NormalizedAddon[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any, index: number) => {
      const name = String(a?.name ?? "").trim();
      const id = String(a?.id ?? name ?? index);
      return { id, name, price: toAmount(a?.price) };
    })
    .filter((a) => a.name || a.price > 0);
}

/**
 * 订单行按「菜品 + 配菜组合」分组累加数量。
 * 同一菜品选了不同口味，是两行；同菜品同口味才合并。
 */
export function buildLines(items: unknown): NormalizedLine[] {
  const list: any[] = Array.isArray(items) ? items : [];
  const grouped = new Map<string, NormalizedLine>();

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const addons = normalizeAddons(item.addons);
    const quantity = Math.max(1, Math.floor(toAmount(item.quantity) || 1));
    const unitPrice = toAmount(item.price);
    const addonKey = addons
      .map((a) => `${a.id || a.name}:${a.price}`)
      .join(",");
    const key = `${item.id || item.name || ""}|${addonKey}`;

    const prev = grouped.get(key);
    if (prev) {
      prev.quantity += quantity;
      prev.lineSubtotal =
        (prev.unitPrice + prev.addonUnitTotal) * prev.quantity;
      prev.isAdded = prev.isAdded || Boolean(item.isAdded);
      continue;
    }

    const addonUnitTotal = addons.reduce((s, a) => s + a.price, 0);
    grouped.set(key, {
      id: String(item.id ?? item.name ?? key),
      key,
      name: String(item.name ?? ""),
      ...(item.enTitle ? { enTitle: String(item.enTitle) } : {}),
      ...(item.frTitle ? { frTitle: String(item.frTitle) } : {}),
      ...(item.arTitle ? { arTitle: String(item.arTitle) } : {}),
      ...(item.maTitle ? { maTitle: String(item.maTitle) } : {}),
      quantity,
      unitPrice,
      addons,
      addonUnitTotal,
      lineSubtotal: (unitPrice + addonUnitTotal) * quantity,
      isAdded: Boolean(item.isAdded),
    });
  }

  return [...grouped.values()];
}

/** 逐菜累加（含配菜加价）得到的总额 */
export function computedTotal(items: unknown): number {
  return buildLines(items).reduce((s, line) => s + line.lineSubtotal, 0);
}

export interface ResolvedTotals {
  /** 逐菜小计之和（含配菜加价）—— 与单据上打印的每一行严格一致 */
  computedTotal: number;
  /** 校验通过时等于 order.total，否则等于 computedTotal */
  total: number;
  /** 是否为加菜/部分单据（items 少于整单个数、或调用方标记 partial） */
  isPartial: boolean;
  /** 调用方传入的原始 total */
  declaredTotal: number | null;
  /** declaredTotal 与 computedTotal 是否不一致 */
  mismatch: boolean;
}

/**
 * 订单金额口径裁决。
 *
 * - computedTotal 永远按「(菜品单价 + 配菜单价) × 数量」逐行累加；
 * - order.total 存在且与 computedTotal 偏差在 TOTALS_TOLERANCE 以内时采用 order.total；
 * - 否则以 computedTotal 为准，并置 mismatch = true。
 *
 * 这样「逐菜加起来 != 底部总额」永远不会在单据上出现。
 *
 * options.itemCount：原始 items 的条数。若 items 已被调用方过滤（例如加菜单只传加菜行），
 * itemCount 大于打印出的分组行数/分组后数量，说明只是整单的一部分，应标记 isPartial。
 */
export function resolveOrderTotals(
  order: any,
  options: { itemCount?: number; partial?: boolean } = {},
): ResolvedTotals {
  const rawItems: any[] = Array.isArray(order?.items) ? order.items : [];
  const computed = round2(computedTotal(rawItems));

  const declaredRaw = order?.total ?? order?.total_amount;
  const declaredTotal =
    declaredRaw === null || declaredRaw === undefined || declaredRaw === ""
      ? null
      : toAmount(declaredRaw);

  const printedQty = buildLines(rawItems).reduce((s, l) => s + l.quantity, 0);
  const originalQty = rawItems.reduce(
    (s, i) => s + Math.max(1, Math.floor(toAmount(i?.quantity) || 1)),
    0,
  );
  const expectedCount =
    typeof options.itemCount === "number" ? options.itemCount : rawItems.length;
  const isPartial =
    Boolean(options.partial) ||
    expectedCount > rawItems.length ||
    printedQty < originalQty;

  const mismatch =
    declaredTotal !== null &&
    !isPartial &&
    Math.abs(declaredTotal - computed) > TOTALS_TOLERANCE;

  return {
    computedTotal: computed,
    total:
      declaredTotal !== null && !mismatch && !isPartial
        ? declaredTotal
        : computed,
    isPartial,
    declaredTotal,
    mismatch,
  };
}

/** 按打印语言挑出菜品标题（去重，保底用 name） */
export function pickItemTitles(
  item: Partial<NormalizedLine>,
  langs: string[] | undefined,
): string[] {
  const set = langs?.length ? langs : ["zh", "en", "fr", "ar", "ma"];
  const titles: string[] = [];
  const zh = (item as any).name;
  if (set.includes("zh") && zh) titles.push(zh);
  if (set.includes("en") && item.enTitle) titles.push(item.enTitle);
  if (set.includes("fr") && item.frTitle) titles.push(item.frTitle);
  if (set.includes("ar") && item.arTitle) titles.push(item.arTitle);
  if (set.includes("ma") && item.maTitle) titles.push(item.maTitle);
  const unique = [...new Set(titles.filter(Boolean))];
  if (unique.length === 0 && zh) unique.push(zh);
  return unique;
}

/** 单据渲染模式：决定是否显示金额、是否展示「加菜」分段 */
export interface TicketLayout {
  /** true = 后厨单，不显示任何金额 */
  isKitchen: boolean;
  /** true = 加菜单（即使被当作厨房单也必须显示金额） */
  isAddition: boolean;
  /** true = 结账单 / 小票 */
  isReceipt: boolean;
  /** 是否显示金额（含配菜 +价、行小计、底部合计） */
  showAmounts: boolean;
}

/**
 * 单据模式解析。
 *
 * 修正点：加菜单（addition）以前继承 isKitchenTicket 而隐藏金额，现在
 * isAddition 一定 showAmounts = true —— 加菜单需要让前厅/顾客看到加菜价格。
 */
export function resolveTicketLayout(
  isKitchenTicket?: boolean,
  ticketType?: TicketType | string | null,
): TicketLayout {
  const isAddition = ticketType === "addition";
  const isReceipt = ticketType === "receipt";
  const isKitchen =
    !isAddition &&
    !isReceipt &&
    (Boolean(isKitchenTicket) || ticketType === "kitchen");
  return {
    isKitchen,
    isAddition,
    isReceipt: !isKitchen && !isAddition,
    showAmounts: !isKitchen,
  };
}

export interface ReceiptRenderOptions {
  currency?: string;
  ticketType?: TicketType | string | null;
  isKitchenTicket?: boolean;
  /** 原始 items 条数；调用方传入过滤后的 items（如加菜单）时必填，用于判断 partial */
  itemCount?: number;
  partial?: boolean;
}

export interface ReceiptRender {
  html: string;
  layout: TicketLayout;
  lines: NormalizedLine[];
  totals: ResolvedTotals;
  /** 单据底部合计文案（不含金额），供测试与调用方核对口径 */
  totalLabel: string;
}

/**
 * 生成小票/厨房单/加菜单的 HTML（纯函数，不触发打印，便于单测）。
 */
export function renderReceiptHtml(
  order: any,
  receiptSettings?: any,
  options: ReceiptRenderOptions = {},
): ReceiptRender {
  const currency = options.currency || "MAD";
  const layout = resolveTicketLayout(
    options.isKitchenTicket,
    options.ticketType ?? null,
  );
  const { isKitchen, isAddition, showAmounts } = layout;

  const ordered = order || {};
  const dateStr = ordered.timestamp
    ? new Date(ordered.timestamp).toLocaleString()
    : new Date().toLocaleString();

  const orderId =
    ordered.orderNumber || "ORD-" + Math.floor(Math.random() * 1000000);

  const lines = buildLines(ordered.items);
  const totals = resolveOrderTotals(ordered, {
    itemCount: options.itemCount,
    partial: options.partial,
  });

  const langs = receiptSettings?.printLanguages;
  const renderLine = (line: NormalizedLine) => {
    const titles = pickItemTitles(line, langs);
    const addonsHtml = line.addons
      .map((a) => {
        // 加菜单/结账单都显示配菜加价；addon.price = 0（免费）不显示 +¥0
        const priceTag =
          showAmounts && a.price > 0
            ? ` +${escHtml(currency)}${escHtml(formatAmount(a.price))}`
            : "";
        return `<div dir="auto" class="addon" style="font-size:0.85em;opacity:0.85;">+ ${escHtml(a.name)}${priceTag}</div>`;
      })
      .join("");

    return `
          <div class="item">
            <div class="item-name">
              ${titles.map((t) => `<div dir="auto">${escHtml(t)}</div>`).join("")}
              ${addonsHtml}
            </div>
            <div class="item-details">
              <span class="qty">x${escHtml(line.quantity)}</span>
              ${showAmounts ? `<span class="price">${escHtml(currency)}${escHtml(formatAmount(line.lineSubtotal))}</span>` : ""}
            </div>
          </div>
        `;
  };

  const renderSection = (section: NormalizedLine[]) =>
    section.map(renderLine).join("");

  let itemsHtml = "";
  if (isAddition || !isKitchen) {
    // 加菜单与结账单：整单合并展示（加菜单调用方通常已只传入加菜行）
    itemsHtml = renderSection(lines);
  } else {
    // 整单厨房单：原单 / 加菜 分段
    const originalItems = (
      Array.isArray(ordered.items) ? ordered.items : []
    ).filter((i: any) => !i?.isAdded);
    const addedItems = (
      Array.isArray(ordered.items) ? ordered.items : []
    ).filter((i: any) => i?.isAdded);
    itemsHtml += renderSection(buildLines(originalItems));
    if (buildLines(addedItems).length > 0) {
      itemsHtml += `
          <div style="border-top: 1px dashed #000; margin: 3mm 0; text-align: center; padding: 2mm 0; font-weight: bold;">
            --- 加菜 / Additions ---
          </div>
        `;
      itemsHtml += renderSection(buildLines(addedItems));
    }
  }

  // 底部金额区
  const headerTitle = isAddition
    ? "加菜单 / Additions"
    : isKitchen
      ? "厨房单 / Kitchen Ticket"
      : receiptSettings?.storeName || "结账单 / Receipt";

  const additionLines = buildLines(
    (Array.isArray(ordered.items) ? ordered.items : []).filter(
      (i: any) => i?.isAdded,
    ),
  );
  const additionComputed = round2(
    additionLines.reduce((s, l) => s + l.lineSubtotal, 0),
  );
  const totalLabel = isAddition
    ? "加菜小计 (Addition Total)"
    : "原价 (Original)";

  const totalsHtml = showAmounts
    ? (() => {
        // 「原价/合计」一律用逐菜累加值，保证与上面每一行严格对齐
        const grand = totals.total;
        const parts: string[] = [
          `<div class="grand-total"><strong>${totalLabel}:</strong> ${escHtml(currency)}${escHtml(formatAmount(grand))}</div>`,
        ];
        // 整单小票里含加菜时，额外单列加菜合计，便于核对
        if (!isAddition && additionLines.length > 0) {
          parts.push(
            `<div class="addition-total"><strong>其中加菜 (Additions):</strong> ${escHtml(currency)}${escHtml(formatAmount(additionComputed))}</div>`,
          );
        }
        const discount = toAmount(ordered.discountAmount);
        if (discount > 0) {
          parts.push(
            `<div class="discount"><strong>折扣 (Discount):</strong> -${escHtml(currency)}${escHtml(formatAmount(discount))}</div>`,
          );
        }
        const finalTotal = ordered.finalTotal ?? ordered.total_amount;
        if (ordered.finalTotal !== undefined && finalTotal !== null) {
          parts.push(
            `<div class="final-total" style="font-size: 1.1em; font-weight: bold; margin-top: 1mm;"><strong>应收 (Total):</strong> ${escHtml(currency)}${escHtml(formatAmount(finalTotal))}</div>`,
          );
        }
        if (ordered.paymentMethod)
          parts.push(
            `<div style="margin-top: 1mm;"><strong>支付方式 (Payment):</strong> ${escHtml(ordered.paymentMethod)}</div>`,
          );
        if (ordered.receivedAmount !== undefined)
          parts.push(
            `<div><strong>实收 (Received):</strong> ${escHtml(currency)}${escHtml(formatAmount(ordered.receivedAmount))}</div>`,
          );
        const change = toAmount(ordered.changeAmount);
        if (ordered.changeAmount !== undefined && change > 0)
          parts.push(
            `<div><strong>找零 (Change):</strong> ${escHtml(currency)}${escHtml(formatAmount(change))}</div>`,
          );
        return parts.join("\n          ");
      })()
    : "";

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>打印小票 (Receipt)</title>
      <style>
        :root {
          --receipt-font-size: ${receiptSettings?.fontSize || "14px"};
          --receipt-col-width: ${receiptSettings?.columnWidth && receiptSettings?.columnWidth !== "100%" ? receiptSettings.columnWidth : "100%"};
        }
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Courier New', Courier, monospace, 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #000;
          font-size: var(--receipt-font-size);
          width: var(--receipt-col-width);
        }
        .receipt {
          padding: 5mm;
          width: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 5mm;
        }
        .header h1 {
          margin: 0 0 2mm 0;
          font-size: 1.5em;
          font-weight: bold;
        }
        .header p {
          margin: 0;
          font-size: 0.9em;
        }
        .top-logo {
          max-width: 80%;
          height: auto;
          margin-bottom: 3mm;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .bottom-logo {
          max-width: 80%;
          height: auto;
          margin-top: 3mm;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 3mm 0;
        }
        .info {
          font-size: 1em;
          margin-bottom: 3mm;
        }
        .info div {
          margin-bottom: 1mm;
        }
        .items {
          margin-bottom: 3mm;
          font-size: 1em;
          width: 100%;
        }
        .item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2mm;
          width: 100%;
        }
        .item-name {
          flex: 1;
          text-align: left;
          word-break: break-all;
          padding-right: 2mm;
        }
        .item-details {
          flex-shrink: 0;
          display: flex;
          justify-content: flex-end;
          gap: 4mm;
          min-width: 30%;
          white-space: nowrap;
        }
        .item-details .qty {
          display: inline-block;
          text-align: right;
          min-width: 20px;
        }
        .item-details .price {
          display: inline-block;
          text-align: right;
          min-width: 40px;
        }
        .total-section {
          font-size: 1.2em;
          font-weight: bold;
          text-align: right;
          margin-top: 3mm;
        }
        .footer {
          text-align: center;
          margin-top: 5mm;
          font-size: 0.9em;
        }
        
        @media print {
          @page {
            margin: 0;
            ${receiptSettings?.columnWidth && receiptSettings?.columnWidth !== "100%" ? `size: ${receiptSettings.columnWidth} auto;` : ""}
          }
          body {
            width: var(--receipt-col-width);
            margin: 0 auto;
            padding: 2mm;
          }
          .receipt {
            padding: 0;
          }
          .item {
            page-break-inside: avoid;
            margin-bottom: 3mm;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 2mm 0;
          }
          .total-section {
            border-top: 2px solid #000;
            padding-top: 2mm;
            margin-top: 2mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        ${
          receiptSettings?.topLogoUrl &&
          /^https:\/\/|^data:image\//.test(receiptSettings.topLogoUrl)
            ? `<img src="${escHtml(receiptSettings.topLogoUrl)}" class="top-logo" alt="Top Logo" />`
            : ""
        }
        ${
          receiptSettings?.showStoreName !== false
            ? `
        <div class="header">
          <h1>${escHtml(headerTitle)}</h1>
        </div>
        `
            : ""
        }
        
        <div class="info">
          <div><strong>桌号/顾客 (Table):</strong> ${escHtml(ordered.customerName || "未填写")}</div>
          <div><strong>订单号 (Order #):</strong> ${escHtml(orderId)}</div>
          ${receiptSettings?.showDate !== false ? `<div><strong>时间 (Time):</strong> ${escHtml(dateStr)}</div>` : ""}
        </div>
        
        <div class="divider"></div>
        
        <div class="items">
          ${itemsHtml}
        </div>
        
        <div class="divider"></div>
        
        ${showAmounts ? `<div class="total-section">${totalsHtml}</div>` : ""}
        
        <div class="footer">
          ${showAmounts && receiptSettings?.footerText1 ? `<p>${escHtml(receiptSettings.footerText1)}</p>` : ""}
          ${showAmounts && receiptSettings?.footerText2 ? `<p>${escHtml(receiptSettings.footerText2)}</p>` : ""}
          ${
            showAmounts && receiptSettings?.showQrCode !== false
              ? `
          <div style="margin-top: 5mm; display: flex; justify-content: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin)}" alt="Menu QR Code" style="width: 120px; height: 120px; display: block; margin: 0 auto;" />
          </div>
          <p style="font-size: 0.8em; margin-top: 2mm;">扫码查看在线菜单 (Scan to view our menu)</p>
          `
              : ""
          }
          ${
            receiptSettings?.bottomLogoUrl &&
            /^https:\/\/|^data:image\//.test(receiptSettings.bottomLogoUrl)
              ? `<img src="${escHtml(receiptSettings.bottomLogoUrl)}" class="bottom-logo" alt="Bottom Logo" />`
              : ""
          }
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, layout, lines, totals, totalLabel };
}

export const printReceipt = (
  order: any,
  currency: string = "MAD",
  receiptSettings?: any,
  isKitchenTicket?: boolean,
  ticketType?: TicketType,
) => {
  const { html } = renderReceiptHtml(order, receiptSettings, {
    currency,
    isKitchenTicket,
    ticketType: ticketType ?? null,
  });

  // Use hidden offscreen iframe to print directly in current page without opening new tab
  const existingIframe = document.getElementById("print-receipt-iframe");
  if (existingIframe && existingIframe.parentNode) {
    existingIframe.parentNode.removeChild(existingIframe);
  }

  const iframe = document.createElement("iframe");
  iframe.id = "print-receipt-iframe";
  iframe.style.position = "absolute";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }

  setTimeout(() => {
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    } catch (e) {
      console.error("Print failed:", e);
      alert("打印失败，请重试");
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 300);
};
