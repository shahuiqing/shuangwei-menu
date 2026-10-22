import type { ReceiptSettings } from "../types/menu";
import {
  buildLines,
  formatAmount,
  pickItemTitles,
  resolveOrderTotals,
  resolveTicketLayout,
  toAmount,
  type NormalizedLine,
  type TicketType,
} from "./print";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const utf8 = new TextEncoder();

export interface EscPosOptions {
  width?: number;
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];

  private push(bytes: Uint8Array | number[]): this {
    this.chunks.push(
      bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes),
    );
    return this;
  }

  raw(...bytes: number[]): this {
    return this.push(bytes);
  }

  text(s: string): this {
    return this.push(utf8.encode(String(s ?? "")));
  }

  init(): this {
    return this.raw(ESC, 0x40);
  }

  cut(mode: "partial" | "full" = "partial"): this {
    return mode === "full"
      ? this.raw(GS, 0x56, 0x00)
      : this.raw(GS, 0x56, 0x42, 0x00);
  }

  feed(n = 1): this {
    return this.raw(ESC, 0x64, Math.max(0, Math.min(255, n)));
  }

  align(a: "left" | "center" | "right"): this {
    const v = a === "center" ? 1 : a === "right" ? 2 : 0;
    return this.raw(ESC, 0x61, v);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  underline(on: boolean): this {
    return this.raw(ESC, 0x2d, on ? 1 : 0);
  }

  size(w: number, h: number): this {
    const cw = Math.max(1, Math.min(8, w));
    const ch = Math.max(1, Math.min(8, h));
    return this.raw(GS, 0x21, ((cw - 1) << 4) | (ch - 1));
  }

  line(s = ""): this {
    return this.text(s).raw(LF);
  }

  bytes(): Uint8Array {
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}

const charWidth = (ch: string): number => {
  const code = ch.codePointAt(0) || 0;
  if (code <= 0x7f) return 1;
  if (code >= 0x2000 && code <= 0x206f) return 1;
  return 2;
};

const measure = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + charWidth(ch), 0);

