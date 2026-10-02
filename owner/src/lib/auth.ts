/**
 * 老板端本地登录（不依赖数据库，独立于顾客端）
 * 密码优先取环境变量 VITE_OWNER_PASSWORD，默认 123456；
 * 可在「设置」里修改（存本机 localStorage）。
 */

const KEY = "ownerPassword";
const DEFAULT = (import.meta.env.VITE_OWNER_PASSWORD as string) || "123456";
const SESSION_KEY = "ownerAuthedUntil";
const SESSION_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

export function getOwnerPassword(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function verifyOwnerPassword(input: string): boolean {
  return input === getOwnerPassword();
}

export function setOwnerPassword(pw: string): void {
  try {
    localStorage.setItem(KEY, pw);
  } catch {
    /* ignore */
  }
}

export function markAuthed(): void {
  try {
    localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS));
  } catch {
    /* ignore */
  }
}

export function clearAuthed(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthed(): boolean {
  try {
    const until = localStorage.getItem(SESSION_KEY);
    return !!until && Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}
