import { useState } from "react";
import type { FormEvent } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { verifyOwnerPassword, markAuthed, setOwnerPassword } from "../lib/auth";
import { STORE_NAME } from "../lib/supabase";

export default function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"login" | "change">("login");
  const [newPw, setNewPw] = useState("");

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (verifyOwnerPassword(pw)) {
      markAuthed();
      onDone();
    } else {
      setErr("密码错误 / Incorrect password");
    }
  };

  const handleChange = (e: FormEvent) => {
    e.preventDefault();
    if (!verifyOwnerPassword(pw)) {
      setErr("当前密码错误 / Current password incorrect");
      return;
    }
    if (!newPw.trim()) {
      setErr("新密码不能为空");
      return;
    }
    setOwnerPassword(newPw.trim());
    markAuthed();
    onDone();
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-zinc-950">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-orange-600/20 text-orange-500 flex items-center justify-center mb-4">
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl px-4 py-3 transition-colors"
            >
              登 录
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => {
                setNewPw(e.target.value);
                setErr("");
              }}
              placeholder="新密码"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
            />
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} /> 确认修改并登录
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
