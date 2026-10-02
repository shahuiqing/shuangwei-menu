import { useState } from "react";
import type { FormEvent } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import {
  verifyOwnerPassword,
  markAuthed,
  setOwnerPasswordLocal,
} from "../lib/auth";
import { STORE_NAME } from "../lib/supabase";

export default function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"login" | "change">("login");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await verifyOwnerPassword(pw);
    setBusy(false);
    if (ok) {
      markAuthed();
      onDone();
    } else {
      setErr("密码错误 / Incorrect password");
    }
  };

  const handleChange = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await verifyOwnerPassword(pw);
    setBusy(false);
    if (!ok) {
      setErr("当前密码错误 / Current password incorrect");
      return;
    }
    if (!newPw.trim()) {
      setErr("新密码不能为空");
      return;
    }
    setOwnerPasswordLocal(newPw.trim());
    markAuthed();
    onDone();
  };

  return (
    <div className="min-h-full relative flex items-center justify-center p-6 bg-zinc-950 overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-orange-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-orange-900/20 blur-3xl" />
      <div className="relative w-full max-w-sm bg-zinc-900/80 backdrop-blur border border-white/10 rounded-[28px] p-7 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 text-white flex items-center justify-center mb-4 shadow-lg shadow-orange-900/40">
            <Lock size={28} />
          </div>
          <h1 className="text-xl font-bold text-white">{STORE_NAME}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            老板管理端 · Owner Console
          </p>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={pw}
              autoFocus
              onChange={(e) => {
                setPw(e.target.value);
                setErr("");
              }}
              placeholder="请输入管理密码"
              className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full btn-brand text-white font-bold rounded-xl px-4 py-3 transition-colors disabled:opacity-50"
            >
              {busy ? "验证中…" : "登 录"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("change");
                setErr("");
              }}
              className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1"
            >
              修改密码
            </button>
          </form>
        ) : (
          <form onSubmit={handleChange} className="space-y-4">
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setErr("");
              }}
              placeholder="当前密码"
              className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => {
                setNewPw(e.target.value);
                setErr("");
              }}
              placeholder="新密码"
              className="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full btn-brand text-white font-bold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck size={18} /> {busy ? "验证中…" : "确认修改并登录"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErr("");
              }}
              className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1"
            >
              返回登录
            </button>
          </form>
        )}
        <p className="text-[11px] text-zinc-600 text-center mt-6">
          密码存于本机浏览器，不依赖数据库
        </p>
      </div>
    </div>
  );
}
