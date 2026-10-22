import { describe, it, expect, beforeEach } from "vitest";
import {
  verifyAdminPassword,
  saveAdminPassword,
  hasAdminPassword,
  markAdminAuthed,
  isAdminAuthed,
  isAdminAuthedSync,
  clearAdminAuthed,
} from "../utils/adminAuth";

describe("adminAuth local session", () => {
  beforeEach(() => localStorage.clear());

  it("rejects all logins when no password has been set", async () => {
    expect(hasAdminPassword()).toBe(false);
    expect(await verifyAdminPassword("123456")).toBe(false);
    expect(await verifyAdminPassword("admin123")).toBe(false);
    expect(await verifyAdminPassword("")).toBe(false);
  });

  it("verifies against a saved bcrypt hash", async () => {
    await saveAdminPassword("mypass");
    expect(hasAdminPassword()).toBe(true);
    expect(await verifyAdminPassword("mypass")).toBe(true);
    expect(await verifyAdminPassword("123456")).toBe(false);
  });

  it("manages session lifecycle (HMAC 签名 token)", async () => {
    // 没设密码时不允许标记
    await markAdminAuthed();
    expect(await isAdminAuthed()).toBe(false);

    // 设密码后可以标记
    await saveAdminPassword("mypass");
    await markAdminAuthed();
    expect(await isAdminAuthed()).toBe(true);

    // sync 版乐观返回 true（时间戳未过期）
    expect(isAdminAuthedSync()).toBe(true);

    clearAdminAuthed();
    expect(await isAdminAuthed()).toBe(false);
    expect(isAdminAuthedSync()).toBe(false);
  });

  it("treats an expired session as logged out", async () => {
    await saveAdminPassword("mypass");
    // 写一个已过期的 HMAC token
    const expiry = Date.now() - 1000;
    localStorage.setItem("adminAuthedUntil", `${expiry}:fakesig`);
    expect(await isAdminAuthed()).toBe(false);
  });

  it("rejects a forged timestamp-only token (P1-6 回归)", async () => {
    await saveAdminPassword("mypass");
    // 旧格式：纯时间戳，无 HMAC 签名 —— 控制台伪造
    localStorage.setItem("adminAuthedUntil", String(Date.now() + 999999999));
    // async 版校验 HMAC，应拒绝
    expect(await isAdminAuthed()).toBe(false);
  });

  it("rejects a token with wrong HMAC signature", async () => {
    await saveAdminPassword("mypass");
    const expiry = Date.now() + 999999999;
    localStorage.setItem("adminAuthedUntil", `${expiry}:deadbeef`);
    expect(await isAdminAuthed()).toBe(false);
  });

  it("rejects a token signed with a different password hash", async () => {
    await saveAdminPassword("mypass");
    await markAdminAuthed();
    expect(await isAdminAuthed()).toBe(true);
    // 改密码后旧 token 应失效
    await saveAdminPassword("otherpass");
    expect(await isAdminAuthed()).toBe(false);
  });
});
