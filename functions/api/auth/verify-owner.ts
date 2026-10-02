import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ADMIN_SECRET?: string;
}

/**
 * EdgeOne Pages Function: POST /api/auth/verify-owner
 * 校验老板端密码：settings.ownerPasswordHash (bcrypt)
 * 回退：ADMIN_SECRET（若未配置 owner 密码哈希）
 * 与顾客端管理员密码分离。
 */
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
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
          const ok = await bcrypt.compare(String(password), hash);
          return json({ ok });
        }
      } catch (e) {
        console.error("[auth/verify-owner] supabase error", e);
      }
    }

    if (context.env.ADMIN_SECRET) {
      return json({ ok: String(password) === context.env.ADMIN_SECRET });
    }

    return json({ ok: false, error: "owner password not configured" });
  } catch (e: any) {
    console.error("[auth/verify-owner] error", e);
    return json({ ok: false, error: e.message }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
