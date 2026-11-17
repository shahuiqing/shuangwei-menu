/**
 * 老板端登录（安全性升级）
 * - 密码走后端校验：POST /api/auth/verify-owner（bcrypt，settings.ownerPasswordHash）
 * - 本机只保存 bcrypt 哈希，不保存明文
 * - 后端不可达时回退到本地哈希（支持离线/纯本地使用）
 * - 无默认密码：本机无哈希且未配置 VITE_OWNER_PASSWORD 时，首登强制「设置密码」
 */
import bcrypt from "bcryptjs";
import { localRaw, localRemove, localSetRaw } from "./localdb";
import { logAction } from "./auditLog";
import { supabase } from "./supabase";

const SESSION_KEY = "ownerAuthedUntil";
const LOCAL_HASH_KEY = "ownerPasswordHash";
/** 会话 token（sessionStorage：标签页级，刷新保留、关闭丢失；不落 localStorage 以免被 XSS 读） */
const TOKEN_KEY = "ownerSessionToken";
/** 部署时可配置初始密码；不再有内置的通用弱默认值 */
const ENV_PASSWORD = String(import.meta.env.VITE_OWNER_PASSWORD || "");
const SESSION_MS = 3 * 24 * 60 * 60 * 1000; // 3 天

const VERIFY_URL = "/api/auth/verify-owner";

interface SecretRes {
  ok?: boolean;
  configured?: boolean;
  error?: string;
}

/** 调用数据库安全函数（哈希在库内，前端拿不到） */
async function rpcSecret<T>(fn: string, args: Record<string, unknown>) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return null;
    return data as T | null;
  } catch {
    return null;
  }
}

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
  // 1) 数据库内校验（推荐：哈希不出库，改浏览器存储也无法绕过）
  const rpcRes = await rpcSecret<SecretRes>("owner_verify_password", {
    p_password: input,
  });
  if (rpcRes && rpcRes.configured === true) return !!rpcRes.ok;

  // 2) 云端未配置 / RPC 不可用 → 本机哈希（离线也能登录）
  const local = getLocalHash();
  if (local) {
    try {
      return bcrypt.compareSync(input, local);
    } catch {
      return false;
    }
  }

  // 3) 本机也没有密码 → 兼容旧 Edge 通道（ADMIN_SECRET / 旧部署）
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (typeof data?.ok === "boolean") return data.ok;
    }
  } catch {
    // 后端不可达
  }
  return false;
}

/** 本地降级修改密码（仅当后端不可用/本地模式时使用） */
export function setOwnerPasswordLocal(pw: string): void {
  if (!pw) return;
  const first = !hasLocalPassword();
  localSetRaw(LOCAL_HASH_KEY, bcrypt.hashSync(pw, 10));
  logAction(first ? "设置密码" : "修改密码");
}

/**
 * 修改密码：写本机哈希（离线可用）+ 尝试同步云端（靠旧密码鉴权，无需 ADMIN_SECRET）。
 * 返回各端是否生效，供 UI 提示真实状态。
 */
export async function changeOwnerPassword(
  oldPw: string,
  newPw: string,
): Promise<{ ok: boolean; local: boolean; cloud: boolean }> {
  const v = String(newPw || "").trim();
  if (v.length < MIN_PASSWORD_LEN)
    return { ok: false, local: false, cloud: false };
  setOwnerPasswordLocal(v);
  let cloud = false;

  // 1) 数据库内修改（校验旧密码）
  const rpcRes = await rpcSecret<SecretRes>("owner_change_password", {
    p_old: oldPw,
    p_new: v,
  });
  if (rpcRes) {
    if (rpcRes.ok) {
      cloud = true;
    } else if (rpcRes.error === "owner password not configured") {
      // 云端还没有密码：把新密码作为首次云端密码写入
      const boot = await rpcSecret<SecretRes>("owner_set_owner_password", {
        p_password: v,
      });
      cloud = !!boot?.ok;
    }
    return { ok: true, local: true, cloud };
  }

  // 2) RPC 不可用 → 回退 Edge 通道（旧部署兼容）
  try {
    const res = await fetch("/api/auth/change-owner-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: v }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      cloud = !!data?.ok;
    }
  } catch {
    // 后端不可达 → 仅本机
  }
  return { ok: true, local: true, cloud };
}

/** 首次设置密码：写入本机哈希，并同步云端（同步等待，便于随后立即换取会话 token） */
export async function setupOwnerPassword(pw: string): Promise<boolean> {
  const v = String(pw || "").trim();
  if (v.length < MIN_PASSWORD_LEN) return false;
  setOwnerPasswordLocal(v);
  await rpcSecret<SecretRes>("owner_set_owner_password", { p_password: v });
  return hasLocalPassword();
}

export function markAuthed(): void {
  localSetRaw(SESSION_KEY, String(Date.now() + SESSION_MS));
}

export function clearAuthed(): void {
  localRemove(SESSION_KEY);
  clearOwnerToken();
}

/** 登录成功后换取会话 token（凭老板密码，库内校验 + 防爆破 + 发 token） */
export async function ownerLogin(password: string): Promise<boolean> {
  if (!supabase || !password) return false;
  const { data, error } = await supabase.rpc("owner_login", {
    p_password: password,
  });
  if (error) {
    console.warn("[auth] ownerLogin:", error.message);
    return false;
  }
  const res = data as { ok?: boolean; token?: string } | null;
  if (!res?.ok || !res.token) return false;
  try {
    sessionStorage.setItem(TOKEN_KEY, res.token);
  } catch {
    /* 隐私模式下 sessionStorage 可能不可用，忽略 */
  }
  return true;
}

/** 当前会话 token（未登录/未配置 Supabase 时返回 null） */
export function getOwnerToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearOwnerToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthed(): boolean {
  const until = localRaw(SESSION_KEY);
  return !!until && Date.now() < parseInt(until, 10);
}
