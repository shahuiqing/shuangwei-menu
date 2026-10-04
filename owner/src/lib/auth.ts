/**
 * 老板端登录（安全性升级）
 * - 密码走后端校验：POST /api/auth/verify-owner（bcrypt，settings.ownerPasswordHash）
 * - 本机只保存 bcrypt 哈希，不保存明文
 * - 后端不可达时回退到本地哈希（支持离线/纯本地使用）
 * - 无默认密码：本机无哈希且未配置 VITE_OWNER_PASSWORD 时，首登强制「设置密码」
 */
import bcrypt from "bcryptjs";
import { localRaw, localRemove, localSetRaw } from "./localdb";

const SESSION_KEY = "ownerAuthedUntil";
const LOCAL_HASH_KEY = "ownerPasswordHash";
/** 部署时可配置初始密码；不再有内置的通用弱默认值 */
const ENV_PASSWORD = String(import.meta.env.VITE_OWNER_PASSWORD || "");
const SESSION_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

const VERIFY_URL = "/api/auth/verify-owner";

/** 最短密码长度 */
export const MIN_PASSWORD_LEN = 6;

/** 本机是否已存有密码哈希 */
export function hasLocalPassword(): boolean {
  return (localRaw(LOCAL_HASH_KEY) || "").startsWith("$2");
}

/** 部署时是否通过环境变量配置了初始密码 */
export function hasEnvPassword(): boolean {
  return ENV_PASSWORD.length > 0;
}

/**
 * 是否需要走「首次设置密码」：
 * 本机无密码 且 未配置环境变量密码。
 * （若服务端已配密码，可点「已有密码？直接登录」走后端校验）
 */
export function needsPasswordSetup(): boolean {
  return !hasLocalPassword() && !hasEnvPassword();
}

function getLocalHash(): string {
  // 配置了环境变量密码：惰性写入本地哈希，保证离线也能登录
  if (ENV_PASSWORD && !localRaw(LOCAL_HASH_KEY)) {
    localSetRaw(LOCAL_HASH_KEY, bcrypt.hashSync(ENV_PASSWORD, 10));
  }
  const h = localRaw(LOCAL_HASH_KEY);
  return h && h.startsWith("$2") ? h : "";
}

/**
 * 校验密码。返回 true 表示登录成功。
 * 优先后端；网络不可达时回退本地哈希；无本地哈希（未设置过密码）直接失败。
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
  const local = getLocalHash();
  if (!local) return false; // 未设置过密码：不再有默认密码兜底
  try {
    return bcrypt.compareSync(input, local);
  } catch {
    return false;
  }
}

/** 本地降级修改密码（仅当后端不可用/本地模式时使用） */
export function setOwnerPasswordLocal(pw: string): void {
  if (!pw) return;
  localSetRaw(LOCAL_HASH_KEY, bcrypt.hashSync(pw, 10));
}

/** 首次设置密码：长度校验 + 写入本机哈希（云端需另行执行 set-owner-password） */
export function setupOwnerPassword(pw: string): boolean {
  const v = String(pw || "").trim();
  if (v.length < MIN_PASSWORD_LEN) return false;
  setOwnerPasswordLocal(v);
  return hasLocalPassword();
}

export function markAuthed(): void {
  localSetRaw(SESSION_KEY, String(Date.now() + SESSION_MS));
}

export function clearAuthed(): void {
  localRemove(SESSION_KEY);
}

export function isAuthed(): boolean {
  const until = localRaw(SESSION_KEY);
  return !!until && Date.now() < parseInt(until, 10);
}
