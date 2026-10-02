import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../utils/password";

describe("password hashing", () => {
  it("produces a bcrypt hash that verifies", async () => {
    const h = await hashPassword("s3cret-pass");
    expect(h.startsWith("$2")).toBe(true);
    expect(await verifyPassword("s3cret-pass", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("supports legacy plaintext comparison", async () => {
    expect(await verifyPassword("legacy", "legacy")).toBe(true);
    expect(await verifyPassword("legacy", "other")).toBe(false);
  });

  it("returns false for empty hash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
  });
});
