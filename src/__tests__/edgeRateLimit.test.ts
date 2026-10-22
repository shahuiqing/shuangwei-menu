import { describe, it, expect, afterEach } from "vitest";
import {
  allowRequest,
  clientIp,
  __resetEdgeRateLimitForTests,
} from "../../functions/_lib/helpers";
import { onRequest as changeOwnerHandler } from "../../functions/api/auth/change-owner-password";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/auth/x", {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
}

afterEach(() => {
  __resetEdgeRateLimitForTests();
});

describe("clientIp (edge, 防 XFF 伪造)", () => {
  it("优先使用 cf-connecting-ip", () => {
    expect(
      clientIp(
        req({
          "cf-connecting-ip": "198.51.100.5",
          "x-forwarded-for": "1.1.1.1",
        }),
      ),
    ).toBe("198.51.100.5");
  });

  it("回退时取 x-forwarded-for 最右侧地址（客户端可伪造的是最左侧）", () => {
    expect(
      clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 9.9.9.9" })),
    ).toBe("9.9.9.9");
  });

  it("无任何 IP 头时归入 unknown", () => {
    expect(clientIp(req())).toBe("unknown");
  });
});

describe("allowRequest (edge 限流)", () => {
  it("放行 max 次，第 max+1 次被拒", () => {
    const r = req({ "cf-connecting-ip": "203.0.113.1" });
    expect(allowRequest(r, "t1", 60_000, 2)).toBe(true);
    expect(allowRequest(r, "t1", 60_000, 2)).toBe(true);
    expect(allowRequest(r, "t1", 60_000, 2)).toBe(false);
  });

  it("不同 IP / 不同 scope 互不影响", () => {
    const a = req({ "cf-connecting-ip": "203.0.113.2" });
    const b = req({ "cf-connecting-ip": "203.0.113.3" });
    expect(allowRequest(a, "t2", 60_000, 1)).toBe(true);
    expect(allowRequest(a, "t2", 60_000, 1)).toBe(false);
    // 另一个 IP 仍可放行
    expect(allowRequest(b, "t2", 60_000, 1)).toBe(true);
    // 同一 IP 换 scope 也放行
    expect(allowRequest(a, "other", 60_000, 1)).toBe(true);
  });

  it("伪造不同 x-forwarded-for 左侧值无法绕过（因为只认最右侧）", () => {
    // 模拟客户端反复伪造最左侧，但最近一跳代理追加的右侧值固定
    for (let i = 0; i < 3; i++) {
      const spoofed = req({
        "x-forwarded-for": `10.0.0.${i}, 203.0.113.9`,
      });
      const allowed = allowRequest(spoofed, "t3", 60_000, 2);
      if (i < 2) expect(allowed).toBe(true);
      else expect(allowed).toBe(false);
    }
  });
});

describe("edge /api/auth/change-owner-password 空 hash 短路", () => {
  function post(body: unknown, ip = "198.51.100.20"): Request {
    return new Request("https://example.test/api/auth/change-owner-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": ip,
      },
      body: JSON.stringify(body),
    });
  }

  it("Supabase 未配置且无 ADMIN_SECRET 时拒绝改密（此前会放行）", async () => {
    const res = await changeOwnerHandler({
      request: post({ oldPassword: "anything", newPassword: "newpass123" }),
      env: {},
    } as any);
    expect(res.status).toBe(401);
    const j: any = await res.json();
    expect(j.ok).toBe(false);
  });

  it("Supabase 未配置但提供正确 ADMIN_SECRET 时放行鉴权（随后因无法写入报 500）", async () => {
    const res = await changeOwnerHandler({
      request: post({ oldPassword: "rightsecret", newPassword: "newpass123" }),
      env: { ADMIN_SECRET: "rightsecret" },
    } as any);
    // 鉴权通过后才发现没有 supabase 配置
    expect(res.status).toBe(500);
    const j: any = await res.json();
    expect(j.error).toMatch(/supabase not configured/i);
  });

  it("密码过短直接 400", async () => {
    const res = await changeOwnerHandler({
      request: post({ oldPassword: "x", newPassword: "123" }),
      env: {},
    } as any);
    expect(res.status).toBe(400);
  });

  it("连续失败触发 429 限流", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 7; i++) {
      last = await changeOwnerHandler({
        request: post(
          { oldPassword: "bad", newPassword: "newpass123" },
          "198.51.100.99",
        ),
        env: {},
      } as any);
    }
    expect(last!.status).toBe(429);
  });
});
