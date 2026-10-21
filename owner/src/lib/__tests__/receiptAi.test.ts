import { describe, expect, it } from "vitest";
import {
  hasReceiptTranslation,
  isNonChineseReceipt,
  matchInventoryItem,
  matchInventoryItemAny,
  parseReceiptDraft,
  receiptLanguageLabel,
  receiptWarnings,
  RECEIPT_SYSTEM_PROMPT,
  type ReceiptDraft,
} from "../receiptAi";

const base = {
  documentType: "receipt",
  sourceLanguage: "中文",
  supplier: "鲜丰蔬菜",
  supplierZh: "",
  invoiceNumber: "NO-001",
  date: "2026-10-20",
  currency: "CNY",
  subtotal: 100,
  tax: 0,
  total: 100,
  items: [
    {
      name: "土豆",
      nameZh: "",
      quantity: 10,
      unit: "kg",
      unitPrice: 8,
      amount: 80,
      confidence: 0.95,
    },
    {
      name: "牛肉",
      nameZh: "",
      quantity: 2,
      unit: "kg",
      unitPrice: 10,
      amount: 20,
      confidence: 0.9,
    },
  ],
  confidence: 0.92,
  notes: "",
};

describe("parseReceiptDraft", () => {
  it("解析纯 JSON 与 Markdown 代码块", () => {
    const raw = `\`\`\`json\n${JSON.stringify(base)}\n\`\`\``;
    const r = parseReceiptDraft(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.supplier).toBe("鲜丰蔬菜");
    expect(r.draft.documentType).toBe("receipt");
    expect(r.draft.items).toHaveLength(2);
    expect(r.draft.total).toBe(100);
  });

  it("解析非中文票据的语言与中文译名", () => {
    const r = parseReceiptDraft(
      JSON.stringify({
        ...base,
        sourceLanguage: "English",
        supplier: "ABC Foods",
        supplierZh: "ABC 食品",
        items: [
          {
            name: "Beef",
            nameZh: "牛肉",
            quantity: 2,
            unit: "kg",
            unitPrice: 10,
            amount: 20,
            confidence: 0.9,
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.sourceLanguage).toBe("English");
    expect(r.draft.supplierZh).toBe("ABC 食品");
    expect(r.draft.items[0].nameZh).toBe("牛肉");
  });

  it("缺少翻译字段时回落为空字符串", () => {
    const r = parseReceiptDraft(
      JSON.stringify({
        ...base,
        sourceLanguage: undefined,
        supplierZh: undefined,
        items: [{ ...base.items[0], nameZh: undefined }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.sourceLanguage).toBe("");
    expect(r.draft.supplierZh).toBe("");
    expect(r.draft.items[0].nameZh).toBe("");
  });

  it("从金额与单价反推数量，从数量与单价补齐金额", () => {
    const r = parseReceiptDraft(
      JSON.stringify({
        ...base,
        total: 80,
        items: [
          { name: "土豆", unit: "kg", amount: 80, unitPrice: 8 },
          { name: "牛肉", unit: "kg", quantity: 2, unitPrice: 10 },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.items[0].quantity).toBe(10);
    expect(r.draft.items[1].amount).toBe(20);
  });

  it("总额缺失时用明细合计兜底", () => {
    const r = parseReceiptDraft(
      JSON.stringify({ ...base, total: null, subtotal: null }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.total).toBe(100);
  });

  it("过滤空明细；没有明细时拒绝", () => {
    const r = parseReceiptDraft(
      JSON.stringify({ ...base, items: [{ name: "  " }, { amount: 1 }] }),
    );
    expect(r.ok).toBe(false);
  });

  it("坏 JSON / 非对象 / 空文本均拒绝", () => {
    expect(parseReceiptDraft("").ok).toBe(false);
    expect(parseReceiptDraft("not json").ok).toBe(false);
    expect(parseReceiptDraft("{oops").ok).toBe(false);
    expect(parseReceiptDraft("[]").ok).toBe(false);
  });

  it("未知票种回落 unknown，confidence 兼容百分数并夹紧", () => {
    const r = parseReceiptDraft(
      JSON.stringify({
        ...base,
        documentType: "weird",
        confidence: 87,
        items: [{ ...base.items[0], confidence: 130 }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.documentType).toBe("unknown");
    expect(r.draft.confidence).toBe(0.87);
    expect(r.draft.items[0].confidence).toBe(1);
  });

  it("日期格式或日期本身非法时置空", () => {
    const slash = parseReceiptDraft(
      JSON.stringify({ ...base, date: "2026/10/20" }),
    );
    expect(slash.ok).toBe(true);
    if (!slash.ok) return;
    expect(slash.draft.date).toBe("");
    const impossible = parseReceiptDraft(
      JSON.stringify({ ...base, date: "2026-02-31" }),
    );
    expect(impossible.ok).toBe(true);
    if (!impossible.ok) return;
    expect(impossible.draft.date).toBe("");
  });
});

describe("非中文票据翻译", () => {
  it("识别语言并归一化为中文标签", () => {
    expect(receiptLanguageLabel("English")).toBe("英文");
    expect(receiptLanguageLabel("ja-JP")).toBe("日文");
    expect(receiptLanguageLabel("中文（简体）")).toBe("中文");
  });

  it("中文与未知语言不触发翻译提示", () => {
    expect(isNonChineseReceipt({ sourceLanguage: "中文" })).toBe(false);
    expect(isNonChineseReceipt({ sourceLanguage: "zh-CN" })).toBe(false);
    expect(isNonChineseReceipt({ sourceLanguage: "unknown" })).toBe(false);
    expect(isNonChineseReceipt({ sourceLanguage: "英文" })).toBe(true);
  });

  it("识别供应商或明细译名", () => {
    expect(
      hasReceiptTranslation({
        supplierZh: "ABC 食品",
        items: [],
      }),
    ).toBe(true);
    expect(
      hasReceiptTranslation({
        supplierZh: "",
        items: [
          {
            name: "Beef",
            nameZh: "牛肉",
            quantity: 1,
            unit: "kg",
            unitPrice: 1,
            amount: 1,
            confidence: 1,
          },
        ],
      }),
    ).toBe(true);
    expect(
      hasReceiptTranslation({
        supplierZh: "",
        items: [
          {
            name: "Beef",
            nameZh: "",
            quantity: 1,
            unit: "kg",
            unitPrice: 1,
            amount: 1,
            confidence: 1,
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("receiptWarnings", () => {
  const draft: ReceiptDraft = {
    ...base,
    documentType: "handwritten",
    supplier: "",
    date: "",
    confidence: 0.5,
    total: 120,
    items: base.items.map((i) => ({ ...i, confidence: 0.4 })),
  } as ReceiptDraft;

  it("提示缺供应商、缺日期、低置信度与总额不一致", () => {
    const warnings = receiptWarnings(draft).join("|");
    expect(warnings).toContain("供应商");
    expect(warnings).toContain("日期");
    expect(warnings).toContain("把握偏低");
    expect(warnings).toContain("不一致");
  });

  it("完整高置信度结果无警告", () => {
    expect(receiptWarnings(base as ReceiptDraft)).toEqual([]);
  });

  it("置信度为 0 也提示复核", () => {
    const warnings = receiptWarnings({
      ...base,
      confidence: 0,
      items: base.items.map((i) => ({ ...i, confidence: 0 })),
    } as ReceiptDraft).join("|");
    expect(warnings).toContain("整体识别把握偏低");
    expect(warnings).toContain("2 项明细识别把握偏低");
  });

  it("非中文票据缺翻译时提示对照原文", () => {
    const warnings = receiptWarnings({
      ...base,
      sourceLanguage: "English",
      supplier: "ABC Foods",
      supplierZh: "",
      items: base.items.map((i) => ({ ...i, nameZh: "" })),
    } as ReceiptDraft).join("|");
    expect(warnings).toContain("未返回中文翻译");
  });

  it("部分明细缺译名时提示数量", () => {
    const warnings = receiptWarnings({
      ...base,
      sourceLanguage: "English",
      supplier: "ABC Foods",
      supplierZh: "ABC 食品",
      items: [
        { ...base.items[0], name: "Potato", nameZh: "土豆" },
        { ...base.items[1], name: "Beef", nameZh: "" },
      ],
    } as ReceiptDraft).join("|");
    expect(warnings).toContain("1 项明细缺少中文翻译");
  });

  it("中文票据不因翻译字段为空而告警", () => {
    const warnings = receiptWarnings(base as ReceiptDraft);
    expect(warnings.join("|")).not.toContain("翻译");
  });
});

describe("matchInventoryItem", () => {
  const items = [
    { id: "1", name: "土豆" },
    { id: "2", name: "牛肉片" },
    { id: "3", name: "大白菜" },
    { id: "4", name: "花生油" },
  ];

  it("精确匹配", () => {
    expect(matchInventoryItem("土豆", items)?.id).toBe("1");
  });

  it("包含关系优先匹配", () => {
    expect(matchInventoryItem("精选牛肉片（冷冻）", items)?.id).toBe("2");
  });

  it("相似名称可模糊匹配", () => {
    const m = matchInventoryItem("白菜", items);
    expect(m?.id).toBe("3");
    expect(m!.score).toBeGreaterThanOrEqual(0.55);
  });

  it("无关名称不误匹配", () => {
    expect(matchInventoryItem("打印机墨盒", items)).toBeNull();
  });

  it("空名称返回 null", () => {
    expect(matchInventoryItem(" ", items)).toBeNull();
  });

  it("用中文译名匹配库存，外文原名不误匹配", () => {
    expect(matchInventoryItemAny(["Beef"], items)).toBeNull();
    expect(matchInventoryItemAny(["Beef", "牛肉片"], items)?.id).toBe("2");
  });
});

describe("RECEIPT_SYSTEM_PROMPT", () => {
  it("固定输出字段齐全，要求只输出 JSON", () => {
    for (const key of [
      "documentType",
      "sourceLanguage",
      "supplier",
      "supplierZh",
      "invoiceNumber",
      "date",
      "subtotal",
      "tax",
      "total",
      "items",
      "nameZh",
      "unitPrice",
      "confidence",
    ]) {
      expect(RECEIPT_SYSTEM_PROMPT).toContain(key);
    }
    expect(RECEIPT_SYSTEM_PROMPT).toContain("只输出 JSON");
    expect(RECEIPT_SYSTEM_PROMPT).toContain("禁止编造");
    expect(RECEIPT_SYSTEM_PROMPT).toContain("中文译名");
  });

  it("notes 只保留影响核对的重要备注", () => {
    expect(RECEIPT_SYSTEM_PROMPT).toContain("影响核对的重要备注");
    expect(RECEIPT_SYSTEM_PROMPT).toContain("票面提示语");
  });
});
