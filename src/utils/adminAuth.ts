/**
 * 本地管理员鉴权（不依赖数据库）
 *
 * 密码哈希只存本机 localStorage，数据库挂了也能登录。
 * 仅用于「不让人随便进后台」，非强安全（前端校验本质可被绕过）。
 */
import { hashPassword, verifyPassword } from "./password";

const HASH_KEY = "adminHash";
const AUTH_KEY = "adminAuthedUntil";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 登录保持 7 天

function readHash(): string {
  try {
    return (
      localStorage.getItem(HASH_KEY) ||
      localStorage.getItem("menuAdminPassword") ||
      ""
    );
  } catch {
    return "";
  }
}

/** 是否已设置管理员密码（用于首次使用引导设置初始密码） */
export function hasAdminPassword(): boolean {
  return readHash() !== "";
}

/** 校验管理员密码（本地哈希，不查数据库）。未设置密码时拒绝登录。 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const stored = readHash();
  if (!stored) return false;
  return verifyPassword(input, stored);
}

/** 设置/修改管理员密码（本地保存哈希） */
export async function saveAdminPassword(plain: string): Promise<void> {
  const h = await hashPassword(plain);
  try {
    localStorage.setItem(HASH_KEY, h);
    localStorage.removeItem("menuAdminPassword");
  } catch {
    /* ignore */
  }
}

/** 标记已登录（本机保持） */
export function markAdminAuthed(): void {
  try {
    localStorage.setItem(AUTH_KEY, String(Date.now() + SESSION_MS));
  } catch {
    /* ignore */
  }
}

export function clearAdminAuthed(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}

export function isAdminAuthed(): boolean {
  try {
    const until = localStorage.getItem(AUTH_KEY);
    return !!until && Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}
