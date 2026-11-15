import { hashPassword } from "./password";

/**
 * 服务员密码（顾客端 waiter 模式）统一处理：
 * - 本地只保存 bcrypt 哈希，不再存明文
 * - 兼容旧数据：{name,password} 明文 / {name,hash} 云端哈希
 * - 已是哈希的原样保留，避免重复加密
 */

export interface DevicePasswordEntry {
  name: string;
  /** bcrypt 哈希（字段名沿用 password，兼容既有调用方） */
  password: string;
}

export function isHashedPassword(v: unknown): boolean {
  return typeof v === "string" && v.startsWith("$2");
}

/** 云端 devicePasswordsHash：[{name, hash}] → 本地结构 [{name, password: hash}] */
export function normalizeHashedList(list: unknown): DevicePasswordEntry[] {
  if (!Array.isArray(list)) return [];
  const out: DevicePasswordEntry[] = [];
  for (const d of list) {
    const name = String((d as any)?.name ?? "").trim();
    const hash = String((d as any)?.hash ?? (d as any)?.password ?? "").trim();
    if (!name || !hash) continue;
    out.push({ name, password: hash });
  }
  return out;
}

/**
 * 统一转换为「全部为 bcrypt 哈希」的列表。
 * - 明文 → hashPassword
 * - $2 开头 → 原样保留
 * - 空姓名/空密码 → 丢弃
 */
export async function hashDevicePasswords(
  list: unknown,
): Promise<DevicePasswordEntry[]> {
  if (!Array.isArray(list)) return [];
  const out: DevicePasswordEntry[] = [];
  for (const d of list) {
    const name = String((d as any)?.name ?? "").trim();
    const raw = String((d as any)?.hash ?? (d as any)?.password ?? "").trim();
    if (!name || !raw) continue;
    out.push({
      name,
      password: isHashedPassword(raw) ? raw : await hashPassword(raw),
    });
  }
  return out;
}

/** 是否还有未哈希的明文密码（用于一次性迁移判断） */
export function hasPlaintextPasswords(list: unknown): boolean {
  return (
    Array.isArray(list) &&
    list.some((d) => {
      const pw = String((d as any)?.password ?? "").trim();
      return !!pw && !isHashedPassword(pw);
    })
  );
}
