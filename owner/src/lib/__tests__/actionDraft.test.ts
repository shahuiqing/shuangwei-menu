import { describe, it, expect } from "vitest";
import { actionDraft } from "../actionDraft";

describe("执行草稿", () => {
  it("各问题类型都有对应步骤", () => {
    for (const kind of ["price", "late", "low", "waste", "stocktake"]) {
      expect(actionDraft(kind).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("未知类型给通用步骤", () => {
    expect(actionDraft("unknown")).toContain("分析根本原因");
  });
});
