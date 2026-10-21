import { chatLLMVision, hasLlm } from "./llm";

export type ReceiptDocumentType =
  "invoice" | "receipt" | "handwritten" | "unknown";

export interface ReceiptItemDraft {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  confidence: number;
}

export interface ReceiptDraft {
  documentType: ReceiptDocumentType;
  supplier: string;
  invoiceNumber: string;
  date: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  items: ReceiptItemDraft[];
  confidence: number;
  notes: string;
}

export const RECEIPT_DOC_LABEL: Record<ReceiptDocumentType, string> = {
  invoice: "发票",
  receipt: "小票",
  handwritten: "手写收据",
  unknown: "未知票据",
};

export const RECEIPT_SYSTEM_PROMPT = `你是餐饮采购票据识别器。输入可能是增值税发票、收银小票或手写收据，可能倾斜、有阴影、有多张。
只提取图片中明确可见的信息，不猜测、不补全。
严格输出一个 JSON 对象，不要 Markdown，不要代码块，不要解释。字段必须完整：
{
  "documentType": "invoice" | "receipt" | "handwritten" | "unknown",
  "supplier": "供应商/商户名称",
  "invoiceNumber": "发票号或小票号",
  "date": "YYYY-MM-DD",
  "currency": "CNY",
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "items": [
    {
      "name": "原料名称",
      "quantity": 0,
      "unit": "kg/斤/箱/包/个",
      "unitPrice": 0,
      "amount": 0,
      "confidence": 0
    }
  ],
  "confidence": 0,
  "notes": "无法归入字段的可见信息"
}
规则：
1. 金额单位为元，去掉 ¥、￥、$ 和千分位逗号，只用数字；未知金额用 null。
2. items 必须逐行提取商品，不要把“合计/小计/税额/优惠”当作商品行。
3. amount 是行金额；unitPrice 是单价；quantity 是票据显示的数量。
4. 看不清的字符串用空字符串，看不清的数字用 null；禁止编造。
5. confidence 与每项 confidence 使用 0~1 的小数，表示识别把握。
6. 金额以票面总额为准；票面无明细时 items 可以为空，但不要虚构商品。
7. 只输出 JSON。`;

export const RECEIPT_USER_PROMPT =
  "请识别这些采购票据，并按固定 JSON 模式输出。";

const DOC_TYPES = new Set<ReceiptDocumentType>([
  "invoice",
  "receipt",
  "handwritten",
  "unknown",
]);

const MAX_ITEMS = 100;

const round2 = (n: number) => Math.round(n * 100) / 100;

function cleanText(value: unknown, max = 200): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function money(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[¥￥$,，\s]/g, ""));
  return Number.isFinite(n) ? round2(Math.max(0, n)) : 0;
}

function confidence(value: unknown): number {
  let n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) n /= 100;
  return Math.min(1, Math.max(0, n));
}

function cleanDate(value: unknown): string {
  const s = cleanText(value, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d
    ? s
    : "";
}

function normalizeDocumentType(value: unknown): ReceiptDocumentType {
  const s = cleanText(value, 20).toLowerCase();
  return DOC_TYPES.has(s as ReceiptDocumentType)
    ? (s as ReceiptDocumentType)
    : "unknown";
}

function parseItem(value: unknown): ReceiptItemDraft | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const name = cleanText(o.name, 80);
  if (!name) return null;
  const unit = cleanText(o.unit, 12);
  let quantity = money(o.quantity);
  const unitPrice = money(o.unitPrice);
  let amount = money(o.amount);
  if (!quantity && amount > 0 && unitPrice > 0) {
    quantity = Math.round((amount / unitPrice) * 1000) / 1000;
  }
  if (!amount && quantity > 0 && unitPrice > 0) {
    amount = round2(quantity * unitPrice);
  }
  return {
    name,
    quantity,
    unit,
    unitPrice,
    amount,
    confidence: confidence(o.confidence),
  };
}

export type ReceiptParseResult =
  { ok: true; draft: ReceiptDraft } | { ok: false; error: string };

