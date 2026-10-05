import { describe, it, expect } from "vitest";
import { parseCsv, parseOrdersCsv, parseTime, hashKey } from "../csv";

describe("parseCsv", () => {
  it("引号、双引号转义、CRLF、BOM、空行忽略", () => {
    const text =
      '\uFEFF"时间","菜名","数量"\r\n2026-10-04 12:00,"红烧""肉",2\r\n\n,,\r\n';
    expect(parseCsv(text)).toEqual([
      ["时间", "菜名", "数量"],
      ["2026-10-04 12:00", '红烧"肉', "2"],
    ]);
  });

  it("字段内换行（引号内）保留", () => {
    expect(parseCsv('a,"x\ny",c')).toEqual([["a", "x\ny", "c"]]);
  });
});

describe("parseTime", () => {
  it("常见格式", () => {
    expect(parseTime("2026-10-04 12:30:45")).toBe(
      new Date(2026, 9, 4, 12, 30, 45).toISOString(),
    );
    expect(parseTime("2026/10/4 9:05")).toBe(
      new Date(2026, 9, 4, 9, 5, 0).toISOString(),
    );
    expect(parseTime("2026-10-04")).toBe(
      new Date(2026, 9, 4, 0, 0, 0).toISOString(),
    );
  });

  it("无效返回 null", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("昨天")).toBeNull();
  });
});

describe("parseOrdersCsv · 明细模式", () => {
  const csv = [
    "时间,桌号,菜名,数量,单价,单号,状态,支付方式",
    "2026-10-04 12:00:00,A1,红烧肉,2,38,O1,已结账,微信",
    "2026-10-04 12:00:00,A1,米饭,4,3,O1,已结账,微信",
    "2026/10/4 18:20,B2,鱼香肉丝,1,32,O2,已完成,现金",
    "坏时间行,A1,炒饭,1,20,O3,,",
  ].join("\r\n");

  it("同单号聚合为一单，坏行跳过", () => {
    const r = parseOrdersCsv(csv);
    expect(r.mode).toBe("detail");
    expect(r.orders).toHaveLength(2);
    expect(r.skipped).toBe(1);
    expect(r.errors[0]).toContain("时间");

    const o1 = r.orders[0];
    expect(o1.orderNumber).toBe("O1");
    expect(o1.items).toHaveLength(2);
    expect(o1.status).toBe("completed");
    expect(o1.paymentMethod).toBe("微信");
    // 金额列缺失 → 由明细求和
    expect(o1.total).toBe(2 * 38 + 4 * 3);
    expect(r.orders[1].tableNo).toBe("B2");
    expect(r.orders[1].total).toBe(32);
  });

  it("金额列存在时优先取金额", () => {
    const t = [
      "时间,桌号,菜名,数量,单价,金额,单号",
      "2026-10-04 12:00,A1,红烧肉,2,38,100,O9",
      "2026-10-04 12:00,A1,米饭,4,3,,O9",
    ].join("\n");
    expect(parseOrdersCsv(t).orders[0].total).toBe(100);
  });
});

describe("parseOrdersCsv · 汇总模式（本端导出格式）", () => {
  it("无菜名列、有金额列 → 一菜一单回导", () => {
    const csv = [
      "桌号,时间,状态,菜品数,金额,支付方式,单号",
      "A1,2026-10-04 12:00:00,已结账,3,88,微信,S1",
      "B2,2026-10-04 18:30:00,已结账,1,32,现金,S2",
    ].join("\r\n");
    const r = parseOrdersCsv(csv);
    expect(r.mode).toBe("summary");
    expect(r.orders).toHaveLength(2);
    expect(r.orders[0].total).toBe(88);
    expect(r.orders[0].items).toEqual([]);
    expect(r.orders[0].tableNo).toBe("A1");
  });

  it("无金额也无菜名 → 报错", () => {
    expect(() => parseOrdersCsv("时间,桌号\n2026-10-04,A1")).toThrow(
      /金额|菜名/,
    );
  });

  it("缺表头行 → 报错", () => {
    expect(() => parseOrdersCsv("只有表头")).toThrow();
  });
});

describe("平台来源识别", () => {
  it("来源列命中 → isExternal；缺列/堂食 → false", () => {
    const csv = [
      "时间,桌号,金额,单号,来源",
      "2026-10-04 12:00,A1,50,S1,美团外卖",
      "2026-10-04 12:01,A2,60,S2,",
      "2026-10-04 12:02,A3,70,S3,堂食",
    ].join("\n");
    const r = parseOrdersCsv(csv);
    expect(r.orders.map((o) => o.isExternal)).toEqual([true, false, false]);
  });

  it("英文列头 platform / 无来源列", () => {
    const withCol = [
      "time,table,amount,orderno,platform",
      "2026-10-04 12:00,A1,50,S1,EleMe",
    ].join("\n");
    expect(parseOrdersCsv(withCol).orders[0].isExternal).toBe(true);
    const noCol = ["时间,桌号,金额,单号", "2026-10-04,A1,50,S9"].join("\n");
    expect(parseOrdersCsv(noCol).orders[0].isExternal).toBe(false);
  });
});

describe("幂等 id", () => {
  it("同 key 确定性、不同 key 不同", () => {
    expect(hashKey("O1|x")).toBe(hashKey("O1|x"));
    expect(hashKey("O1|x")).not.toBe(hashKey("O2|x"));
  });

  it("重复行聚合后只有一单（导入端 RPC 按 id 幂等）", () => {
    const csv = [
      "时间,桌号,金额,单号",
      "2026-10-04 12:00,A1,50,D1",
      "2026-10-04 12:00,A1,50,D1",
    ].join("\n");
    const r = parseOrdersCsv(csv);
    expect(r.orders).toHaveLength(1);
  });
});
