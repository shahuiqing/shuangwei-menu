import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGS,
  loadLangNames,
  saveLangName,
  getLangNames,
  langCompletion,
  langCoverage,
  langCsv,
} from "../langNames";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
});

describe("菜品多语言名称", () => {
  it("四种语言定义", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["zh", "en", "fr", "ar"]);
  });

  it("写入/清空/整条删除", () => {
    saveLangName("d1", "en", "  Beef Noodles  ");
    expect(getLangNames("d1").en).toBe("Beef Noodles");
    saveLangName("d1", "zh", "牛肉面");
    expect(langCompletion(getLangNames("d1"))).toBe(2);

    saveLangName("d1", "en", "   ");
    expect(getLangNames("d1").en).toBeUndefined();
    expect(getLangNames("d1").zh).toBe("牛肉面");

    saveLangName("d1", "zh", "");
    expect(loadLangNames()["d1"]).toBeUndefined();
    expect(getLangNames("d1")).toEqual({});
  });

  it("覆盖率统计", () => {
    saveLangName("d1", "zh", "甲");
    saveLangName("d1", "en", "A");
    saveLangName("d1", "fr", "B");
    saveLangName("d1", "ar", "ج");
    saveLangName("d2", "zh", "乙");
    expect(langCoverage()).toEqual({ dishes: 2, complete: 1 });
  });

  it("CSV 含表头、BOM 与空缺补位", () => {
    saveLangName("d1", "zh", '红烧"肉"');
    const csv = langCsv([
      { id: "d1", title: "红烧肉" },
      { id: "d2", title: "青菜" },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("中文");
    expect(lines[1]).toContain('""肉""');
    expect(lines[2]).toContain('""');
  });
});
