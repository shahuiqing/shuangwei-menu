/**
 * 本地管理员鉴权（不依赖数据库）
 *
 * 密码哈希只存本机 localStorage，数据库挂了也能登录。
 * 仅用于「不让人随便进后台」，非强安全（前端校验本质可被绕过）。
 *
 * 加固（P1-6）：session token 不再是纯时间戳——控制台写一行就能伪造。
 * 改为 `过期时间:HMAC(过期时间, 密码哈希)`，验证时重算 HMAC 比对，
 * 伪造者需要知道密码哈希才能生成有效 token。
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

/**
 * 时序安全字符串比较（避免 === 的短路侧信道）。
 * 长度不同时仍走完整比较，不提前返回。
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 长度不同仍跑一遍等长比较，避免泄露长度信息
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    let _mismatch = 1;
    for (let i = 0; i < longer.length; i++) {
      const c = i < shorter.length ? shorter.charCodeAt(i) : 0;
      _mismatch |= longer.charCodeAt(i) ^ c;
    }
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * 用密码哈希做简单 HMAC（非密码学标准，但足以防止控制台伪造）。
 * SHA-256 在 Web Crypto API 可用；不可用时退化为字符串拼接哈希。
 */
async function signSession(expiry: number, hash: string): Promise<string> {
  // Web Crypto 在浏览器和 vitest(jsdom) 中可用
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.subtle) {
    const enc = new TextEncoder();
    const key = await cryptoObj.subtle.importKey(
      "raw",
      enc.encode(hash),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await cryptoObj.subtle.sign(
      "HMAC",
      key,
      enc.encode(String(expiry)),
    );
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // 退化：用 djb2 做非加密哈希（仅当 Web Crypto 不可用）
  let h = 5381;
  const s = `${expiry}:${hash}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/** 标记已登录（本机保持）—— token 含 HMAC，控制台无法直接伪造 */
export async function markAdminAuthed(): Promise<void> {
  try {
    const hash = readHash();
    if (!hash) return; // 没设密码不允许标记
    const expiry = Date.now() + SESSION_MS;
    const sig = await signSession(expiry, hash);
    localStorage.setItem(AUTH_KEY, `${expiry}:${sig}`);
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

/**
 * 检查是否已登录。
 * 不再只读时间戳（控制台写一行即可伪造），而是校验 HMAC 签名。
 */
export async function isAdminAuthed(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const sep = raw.indexOf(":");
    if (sep < 0) return false;
    const expiry = parseInt(raw.slice(0, sep), 10);
    if (!Number.isFinite(expiry) || Date.now() >= expiry) return false;
    const storedSig = raw.slice(sep + 1);
    const hash = readHash();
    if (!hash) return false;
    const expectedSig = await signSession(expiry, hash);
    return timingSafeEqualStr(storedSig, expectedSig);
  } catch {
    return false;
  }
}

/**
 * 同步版：仅用于 useState 初始值（无法做 async）。
 * 乐观返回 true，实际校验在 useEffect 里用 async 版重验。
 * 保留旧 key 的兼容：纯时间戳格式的旧 token 会被异步校验拦截。
 */
export function isAdminAuthedSync(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const sep = raw.indexOf(":");
    if (sep < 0) return false;
    const expiry = parseInt(raw.slice(0, sep), 10);
    return Number.isFinite(expiry) && Date.now() < expiry;
  } catch {
    return false;
  }
}
