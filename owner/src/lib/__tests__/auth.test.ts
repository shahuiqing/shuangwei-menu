import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIN_PASSWORD_LEN,
  hasLocalPassword,
  hasEnvPassword,
  needsPasswordSetup,
  setupOwnerPassword,
  verifyOwnerPassword,
  markAuthed,
  isAuthed,
  clearAuthed,
} from "../auth";

/* 内存版 localStorage（node 测试环境无 window） */
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  // 后端不可达：本地兜底路径
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("源码安全基线", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/auth.ts"), "utf8");

  it("不含内置默认密码 123456", () => {
    expect(src).not.toContain("123456");
    expect(src).not.toMatch(/default.*password/i);
  });

  it("提供首次设置密码的必需导出", () => {
    expect(src).toContain("needsPasswordSetup");
    expect(src).toContain("setupOwnerPassword");
    expect(MIN_PASSWORD_LEN).toBeGreaterThanOrEqual(6);
  });
});

describe("首次设置密码流程", () => {
  it("初始状态需要设置密码，且未配环境变量密码", () => {
    expect(hasLocalPassword()).toBe(false);
    expect(hasEnvPassword()).toBe(false);
    expect(needsPasswordSetup()).toBe(true);
  });

  it("短密码被拒绝，长度达标才写入", () => {
    expect(setupOwnerPassword("123")).toBe(false);
    expect(hasLocalPassword()).toBe(false);
    expect(needsPasswordSetup()).toBe(true);

    expect(setupOwnerPassword("abc123")).toBe(true);
    expect(hasLocalPassword()).toBe(true);
    expect(needsPasswordSetup()).toBe(false);
  });
});

describe("verifyOwnerPassword（本地兜底路径）", () => {
  it("未设置过密码时任何输入都失败（无默认密码兜底）", async () => {
    await expect(verifyOwnerPassword("123456")).resolves.toBe(false);
    await expect(verifyOwnerPassword("")).resolves.toBe(false);
  });

  it("设置密码后仅正确口令通过", async () => {
    setupOwnerPassword("secret6");
    await expect(verifyOwnerPassword("secret6")).resolves.toBe(true);
    await expect(verifyOwnerPassword("secret7")).resolves.toBe(false);
    await expect(verifyOwnerPassword("")).resolves.toBe(false);
  });
});

describe("会话状态", () => {
  it("markAuthed / isAuthed / clearAuthed 往返", () => {
    expect(isAuthed()).toBe(false);
    markAuthed();
    expect(isAuthed()).toBe(true);
    clearAuthed();
    expect(isAuthed()).toBe(false);
  });
});
