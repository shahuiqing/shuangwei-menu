import { describe, it, expect, afterEach } from "vitest";
import { requireAdmin } from "../../server/middleware/auth";

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

describe("requireAdmin middleware", () => {
  const origSecret = process.env.ADMIN_SECRET;
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (origSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = origSecret;
    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
  });

  it("opens access in dev when secret is missing", () => {
    delete process.env.ADMIN_SECRET;
    process.env.NODE_ENV = "development";
    let nexted = false;
    const { res } = mockRes();
    requireAdmin({ headers: {}, body: {} } as any, res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });

  it("accepts x-admin-token header", () => {
    process.env.ADMIN_SECRET = "s3cr3t";
    let nexted = false;
    const { res } = mockRes();
    requireAdmin(
      { headers: { "x-admin-token": "s3cr3t" }, body: {} } as any,
      res,
      () => {
        nexted = true;
      },
    );
    expect(nexted).toBe(true);
  });

  it("accepts Authorization Bearer", () => {
    process.env.ADMIN_SECRET = "s3cr3t";
    let nexted = false;
    const { res } = mockRes();
    requireAdmin(
      { headers: { authorization: "Bearer s3cr3t" }, body: {} } as any,
      res,
      () => {
        nexted = true;
      },
    );
    expect(nexted).toBe(true);
  });

  it("accepts body adminPassword", () => {
    process.env.ADMIN_SECRET = "s3cr3t";
    let nexted = false;
    const { res } = mockRes();
    requireAdmin(
      { headers: {}, body: { adminPassword: "s3cr3t" } } as any,
      res,
      () => {
        nexted = true;
      },
    );
    expect(nexted).toBe(true);
  });

  it("rejects an invalid token with 401 E_AUTH", () => {
    process.env.ADMIN_SECRET = "s3cr3t";
    let nexted = false;
    const { res, state } = mockRes();
    requireAdmin(
      { headers: { "x-admin-token": "bad" }, body: {} } as any,
      res,
      () => {
        nexted = true;
      },
    );
    expect(nexted).toBe(false);
    expect(state.status).toBe(401);
    expect(state.body.code).toBe("E_AUTH");
  });

  it("ignores query token (regression: token leak via URL)", () => {
    process.env.ADMIN_SECRET = "s3cr3t";
    let nexted = false;
    const { res, state } = mockRes();
    requireAdmin(
      { headers: {}, body: {}, query: { token: "s3cr3t" } } as any,
      res,
      () => {
        nexted = true;
      },
    );
    expect(nexted).toBe(false);
    expect(state.status).toBe(401);
  });
});
