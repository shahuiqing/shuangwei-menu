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
 * EdgeOne Pages Function: POST /api/auth/change-owner-password
 * 老板端改密：验旧密码（云端 ownerPasswordHash / ADMIN_SECRET）后写新 bcrypt 哈希。
 * 不依赖 ADMIN_SECRET，靠「旧密码正确」鉴权；云端未配置时视为首次云端设密。
 */
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
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
          verified = await bcrypt.compare(String(oldPassword || ""), hash);
        } else {
          verified = true;
        }
      } catch (e) {
        console.error("[auth/change-owner-password] supabase error", e);
      }
    } else {
      verified = true;
    }

    if (!verified && context.env.ADMIN_SECRET) {
      verified = String(oldPassword || "") === context.env.ADMIN_SECRET;
    }
    if (!verified) {
      return json({ ok: false, error: "old password incorrect" }, 401);
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    const supabase = createClient(supabaseUrl!, supabaseKey!);
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
