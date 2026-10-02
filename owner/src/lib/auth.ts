/**
 * 老板端登录（安全性升级）
 * - 密码走后端校验：POST /api/auth/verify-owner（bcrypt，settings.ownerPasswordHash）
 * - 本机只保存「会话令牌」，不再保存明文密码
 * - 后端不可达时回退到本地存储的哈希（支持离线/纯本地使用）
 */
import bcrypt from "bcryptjs";

const SESSION_KEY = "ownerAuthedUntil";
const LOCAL_HASH_KEY = "ownerPasswordHash";
const DEFAULT_PASSWORD =
  (import.meta.env.VITE_OWNER_PASSWORD as string) || "123456";
const SESSION_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

const VERIFY_URL = "/api/auth/verify-owner";

// 惰性计算默认哈希，避免模块加载时阻塞主线程（bcrypt cost 10 约几十毫秒）
let defaultHashCache: string | null = null;
function getDefaultHash(): string {
  if (defaultHashCache !== null) return defaultHashCache;
  try {
    defaultHashCache = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  } catch {
    defaultHashCache = "";
  }
  return defaultHashCache;
}

function getLocalHash(): string {
  try {
    const h = localStorage.getItem(LOCAL_HASH_KEY);
    if (h && h.startsWith("$2")) return h;
  } catch {
    /* ignore */
  }
  // 首次访问惰性写入默认哈希
  const def = getDefaultHash();
  if (def) {
    try {
      if (!localStorage.getItem(LOCAL_HASH_KEY))
        localStorage.setItem(LOCAL_HASH_KEY, def);
    } catch {
      /* ignore */
    }
  }
  return def;
}

/**
 * 校验密码。返回 true 表示登录成功。
 * 优先后端；网络不可达时回退本地哈希；两者都不匹配则失败。
 */
export async function verifyOwnerPassword(input: string): Promise<boolean> {
  if (!input) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      // 后端明确判定（true/false）都以后端为准
      if (typeof data?.ok === "boolean") return data.ok;
    }
  } catch {
    // 后端不可达 → 回退本地
  }
  try {
    return bcrypt.compareSync(input, getLocalHash());
  } catch {
    return false;
  }
}

/** 本地降级修改密码（仅当后端不可用/本地模式时使用） */
export function setOwnerPasswordLocal(pw: string): void {
  if (!pw) return;
  try {
    localStorage.setItem(LOCAL_HASH_KEY, bcrypt.hashSync(pw, 10));
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
