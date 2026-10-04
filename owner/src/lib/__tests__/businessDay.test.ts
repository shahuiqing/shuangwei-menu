import { describe, it, expect } from "vitest";
import {
  BUSINESS_DAY_HOUR,
  businessDayStart,
  businessDayEnd,
  businessDayKey,
  withinBusinessDay,
} from "../businessDay";

const DAY = 86400000;
// 用本地时间构造，保证任意时区下「凌晨 3 点分界」语义一致
const d = (day: number, hour: number) => new Date(2026, 9, day, hour, 0, 0);

describe("营业日分界（凌晨 3 点）", () => {
  it("3 点前归属前一天", () => {
    const start = businessDayStart(d(3, 2));
    expect(new Date(start).getHours()).toBe(BUSINESS_DAY_HOUR);
    expect(businessDayKey(d(3, 2))).toBe("2026-10-02");
  });

  it("3 点后归属当天", () => {
    expect(businessDayKey(d(3, 10))).toBe("2026-10-03");
  });

  it("营业日跨度 24 小时", () => {
    expect(businessDayEnd(d(3, 10)) - businessDayStart(d(3, 10))).toBe(DAY);
  });

  it("withinBusinessDay 判定", () => {
    const now = d(3, 10); // 营业日 10-03 03:00 ~ 10-04 03:00
    expect(withinBusinessDay(d(3, 8), now)).toBe(true);
    expect(withinBusinessDay(d(3, 2), now)).toBe(false); // 前一天凌晨
    expect(withinBusinessDay(d(4, 2), now)).toBe(true); // 次日 02:59 前仍属当天
    expect(withinBusinessDay(d(4, 4), now)).toBe(false); // 次日 04:00 已进新营业日
  });
});
