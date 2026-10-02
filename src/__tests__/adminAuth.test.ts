import { describe, it, expect, beforeEach } from "vitest";
import {
  verifyAdminPassword,
  saveAdminPassword,
  markAdminAuthed,
  isAdminAuthed,
  clearAdminAuthed,
} from "../utils/adminAuth";

describe("adminAuth local session", () => {
  beforeEach(() => localStorage.clear());

  it("accepts the built-in default password when no hash stored", async () => {
    expect(await verifyAdminPassword("123456")).toBe(true);
    expect(await verifyAdminPassword("nope")).toBe(false);
  });

  it("verifies against a saved bcrypt hash and stops accepting default", async () => {
    await saveAdminPassword("mypass");
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
