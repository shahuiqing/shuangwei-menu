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
 * EdgeOne Pages Function: POST /api/auth/verify
 * 校验管理员密码：
 * 1) Supabase settings.adminPasswordHash (bcrypt)
 * 2) ADMIN_SECRET 环境变量
 *
 * 安全：加 IP 限流（FIX_PLAN #6）—— 此前该端点可被无限次暴力破解。
 */
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  // 限流：同一 IP 每 60 秒最多 10 次尝试
  if (!allowRequest(context.request, "auth-verify", 60_000, 10)) {
    return tooManyRequests(60);
  }
  try {
    const { password } = await context.request.json().catch(() => ({}));
    if (!password) {
      return json({ ok: false, error: "password required" }, 400);
    }

    const supabaseUrl =
      context.env.SUPABASE_URL || context.env.VITE_SUPABASE_URL;
    const supabaseKey =
      context.env.SUPABASE_SERVICE_ROLE_KEY ||
      context.env.VITE_SUPABASE_ANON_KEY;

    // 1) Supabase（优先 service role，保证能读 adminPasswordHash）
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from("settings")
          .select("adminPasswordHash")
          .eq("id", "global")
          .maybeSingle();
        if (data) {
          const hash: string = data.adminPasswordHash || "";
          if (hash.startsWith("$2")) {
            const ok = await bcrypt.compare(String(password), hash);
            return json({ ok });
          }
        }
      } catch (e) {
        console.error("[auth/verify] supabase error", e);
      }
    }

    // 2) ADMIN_SECRET 兜底
    if (context.env.ADMIN_SECRET) {
      return json({ ok: String(password) === context.env.ADMIN_SECRET });
    }

    return json({ ok: false });
  } catch (e: any) {
    console.error("[auth/verify] error", e);
    return json({ ok: false, error: e.message }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
