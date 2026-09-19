import { createClient } from "@supabase/supabase-js";

// P1-11 修复：移除 localStorage 可覆盖 SUPABASE_URL 后门（XSS 可劫持指向任意库）
// 如需本地调试，请通过 .env 的 VITE_SUPABASE_URL 配置，而非 localStorage
// import.meta.env 在 tsx/Node（服务端 auth.ts 链路）下为 undefined，用可选链兜底
export const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
export const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseHealthy = true;
