import { useState } from "react";
import type { FormEvent } from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import {
  verifyOwnerPassword,
  markAuthed,
  setOwnerPasswordLocal,
} from "../lib/auth";
import { STORE_NAME } from "../lib/supabase";

const fieldCls =
  "w-full bg-zinc-950/80 border border-white/[0.07] rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/70 focus:ring-4 focus:ring-orange-500/15 focus:bg-zinc-950 transition-all";

export default function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"login" | "change">("login");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

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
      <div className="pointer-events-none absolute -top-32 right-[-10%] w-[420px] h-[420px] rounded-full bg-orange-600/20 blur-[110px] animate-[floatY_9s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-32 left-[-12%] w-[380px] h-[380px] rounded-full bg-orange-900/25 blur-[110px] animate-[floatY_11s_ease-in-out_infinite_reverse]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />

      <div className="relative w-full max-w-sm animate-rise">
        <div className="flex flex-col items-center mb-6">
          <div className="w-[74px] h-[74px] rounded-[26px] bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center mb-4 shadow-[0_18px_40px_-16px_rgba(234,88,12,0.85)] ring-1 ring-white/15">
            <span className="text-[34px] font-black leading-none">双</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {STORE_NAME}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            老板管理端 · Owner Console
          </p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="relative">
                <Lock
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                />
                <input
                  type={show ? "text" : "password"}
                  value={pw}
                  autoFocus
                  onChange={(e) => {
                    setPw(e.target.value);
                    setErr("");
                  }}
                  placeholder="请输入管理密码"
                  className={fieldCls}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label="显示/隐藏密码"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-colors"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {err && (
                <p className="flex items-center gap-1.5 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {err}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full btn-brand text-white font-bold rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {busy ? "验证中…" : "登 录"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("change");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                修改密码
              </button>
            </form>
          ) : (
            <form onSubmit={handleChange} className="space-y-3.5">
              <div className="relative">
                <Lock
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                />
                <input
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    setErr("");
                  }}
                  placeholder="当前密码"
                  className={fieldCls}
                />
              </div>
              <div className="relative">
                <ShieldCheck
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                />
                <input
                  type={show ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => {
                    setNewPw(e.target.value);
                    setErr("");
                  }}
                  placeholder="新密码"
                  className={fieldCls}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label="显示/隐藏密码"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-colors"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {err && (
                <p className="flex items-center gap-1.5 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {err}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full btn-brand text-white font-bold rounded-xl px-4 py-3.5 transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck size={18} /> {busy ? "验证中…" : "确认修改并登录"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                返回登录
              </button>
            </form>
          )}
        </div>

        <p className="text-[11px] text-zinc-600 text-center mt-5">
          密码存于本机浏览器，不依赖数据库
        </p>
      </div>
    </div>
  );
}