function wrapLine(s: string, width: number): string[] {
  if (width <= 0 || measure(s) <= width) return [s];
  const out: string[] = [];
  let cur = "";
  let curW = 0;
  for (const ch of Array.from(s)) {
    const w = charWidth(ch);
    if (curW + w > width) {
      out.push(cur);
      cur = ch;
      curW = w;
    } else {
      cur += ch;
      curW += w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function buildOrderTicket(
  order: any,
  receiptSettings: ReceiptSettings | undefined,
  ticketType: TicketType,
  currency = "MAD",
  opts: EscPosOptions = {},
  renderOptions: { itemCount?: number; partial?: boolean } = {},
): Uint8Array {
  const width = opts.width || 48;
  const langs = receiptSettings?.printLanguages || ["zh", "en"];
  const storeName = receiptSettings?.storeName || "炙·双味居";
  // 与 print.ts 同一口径：加菜单（addition）必须显示金额，厨房单不显示
  const { isKitchen, isAddition, showAmounts } = resolveTicketLayout(
    undefined,
    ticketType,
  );

  const separator = () =>
    b.line("-".repeat(Math.max(20, Math.floor(width / 2))));
  const printRow = (left: string, right: string) => {
    if (!right) {
      for (const seg of wrapLine(left, width)) b.line(seg);
      return;
    }
    const segs = wrapLine(left, Math.max(1, width - measure(right) - 1));
    segs.forEach((seg, idx) => {
      if (idx === segs.length - 1) {
        const pad = Math.max(1, width - measure(seg) - measure(right));
        b.line(seg + " ".repeat(pad) + right);
      } else {
        b.line(seg);
      }
    });
  };

  const b = new EscPosBuilder();
  b.init().align("center");

  b.size(1, 1).bold(true).line(storeName).bold(false);
  b.line(
    isAddition
      ? "加菜单 / Additions"
      : isKitchen
        ? "厨房单 / Kitchen"
        : "结账单 / Receipt",
  );
  separator();

  b.align("left");
  b.line(
    `桌号/顾客: ${order?.customerName || order?.customer_name || "未填写"}`,
  );
  b.line(`订单号: ${order?.orderNumber || order?.id || order?._id || ""}`);
  if (receiptSettings?.showDate !== false) {
    const d = order?.timestamp
      ? new Date(order.timestamp).toLocaleString()
      : new Date().toLocaleString();
    b.line(`时间: ${d}`);
  }
  separator();

  const renderLines = (lines: NormalizedLine[]) => {
    for (const line of lines) {
      const title = pickItemTitles(line, langs)[0] || line.name || "";
      printRow(
        `  ${line.quantity}x ${title}`,
        showAmounts ? `${currency}${formatAmount(line.lineSubtotal)}` : "",
      );
      for (const a of line.addons) {
        // 免费配菜（price = 0）不打印 +0
        printRow(
          `      + ${a.name}`,
          showAmounts && a.price > 0
            ? `+${currency}${formatAmount(a.price)}`
            : "",
        );
      }
    }
  };

  const allItems: any[] = Array.isArray(order?.items) ? order.items : [];

  if (isAddition || !isKitchen) {
    // 加菜单 / 结账单：整单合并（加菜单调用方通常只传加菜行）
    renderLines(buildLines(allItems));
  } else {
    // 整单厨房单：原单 / 加菜 分段
    const original = allItems.filter((i: any) => !i?.isAdded);
    const added = allItems.filter((i: any) => i?.isAdded);
    renderLines(buildLines(original));
    if (buildLines(added).length > 0) {
      separator();
      b.line("--- 加菜 / Additions ---");
      renderLines(buildLines(added));
    }
  }

  if (showAmounts) {
    const totals = resolveOrderTotals(order, {
      itemCount: renderOptions.itemCount,
      partial: renderOptions.partial,
    });
    separator();
    b.line(
      `${isAddition ? "加菜小计" : "原价"}: ${currency}${formatAmount(totals.total)}`,
    );
    const discount = toAmount(order?.discountAmount);
    if (discount > 0) b.line(`折扣: -${currency}${formatAmount(discount)}`);
    if (order?.finalTotal !== undefined && order?.finalTotal !== null)
      b.line(`应收: ${currency}${formatAmount(order.finalTotal)}`);
    if (order?.paymentMethod) b.line(`支付方式: ${order.paymentMethod}`);
    if (order?.receivedAmount !== undefined)
      b.line(`实收: ${currency}${formatAmount(order.receivedAmount)}`);
    const change = toAmount(order?.changeAmount);
    if (order?.changeAmount !== undefined && change > 0)
      b.line(`找零: ${currency}${formatAmount(change)}`);
  }

  if (order?.notes) {
    separator();
    b.line(`备注: ${order.notes}`);
  }

  b.feed(2).cut("partial");
  return b.bytes();
}

export function buildTestTicket(
  receiptSettings: ReceiptSettings | undefined,
  opts: EscPosOptions = {},
): Uint8Array {
  const order = {
    customerName: "测试桌台",
    orderNumber: "TEST-0001",
    timestamp: new Date().toISOString(),
    items: [
      { name: "羊肉串", enTitle: "Cumin Lamb Skewer", quantity: 2, price: 50 },
      { name: "牛肉", enTitle: "Garlic Butter Beef", quantity: 1, price: 80 },
    ],
    total: 180,
  };
  return buildOrderTicket(order, receiptSettings, "receipt", "MAD", opts);
}

/** 将票据字节解码为可断言的文本（UTF-8，控制字符转为可读标记） */
export function ticketToText(bytes: Uint8Array): string {
  let text = "";
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    text = Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");
  }
  return text
    .replace(/\u001b[@aEd-]\d?/g, "")
    .replace(/\u001dV[\u0000-\u0042]/g, "");
}
