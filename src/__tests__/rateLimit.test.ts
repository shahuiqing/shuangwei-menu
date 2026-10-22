import { describe, it, expect, afterEach } from "vitest";
import {
  rateLimit,
  resolveClientIp,
  __resetRateLimitForTests,
} from "../../server/middleware/rateLimit";

function mockRes() {
  const state = { status: 0, body: null as any };
  const res: any = {
    status(c: number) {
      state.status = c;
      return res;
    },
    json(b: any) {
      state.body = b;
      return res;
    },
  };
  return { res, state };
}

afterEach(() => {
  __resetRateLimitForTests();
  delete process.env.TRUST_PROXY;
});

describe("rateLimit middleware", () => {
  it("allows up to max requests then returns 429", () => {
    const mw = rateLimit(60_000, 2);
    const path = "/rl-" + Math.random();
    const req = { ip: "1.2.3.4", path, headers: {} } as any;
    let nextCount = 0;
    const next = () => {
      nextCount++;
    };

    const a = mockRes();
    mw(req, a.res, next);
    const b = mockRes();
    mw(req, b.res, next);
    expect(a.state.status).toBe(0);
    expect(b.state.status).toBe(0);
    expect(nextCount).toBe(2);

    const c = mockRes();
    mw(req, c.res, next);
    expect(c.state.status).toBe(429);
    expect(nextCount).toBe(2);
  });

  it("tracks different paths independently", () => {
    const mw = rateLimit(60_000, 1);
    const ip = "5.5.5.5";
    let nextCount = 0;
    const next = () => {
      nextCount++;
    };
    const p1 = "/p1-" + Math.random();
    const p2 = "/p2-" + Math.random();
    mw({ ip, path: p1, headers: {} } as any, mockRes().res, next);
    mw({ ip, path: p2, headers: {} } as any, mockRes().res, next);
    expect(nextCount).toBe(2);
    const blocked = mockRes();
    mw({ ip, path: p1, headers: {} } as any, blocked.res, next);
    expect(blocked.state.status).toBe(429);
  });
});

describe("resolveClientIp —— x-forwarded-for 防伪造（FIX_PLAN #11）", () => {
  it("默认忽略 x-forwarded-for，只认 TCP 对端 IP", () => {
    const ip = resolveClientIp({
      ip: "1.2.3.4",
      headers: { "x-forwarded-for": "9.9.9.9" },
    } as any);
    expect(ip).toBe("1.2.3.4");
  });

  it("伪造 x-forwarded-for 无法绕过限流（同一 TCP 源仍被拦）", () => {
    const mw = rateLimit(60_000, 1);
    const path = "/forge-" + Math.random();
    let nextCount = 0;
    const next = () => {
      nextCount++;
    };
    // 第 1 次：真实 IP 1.1.1.1，带一个伪造的 XFF
    mw(
      { ip: "1.1.1.1", headers: { "x-forwarded-for": "6.6.6.6" }, path } as any,
      mockRes().res,
      next,
    );
    // 第 2 次：同一真实 IP，但换一个伪造 XFF，试图绕过
    const blocked = mockRes();
    mw(
      { ip: "1.1.1.1", headers: { "x-forwarded-for": "7.7.7.7" }, path } as any,
      blocked.res,
      next,
    );
    expect(nextCount).toBe(1);
    expect(blocked.state.status).toBe(429);
  });

  it("未配置 TRUST_PROXY 时 req.ip 缺失则归入 unknown，不采信 XFF", () => {
    const ip = resolveClientIp({
      headers: { "x-forwarded-for": "9.9.9.9" },
    } as any);
    expect(ip).toBe("unknown");
  });

  it("配置 TRUST_PROXY=true 时取 XFF 最右侧地址（不可伪造的一端）", () => {
    process.env.TRUST_PROXY = "true";
    const ip = resolveClientIp({
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" },
    } as any);
    expect(ip).toBe("203.0.113.7");
  });

  it("配置 TRUST_PROXY=true 时优先使用 cf-connecting-ip", () => {
    process.env.TRUST_PROXY = "true";
    const ip = resolveClientIp({
      headers: {
        "cf-connecting-ip": "198.51.100.5",
        "x-forwarded-for": "1.1.1.1",
      },
    } as any);
    expect(ip).toBe("198.51.100.5");
  });
});
