import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { allowRequest, tooManyRequests } from "../../_lib/helpers";

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ADMIN_SECRET?: string;
}

/**
 * EdgeOne Pages Function: POST /api/auth/change-owner-password
 * 老板端改密：验旧密码（云端 ownerPasswordHash / ADMIN_SECRET）后写新 bcrypt 哈希。
 *
 * 安全修复（FIX_PLAN #6 + 空 hash 短路）：
 * 1) 加 IP 限流：此前可被无限次暴力猜测旧密码。
 * 2) **不再**在「云端无 hash」或「Supabase 未配置」时把 verified 直接置 true。
 *    原逻辑下，只要把 ownerPasswordHash 清空（anon 可写 settings），
 *    任何人都能在不知道旧密码的情况下改掉老板密码。
 *    现在云端无 hash 时，必须提供 ADMIN_SECRET 才能完成首次设密。
 */
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (!allowRequest(context.request, "auth-change-owner", 60_000, 5)) {
    return tooManyRequests(60);
  }
  try {
    const { oldPassword, newPassword } = await context.request
      .json()
      .catch(() => ({}));
    if (!newPassword || String(newPassword).length < 6) {
      return json({ ok: false, error: "password too short" }, 400);
    }

    const supabaseUrl =
      context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const supabaseKey =
      context.env.SUPABASE_SERVICE_ROLE_KEY ||
      context.env.VITE_SUPABASE_ANON_KEY;

    let verified = false;
    let hashConfigured = false;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from("settings")
          .select("ownerPasswordHash")
          .eq("id", "global")
          .maybeSingle();
        const hash: string = data?.ownerPasswordHash || "";
        if (hash && hash.startsWith("$2")) {
          hashConfigured = true;
          verified = await bcrypt.compare(String(oldPassword || ""), hash);
        }
        // 无 hash：不再短路放行，留给下面的 ADMIN_SECRET 校验
      } catch (e) {
        console.error("[auth/change-owner-password] supabase error", e);
      }
    }

    // 兜底鉴权：ADMIN_SECRET（用于首次云端设密 / 找回）
    if (!verified && context.env.ADMIN_SECRET) {
      const provided = String(oldPassword || "");
      // 恒定时间比较，避免按字符计时侧信道
      verified = timingSafeEqualStr(provided, context.env.ADMIN_SECRET);
    }

    if (!verified) {
      return json(
        {
          ok: false,
          error: hashConfigured
            ? "old password incorrect"
            : "owner password not configured; ADMIN_SECRET required for initial setup",
        },
        401,
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return json({ ok: false, error: "supabase not configured" }, 500);
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase
      .from("settings")
      .update({ ownerPasswordHash: hash })
      .eq("id", "global");
    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }
    return json({ ok: true });
  } catch (e: any) {
    console.error("[auth/change-owner-password] error", e);
    return json({ ok: false, error: e.message }, 500);
  }
}

/** 恒定时间字符串比较（长度不同也不提前返回） */
function timingSafeEqualStr(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