export function parseReceiptDraft(raw: string): ReceiptParseResult {
  if (!raw || !raw.trim()) return { ok: false, error: "AI 未返回识别结果" };
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { ok: false, error: "AI 返回内容不是 JSON 对象" };
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "AI 返回的 JSON 无法解析" };
  }

  const rawItems = Array.isArray(obj.items)
    ? obj.items.slice(0, MAX_ITEMS)
    : [];
  const items = rawItems
    .map(parseItem)
    .filter((item): item is ReceiptItemDraft => Boolean(item));
  if (!items.length) {
    return { ok: false, error: "未识别到可入库的采购明细，请拍清晰一些" };
  }

  const total =
    money(obj.total) ||
    round2(
      items.reduce(
        (sum, item) => sum + (item.amount || item.quantity * item.unitPrice),
        0,
      ),
    );

  return {
    ok: true,
    draft: {
      documentType: normalizeDocumentType(obj.documentType),
      supplier: cleanText(obj.supplier, 100),
      invoiceNumber: cleanText(obj.invoiceNumber, 80),
      date: cleanDate(obj.date),
      currency: cleanText(obj.currency, 8) || "CNY",
      subtotal: money(obj.subtotal),
      tax: money(obj.tax),
      total,
      items,
      confidence: confidence(obj.confidence),
      notes: cleanText(obj.notes, 500),
    },
  };
}

export function receiptWarnings(draft: ReceiptDraft): string[] {
  const out: string[] = [];
  if (!draft.supplier) out.push("未识别到供应商，请手工补充");
  if (!draft.date) out.push("未识别到开票日期，将按今天入库");
  if (draft.documentType === "unknown") out.push("票据类型不明确，请确认图片");
  if (draft.confidence < 0.65) {
    out.push("整体识别把握偏低，请逐项核对");
  }
  const lineSum = round2(
    draft.items.reduce(
      (sum, item) => sum + (item.amount || item.quantity * item.unitPrice),
      0,
    ),
  );
  if (
    draft.total > 0 &&
    lineSum > 0 &&
    Math.abs(draft.total - lineSum) > Math.max(0.05, draft.total * 0.01)
  ) {
    out.push(
      `票面总额 ${draft.total.toFixed(2)} 与明细合计 ${lineSum.toFixed(2)} 不一致`,
    );
  }
  const low = draft.items.filter((item) => item.confidence < 0.6).length;
  if (low) out.push(`${low} 项明细识别把握偏低，请重点核对`);
  return out;
}

export interface NameMatch {
  id: string;
  name: string;
  score: number;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, "")
    .replace(/[\s\-_/\\.,，。:：;；'"“”‘’*×x]/g, "")
    .trim();
}

function bigrams(value: string): string[] {
  if (value.length < 2) return value ? [value] : [];
  const out: string[] = [];
  for (let i = 0; i < value.length - 1; i++) out.push(value.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const aa = bigrams(a);
  const bb = bigrams(b);
  if (!aa.length || !bb.length) return 0;
  const bag = new Map<string, number>();
  bb.forEach((x) => bag.set(x, (bag.get(x) || 0) + 1));
  let hit = 0;
  aa.forEach((x) => {
    const n = bag.get(x) || 0;
    if (n > 0) {
      hit += 1;
      bag.set(x, n - 1);
    }
  });
  return (2 * hit) / (aa.length + bb.length);
}

export function matchInventoryItem(
  name: string,
  items: { id: string; name: string }[],
  threshold = 0.55,
): NameMatch | null {
  const needle = normalizeName(name);
  if (!needle) return null;
  let best: NameMatch | null = null;
  for (const item of items) {
    const target = normalizeName(item.name);
    if (!target) continue;
    let score = dice(needle, target);
    if (needle === target) score = 1;
    else if (needle.includes(target) || target.includes(needle)) {
      const ratio =
        Math.min(needle.length, target.length) /
        Math.max(needle.length, target.length);
      score = Math.max(score, 0.8 + ratio * 0.15);
    }
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: item.id, name: item.name, score };
    }
  }
  return best;
}

export type ReceiptRecognition =
  { ok: true; draft: ReceiptDraft } | { ok: false; error: string };

export async function recognizeReceipt(
  images: string[],
): Promise<ReceiptRecognition> {
  if (!images.length) return { ok: false, error: "请先拍照或上传票据" };
  if (!hasLlm()) {
    return {
      ok: false,
      error: "请先在「设置 → AI 服务」配置支持图片输入的模型",
    };
  }
  const text = await chatLLMVision(
    RECEIPT_SYSTEM_PROMPT,
    RECEIPT_USER_PROMPT,
    images.slice(0, 4),
    { timeoutMs: 90000, maxTokens: 3000 },
  );
  if (!text) {
    return {
      ok: false,
      error: "AI 识别失败：检查模型是否支持图片、API 地址与 Key",
    };
  }
  return parseReceiptDraft(text);
}
