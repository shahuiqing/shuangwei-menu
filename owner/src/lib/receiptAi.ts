import { chatLLMVision, hasLlm } from "./llm";

export type ReceiptDocumentType =
  "invoice" | "receipt" | "handwritten" | "unknown";

export interface ReceiptItemDraft {
  name: string;
  /** 票面原文为外文时的中文译名；中文票据为空 */
  nameZh: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  confidence: number;
}

export interface ReceiptDraft {
  documentType: ReceiptDocumentType;
  /** 票面文字语言，如 中文 / 英文 / 日文 */
  sourceLanguage: string;
  supplier: string;
  /** 外文供应商的中文译名；中文票据为空 */
  supplierZh: string;
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
  "sourceLanguage": "票面文字语言，如 中文/英文/日文/韩文/西班牙文",
  "supplier": "供应商/商户名称（保留票面原文）",
  "supplierZh": "供应商中文译名；票面原文为中文时为空字符串",
  "invoiceNumber": "发票号或小票号",
  "date": "YYYY-MM-DD",
  "currency": "CNY",
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "items": [
    {
      "name": "原料名称（保留票面原文）",
      "nameZh": "原料中文译名；票面原文为中文时为空字符串",
      "quantity": 0,
      "unit": "kg/斤/箱/包/个",
      "unitPrice": 0,
      "amount": 0,
      "confidence": 0
    }
  ],
  "confidence": 0,
  "notes": "影响核对的重要备注（仅折扣、退货、模糊字段）；没有则空字符串"
}
规则：
1. 金额单位为元，去掉 ¥、￥、$ 和千分位逗号，只用数字；未知金额用 null。
2. items 必须逐行提取商品，不要把“合计/小计/税额/优惠”当作商品行。
3. amount 是行金额；unitPrice 是单价；quantity 是票据显示的数量。
4. 看不清的字符串用空字符串，看不清的数字用 null；禁止编造。
5. confidence 与每项 confidence 使用 0~1 的小数，表示识别把握。
6. 金额以票面总额为准；票面无明细时 items 可以为空，但不要虚构商品。
7. notes 仅在存在折扣、退货、模糊字段等影响核对的信息时填写；票面提示语、商家声明、地址、电话一律不写入，没有则用空字符串。
8. 票面不是中文时，supplier 和 name 必须保留票面原文，同时在 supplierZh 和 nameZh 给出准确、简短的简体中文译名。
9. 中文票据的 supplierZh 与所有 nameZh 一律为空字符串；翻译不得改变数量、单价、金额和单位，不要意译品牌名。
10. 只输出 JSON。`;

export const RECEIPT_USER_PROMPT =
  "请识别这些采购票据；非中文票据保留原文并附中文译名，按固定 JSON 模式输出。";

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
    nameZh: cleanText(o.nameZh, 80),
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
      sourceLanguage: cleanText(obj.sourceLanguage, 30),
      supplier: cleanText(obj.supplier, 100),
      supplierZh: cleanText(obj.supplierZh, 100),
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

const CHINESE_LANGUAGE = /中文|汉语|普通话|chinese|mandarin|^zh(?:[-_]|$)/i;

const LANGUAGE_LABELS: Record<string, string> = {
  zh: "中文",
  cn: "中文",
  en: "英文",
  english: "英文",
  ja: "日文",
  jp: "日文",
  japanese: "日文",
  ko: "韩文",
  kr: "韩文",
  korean: "韩文",
  es: "西班牙文",
  spanish: "西班牙文",
  fr: "法文",
  french: "法文",
  de: "德文",
  german: "德文",
  it: "意大利文",
  italian: "意大利文",
  pt: "葡萄牙文",
  portuguese: "葡萄牙文",
  ru: "俄文",
  russian: "俄文",
  th: "泰文",
  thai: "泰文",
  vi: "越南文",
  vietnamese: "越南文",
  ar: "阿拉伯文",
  arabic: "阿拉伯文",
  tr: "土耳其文",
  turkish: "土耳其文",
};

export function receiptLanguageLabel(language: string): string {
  const value = cleanText(language, 30);
  if (!value) return "";
  if (CHINESE_LANGUAGE.test(value)) return "中文";
  const key = value.toLowerCase().split(/[-_\s(]/)[0];
  return LANGUAGE_LABELS[key] || value;
}

export function isNonChineseReceipt(
  draft: Pick<ReceiptDraft, "sourceLanguage">,
): boolean {
  const language = draft.sourceLanguage.trim();
  if (!language) return false;
  if (/^(unknown|未知|other|其他|n\/a)$/i.test(language)) return false;
  return !CHINESE_LANGUAGE.test(language);
}

export function hasReceiptTranslation(
  draft: Pick<ReceiptDraft, "supplierZh" | "items">,
): boolean {
  return Boolean(draft.supplierZh) || draft.items.some((item) => item.nameZh);
}

export function receiptWarnings(draft: ReceiptDraft): string[] {
  const out: string[] = [];
  if (!draft.supplier) out.push("未识别到供应商，请手工补充");
  if (!draft.date) out.push("未识别到开票日期，将按今天入库");
  if (draft.documentType === "unknown") out.push("票据类型不明确，请确认图片");
  if (draft.confidence < 0.65) {
    out.push("整体识别把握偏低，请逐项核对");
  }
  if (isNonChineseReceipt(draft)) {
    const missing = draft.items.filter((item) => !item.nameZh).length;
    if (!hasReceiptTranslation(draft)) {
      out.push("非中文票据未返回中文翻译，请按原文核对");
    } else if (missing > 0) {
      out.push(`非中文票据有 ${missing} 项明细缺少中文翻译，请对照原文`);
    }
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

export function matchInventoryItemAny(
  names: string[],
  items: { id: string; name: string }[],
  threshold = 0.55,
): NameMatch | null {
  let best: NameMatch | null = null;
  for (const name of names) {
    const needle = normalizeName(name);
    if (!needle) continue;
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
  }
  return best;
}

export function matchInventoryItem(
  name: string,
  items: { id: string; name: string }[],
  threshold = 0.55,
): NameMatch | null {
  return matchInventoryItemAny([name], items, threshold);
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
