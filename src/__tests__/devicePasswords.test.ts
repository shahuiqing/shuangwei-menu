import { describe, it, expect } from "vitest";
import {
  hasPlaintextPasswords,
  hashDevicePasswords,
  isHashedPassword,
  normalizeHashedList,
} from "../utils/devicePasswords";
import { verifyPassword } from "../utils/password";

describe("服务员密码统一存储", () => {
  it("云端 {name,hash} 结构转换为本地结构", () => {
    const list = normalizeHashedList([
      { name: "张三", hash: "$2a$10$abcdefghijklmnopqrstuv" },
      { name: "李四", password: "$2b$10$xyz" },
      { name: "", hash: "$2a$10$skip" },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      name: "张三",
      password: "$2a$10$abcdefghijklmnopqrstuv",
    });
  });

  it("明文 → bcrypt，已是哈希不重复加密", async () => {
    const first = await hashDevicePasswords([
      { name: "王五", password: "1234" },
    ]);
    expect(isHashedPassword(first[0]!.password)).toBe(true);
    expect(await verifyPassword("1234", first[0]!.password)).toBe(true);
    expect(await verifyPassword("wrong", first[0]!.password)).toBe(false);

    const second = await hashDevicePasswords(first);
    expect(second[0]!.password).toBe(first[0]!.password);
  });

  it("空姓名/空密码被丢弃", async () => {
    const out = await hashDevicePasswords([
      { name: "", password: "1234" },
      { name: "赵六", password: "" },
    ]);
    expect(out).toHaveLength(0);
  });

  it("识别是否仍有明文（用于启动迁移）", () => {
    expect(hasPlaintextPasswords([{ name: "a", password: "1234" }])).toBe(true);
    expect(
      hasPlaintextPasswords([
        { name: "a", password: "$2a$10$abcdefghijklmnopqrstuv" },
      ]),
    ).toBe(false);
    expect(hasPlaintextPasswords([])).toBe(false);
    expect(hasPlaintextPasswords(null)).toBe(false);
  });
});
