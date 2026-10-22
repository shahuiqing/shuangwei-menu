import { describe, it, expect } from "vitest";
import {
  LANGS,
  getLangNames,
  langCompletion,
  langCoverage,
  langCsv,
} from "../langNames";
import type { MenuItem, MenuCategory } from "../menu";

const dish = (patch: Partial<MenuItem> = {}): MenuItem => ({
  id: "d1",
  title: "红烧肉",
  price: "75",
  ...patch,
});

describe("菜品多语言名称", () => {
  it("四种语言定义（不含中文，中文即菜品 title）", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["en", "fr", "ar", "ma"]);
  });

  it("从菜品字段读取多语言名", () => {
    const names = getLangNames(
      dish({ enTitle: "Braised Pork", maTitle: "طاجين" }),
    );
    expect(names.en).toBe("Braised Pork");
    expect(names.ma).toBe("طاجين");
    expect(names.fr).toBe("");
  });

  it("计数：只统计非空语言", () => {
    expect(langCompletion(dish())).toBe(0);
    expect(langCompletion(dish({ enTitle: "A", frTitle: "B" }))).toBe(2);
    expect(langCompletion(dish({ enTitle: "  " }))).toBe(0);
  });

  it("覆盖率：四语齐全才计入 complete", () => {
    const cats: MenuCategory[] = [
      {
        id: "c1",
        name: "主菜",
        items: [
          dish({
            id: "d1",
            enTitle: "A",
            frTitle: "B",
            arTitle: "ج",
            maTitle: "د",
          }),
          dish({ id: "d2", enTitle: "X" }),
        ],
      },
    ];
    const cov = langCoverage(cats);
    expect(cov.dishes).toBe(2);
    expect(cov.complete).toBe(1);
  });

  it("CSV 含表头、BOM 与空缺补位", () => {
    const csv = langCsv([
      dish({ id: "d1", title: '红烧"肉"', enTitle: "Braised Pork" }),
      dish({ id: "d2", title: "青菜" }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("菜品");
    expect(lines[1]).toContain('""肉""');
    expect(lines[2]).toContain('""');
  });
});
