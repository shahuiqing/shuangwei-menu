import { describe, it, expect } from "vitest";
import { rateLimit } from "../../server/middleware/rateLimit";

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

  it("falls back to x-forwarded-for when req.ip is absent", () => {
    const mw = rateLimit(60_000, 1);
    const path = "/xf-" + Math.random();
    let nextCount = 0;
    const next = () => {
      nextCount++;
    };
    mw(
      { headers: { "x-forwarded-for": "9.9.9.9" }, path } as any,
      mockRes().res,
      next,
    );
    const blocked = mockRes();
    mw(
      { headers: { "x-forwarded-for": "9.9.9.9" }, path } as any,
      blocked.res,
      next,
    );
    expect(nextCount).toBe(1);
    expect(blocked.state.status).toBe(429);
  });
});
