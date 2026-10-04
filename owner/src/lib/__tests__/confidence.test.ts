import { describe, it, expect } from "vitest";
import { dataConfidence, CONFIDENCE_LABEL } from "../confidence";

describe("数据置信度", () => {
  it("数据少且未盘点 = 低", () => {
    expect(dataConfidence({ purchaseCount: 1, stocktakeDone: false })).toBe(
      "low",
    );
  });

  it("有一定数据或已盘点 = 中", () => {
    expect(dataConfidence({ purchaseCount: 3, stocktakeDone: false })).toBe(
      "medium",
    );
    expect(dataConfidence({ purchaseCount: 1, stocktakeDone: true })).toBe(
      "medium",
    );
  });

  it("数据充足且已盘点 = 高", () => {
    expect(dataConfidence({ purchaseCount: 10, stocktakeDone: true })).toBe(
      "high",
    );
  });

  it("标签齐全", () => {
    expect(CONFIDENCE_LABEL.high).toBe("高");
    expect(CONFIDENCE_LABEL.low).toBe("低");
  });
});
