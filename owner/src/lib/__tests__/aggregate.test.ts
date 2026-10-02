import { describe, it, expect } from "vitest";
import { rangeToIso, NEXT_STATUS } from "../aggregate";

const ms = (iso: string) => new Date(iso).getTime();

describe("rangeToIso", () => {
  it("上一周期与当前区间等长且紧邻", () => {
    const r = rangeToIso("7d");
    const span = ms(r.end) - ms(r.start);
    const prevSpan = ms(r.prevEnd) - ms(r.prevStart);
    expect(prevSpan).toBe(span);
    expect(ms(r.prevEnd)).toBeLessThan(ms(r.start));
    // prevEnd 紧贴 start（差 1ms）
    expect(ms(r.start) - ms(r.prevEnd)).toBe(1);
  });

  it("'all' 起点接近纪元", () => {
    const r = rangeToIso("all");
    expect(ms(r.start)).toBeLessThan(ms("2000-01-01T00:00:00Z"));
  });

  it("custom 区间按本地日界", () => {
    const r = rangeToIso("custom", "2026-01-01", "2026-01-31");
    const start = new Date(r.start);
    const end = new Date(r.end);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(end.getDate()).toBe(31);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("NEXT_STATUS", () => {
  it("合法流转", () => {
    expect(NEXT_STATUS.pending).toContain("cooking");
    expect(NEXT_STATUS.cooking).toContain("served");
    expect(NEXT_STATUS.served).toContain("completed");
  });

  it("终态不可再流转", () => {
    expect(NEXT_STATUS.completed).toHaveLength(0);
    expect(NEXT_STATUS.cancelled).toHaveLength(0);
  });
});
