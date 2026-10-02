import { describe, it, expect } from "vitest";
import { checkAdmin } from "../../functions/_lib/helpers";
import { onRequest as verifyHandler } from "../../functions/api/auth/verify";

function fakeRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  } as any;
}

describe("checkAdmin (edge functions)", () => {
  it("fails closed when ADMIN_SECRET is not configured", () => {
    expect(checkAdmin(fakeRequest({ "x-admin-token": "x" }), {})).toBe(false);
  });

  it("accepts a matching x-admin-token", () => {
    expect(
      checkAdmin(fakeRequest({ "x-admin-token": "s" }), { ADMIN_SECRET: "s" }),
    ).toBe(true);
  });

  it("accepts a matching Authorization Bearer token", () => {
    expect(
      checkAdmin(fakeRequest({ authorization: "Bearer s" }), {
        ADMIN_SECRET: "s",
      }),
    ).toBe(true);
  });

  it("rejects missing or wrong tokens", () => {
    expect(checkAdmin(fakeRequest(), { ADMIN_SECRET: "s" })).toBe(false);
    expect(
      checkAdmin(fakeRequest({ "x-admin-token": "bad" }), {
        ADMIN_SECRET: "s",
      }),
    ).toBe(false);
  });
});

function postVerify(body: unknown): Request {
  return new Request("https://example.test/api/auth/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("edge /api/auth/verify", () => {
  it("returns 400 when password is missing", async () => {
    const res = await verifyHandler({
      request: postVerify({}),
      env: {},
    } as any);
    expect(res.status).toBe(400);
    const j: any = await res.json();
    expect(j.ok).toBe(false);
  });

  it("falls back to ADMIN_SECRET when Supabase is not configured", async () => {
    const res = await verifyHandler({
      request: postVerify({ password: "s" }),
      env: { ADMIN_SECRET: "s" },
    } as any);
    const j: any = await res.json();
    expect(j.ok).toBe(true);
  });

  it("returns ok:false when nothing is configured", async () => {
    const res = await verifyHandler({
      request: postVerify({ password: "x" }),
      env: {},
    } as any);
    const j: any = await res.json();
    expect(j.ok).toBe(false);
  });
});
