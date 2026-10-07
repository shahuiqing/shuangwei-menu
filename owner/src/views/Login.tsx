import { useState } from "react";
import type { FormEvent } from "react";
import { Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import {
  verifyOwnerPassword,
  markAuthed,
  setOwnerPasswordLocal,
  needsPasswordSetup,
  setupOwnerPassword,
  MIN_PASSWORD_LEN,
} from "../lib/auth";
import { STORE_NAME } from "../lib/supabase";

const fieldCls =
  "w-full bg-zinc-950/80 border border-white/[0.07] rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/70 focus:ring-4 focus:ring-orange-500/15 focus:bg-zinc-950 transition-all";

export default function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"login" | "change" | "setup">(() =>
    needsPasswordSetup() ? "setup" : "login",
  );
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const handleSetup = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD_LEN) {
      setErr(`密码至少 ${MIN_PASSWORD_LEN} 位`);
      return;
    }
    if (pw !== pw2) {
      setErr("两次输入的密码不一致");
      return;
    }
    if (!setupOwnerPassword(pw)) {
      setErr("设置失败，请重试");
      return;
    }
    markAuthed();
    onDone();
  };

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
      <div className="pointer-events-none absolute -top-32 right-[-10%] w-[420px] h-[420px] rounded-full bg-orange-500/[0.08] blur-[110px]" />

      <div className="relative w-full max-w-sm animate-rise">
        <div className="flex flex-col items-center mb-6">
          <div className="w-[74px] h-[74px] rounded-2xl seal-cinnabar flex items-center justify-center mb-4 shadow-[0_18px_40px_-16px_rgba(146,43,33,0.6)]">
            <span className="text-[36px] leading-none">双</span>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-[0.12em] text-white">
            {STORE_NAME}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            老板管理端 · Owner Console
          </p>
        </div>

        <div className="card-surface p-6 sm:p-7">
          {mode === "setup" ? (
            <form onSubmit={handleSetup} className="space-y-3.5">
              <div className="flex items-start gap-2 text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                首次使用：系统无内置默认密码，请设置老板密码（至少{" "}
                {MIN_PASSWORD_LEN} 位）。
              </div>
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
                  placeholder={`设置密码（至少 ${MIN_PASSWORD_LEN} 位）`}
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
              <div className="relative">
                <ShieldCheck
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                />
                <input
                  type={show ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => {
                    setPw2(e.target.value);
                    setErr("");
                  }}
                  placeholder="再次输入密码"
                  className={fieldCls}
                />
              </div>
              {err && (
                <p className="flex items-center gap-1.5 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={15} className="shrink-0" />
                  {err}
                </p>
              )}
              <button
                type="submit"
                className="w-full btn-brand text-white font-bold rounded-xl px-4 py-3.5 active:scale-[0.98] transition-transform"
              >
                设置并进入
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                已有密码？直接登录
              </button>
            </form>
          ) : mode === "login" ? (
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

              {needsPasswordSetup() && (
                <p className="text-[12px] text-zinc-500 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2">
                  本机尚未设置过密码；若服务端已配置密码可直接登录，否则请
                  <button
                    type="button"
                    onClick={() => {
                      setMode("setup");
                      setErr("");
                    }}
                    className="text-orange-400 hover:text-orange-300 underline underline-offset-2 mx-0.5"
                  >
                    设置密码
                  </button>
                  。
                </p>
              )}

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
