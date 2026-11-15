import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  Languages,
} from "lucide-react";
import {
  verifyOwnerPassword,
  markAuthed,
  changeOwnerPassword,
  needsPasswordSetup,
  setupOwnerPassword,
  MIN_PASSWORD_LEN,
} from "../lib/auth";
import { STORE_NAME } from "../lib/supabase";
import {
  staffLogin,
  saveStaffSession,
  type StaffSession,
} from "../lib/staffOps";
import { t, getLang, setLang, onLangChange, isRtl, LANGS } from "../i18n";

const fieldCls =
  "w-full bg-zinc-950/80 border border-white/[0.07] rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/70 focus:ring-4 focus:ring-orange-500/15 focus:bg-zinc-950 transition-all";

export default function Login({
  onDone,
  onStaffOk,
}: {
  onDone: () => void;
  onStaffOk?: (s: Omit<StaffSession, "exp">) => void;
}) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"login" | "change" | "setup" | "staff">(
    () => (needsPasswordSetup() ? "setup" : "login"),
  );
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffPw, setStaffPw] = useState("");
  const [, force] = useState(0);
  useEffect(() => onLangChange(() => force((v) => v + 1)), []);

  /** 语言切换（三语，老板端与员工表单共用） */
  const langSwitch = (
    <div
      dir="ltr"
      className="flex items-center justify-center gap-1 bg-zinc-900 border border-white/5 rounded-full px-1 py-0.5 w-fit mx-auto"
    >
      <Languages size={13} className="text-zinc-500 mx-1" />
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLang(l.id)}
          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            getLang() === l.id
              ? "bg-orange-600 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );

  const handleStaffLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffPw) {
      setErr(t("login.errFill"));
      return;
    }
    setBusy(true);
    const s = await staffLogin(staffName, staffPw);
    setBusy(false);
    if (s && onStaffOk) {
      saveStaffSession(s);
      onStaffOk(s);
    } else {
      setErr(t("login.errStaffFail"));
    }
  };

  const handleSetup = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD_LEN) {
      setErr(t("login.errPwLen", { n: MIN_PASSWORD_LEN }));
      return;
    }
    if (pw !== pw2) {
      setErr(t("login.errPwMismatch"));
      return;
    }
    if (!setupOwnerPassword(pw)) {
      setErr(t("login.errSetFail"));
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
      setErr(t("login.errPwWrong"));
    }
  };

  const handleChange = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await verifyOwnerPassword(pw);
    setBusy(false);
    if (!ok) {
      setErr(t("login.errCurrentWrong"));
      return;
    }
    if (newPw.trim().length < MIN_PASSWORD_LEN) {
      setErr(t("login.errNewPwLen", { n: MIN_PASSWORD_LEN }));
      return;
    }
    const r = await changeOwnerPassword(pw, newPw.trim());
    if (!r.ok) {
      setErr(t("login.errPwLen", { n: MIN_PASSWORD_LEN }));
      return;
    }
    markAuthed();
    onDone();
  };

  return (
    <div
      dir={isRtl() ? "rtl" : "ltr"}
      className="min-h-full relative flex items-center justify-center p-6 bg-zinc-950 overflow-hidden"
    >
      <div className="pointer-events-none absolute -top-32 right-[-10%] w-[420px] h-[420px] rounded-full bg-orange-500/[0.08] blur-[110px]" />

      <div className="relative w-full max-w-sm animate-rise">
        <div className="flex flex-col items-center mb-6">
          <div className="w-[74px] h-[74px] rounded-2xl seal-cinnabar flex items-center justify-center mb-4 shadow-[0_18px_40px_-16px_rgba(146,43,33,0.6)]">
            <span className="text-[36px] leading-none">双</span>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-[0.12em] text-white">
            {STORE_NAME}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{t("login.bossConsole")}</p>
        </div>

        <div className="mb-3">{langSwitch}</div>

        <div className="card-surface p-6 sm:p-7">
          {mode === "setup" ? (
            <form onSubmit={handleSetup} className="space-y-3.5">
              <div className="flex items-start gap-2 text-[12px] text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                {t("login.setupHint", { n: MIN_PASSWORD_LEN })}
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
                  placeholder={t("login.setupPw", { n: MIN_PASSWORD_LEN })}
                  className={fieldCls}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={t("common.showPw")}
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
                  placeholder={t("login.pwAgain")}
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
                {t("login.setAndEnter")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                {t("login.hasPw")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("staff");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                {t("login.staffEntry")}
              </button>
            </form>
          ) : mode === "staff" ? (
            <form
              onSubmit={handleStaffLogin}
              dir={isRtl() ? "rtl" : "ltr"}
              className="space-y-3.5"
            >
              <div
                dir="ltr"
                className="flex items-center justify-center gap-1 text-sm text-zinc-400"
              >
                <User size={16} className="text-orange-500" />
                <span className="text-center">
                  {t("login.staffTitle")} · {t("login.staffHint")}
                </span>
              </div>
              <input
                value={staffName}
                autoFocus
                onChange={(e) => {
                  setStaffName(e.target.value);
                  setErr("");
                }}
                placeholder={t("login.name")}
                className={fieldCls.replace("pl-11", "pl-4")}
              />
              <div className="relative">
                <Lock
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                />
                <input
                  type={show ? "text" : "password"}
                  value={staffPw}
                  onChange={(e) => {
                    setStaffPw(e.target.value);
                    setErr("");
                  }}
                  placeholder={t("login.password")}
                  className={fieldCls}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={t("common.showPw")}
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
                {busy ? t("login.verifying") : t("login.staffTitle")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode(needsPasswordSetup() ? "setup" : "login");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                {t("login.backToOwner")}
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
                  placeholder={t("login.ownerPw")}
                  className={fieldCls}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={t("common.showPw")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-colors"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {needsPasswordSetup() && (
                <p className="text-[12px] text-zinc-500 bg-zinc-950 border border-white/5 rounded-lg px-3 py-2">
                  {t("login.localNotSet")}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("setup");
                      setErr("");
                    }}
                    className="text-orange-400 hover:text-orange-300 underline underline-offset-2 mx-0.5"
                  >
                    {t("login.setPwLink")}
                  </button>
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
                {busy ? t("login.verifying") : t("login.login")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("change");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                {t("login.changePw")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("staff");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors border-t border-white/5 mt-1 pt-3"
              >
                {t("login.staffEntry")}
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
                  placeholder={t("login.currentPw")}
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
                  placeholder={t("login.newPw")}
                  className={fieldCls}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={t("common.showPw")}
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
                <ShieldCheck size={18} />{" "}
                {busy ? t("login.verifying") : t("login.confirmChange")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                {t("login.backToLogin")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("staff");
                  setErr("");
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                {t("login.staffEntry")}
              </button>
            </form>
          )}
        </div>

        <p className="text-[11px] text-zinc-600 text-center mt-5">
          {t("login.localNote")}
        </p>
      </div>
    </div>
  );
}
