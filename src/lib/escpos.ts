import type { ReceiptSettings } from "../types/menu";

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

function pickTitles(
  item: { name?: string; enTitle?: string; frTitle?: string },
  langs: string[],
): string[] {
  const set = langs?.length ? langs : ["zh", "en"];
  const titles: string[] = [];
  if (set.includes("zh") && item.name) titles.push(item.name);
  if (set.includes("en") && item.enTitle) titles.push(item.enTitle);
  if (set.includes("fr") && item.frTitle) titles.push(item.frTitle);
  const unique = [...new Set(titles.filter(Boolean))];
  if (unique.length === 0 && item.name) unique.push(item.name);
  return unique;
}

export function buildOrderTicket(
  order: any,
  receiptSettings: ReceiptSettings | undefined,
  ticketType: "kitchen" | "addition" | "receipt",
  currency = "MAD",
  opts: EscPosOptions = {},
): Uint8Array {
  const width = opts.width || 48;
  const langs = receiptSettings?.printLanguages || ["zh", "en"];
  const storeName = receiptSettings?.storeName || "炙·双味居";
  const isKitchen = ticketType === "kitchen" || ticketType === "addition";
  const isAddition = ticketType === "addition";

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
  b.line("-".repeat(Math.max(20, Math.floor(width / 2))));

  b.align("left");
  b.line(`桌号/顾客: ${order.customerName || order.customer_name || "未填写"}`);
  b.line(`订单号: ${order.orderNumber || order.id || order._id || ""}`);
  if (receiptSettings?.showDate !== false) {
    const d = order.timestamp
      ? new Date(order.timestamp).toLocaleString()
      : new Date().toLocaleString();
    b.line(`时间: ${d}`);
  }
  b.line("-".repeat(Math.max(20, Math.floor(width / 2))));

  const renderItems = (items: any[]) => {
    const grouped = new Map<string, { title: string; qty: number }>();
    for (const it of items || []) {
      const key = it.id || it.name || JSON.stringify(it);
      const title = pickTitles(it, langs)[0] || it.name || "";
      const qty = Number(it.quantity || 1);
      const prev = grouped.get(key);
      if (prev) prev.qty += qty;
      else grouped.set(key, { title, qty });
    }
    for (const g of grouped.values()) {
      const line = `  ${g.qty}x ${g.title}`;
      for (const seg of wrapLine(line, width)) b.line(seg);
    }
  };

  if (isAddition) {
    renderItems(order.items);
  } else if (isKitchen) {
    const original = (order.items || []).filter((i: any) => !i.isAdded);
    const added = (order.items || []).filter((i: any) => i.isAdded);
    renderItems(original);
    if (added.length > 0) {
      b.line("-".repeat(Math.max(20, Math.floor(width / 2))));
      b.line("--- 加菜 / Additions ---");
      renderItems(added);
    }
  } else {
    renderItems(order.items);
  }

  if (!isKitchen) {
    b.line("-".repeat(Math.max(20, Math.floor(width / 2))));
    b.line(`原价: ${currency}${order.total || 0}`);
    if (order.discountAmount)
      b.line(`折扣: -${currency}${order.discountAmount}`);
    if (order.finalTotal !== undefined)
      b.line(`应收: ${currency}${order.finalTotal}`);
    if (order.paymentMethod) b.line(`支付方式: ${order.paymentMethod}`);
    if (order.receivedAmount !== undefined)
      b.line(`实收: ${currency}${order.receivedAmount}`);
    if (order.changeAmount !== undefined && order.changeAmount > 0)
      b.line(`找零: ${currency}${order.changeAmount}`);
  }

  if (order.notes) {
    b.line("-".repeat(Math.max(20, Math.floor(width / 2))));
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
