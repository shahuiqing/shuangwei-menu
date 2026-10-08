import { describe, it, expect, beforeEach } from "vitest";
import {
  verifyAdminPassword,
  saveAdminPassword,
  hasAdminPassword,
  markAdminAuthed,
  isAdminAuthed,
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

  it("manages session lifecycle", () => {
    expect(isAdminAuthed()).toBe(false);
    markAdminAuthed();
    expect(isAdminAuthed()).toBe(true);
    clearAdminAuthed();
    expect(isAdminAuthed()).toBe(false);
  });

  it("treats an expired session as logged out", () => {
    localStorage.setItem("adminAuthedUntil", String(Date.now() - 1000));
    expect(isAdminAuthed()).toBe(false);
  });
});
