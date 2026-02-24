import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("prof1");
  const [password, setPassword] = useState("123456");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

const inputBase =
  "h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-slate-900 " +
  "placeholder:text-slate-400 shadow-sm dark:border-borderDark dark:bg-surface-2 dark:text-slate-100 " +
  "focus:outline-none focus:ring-4 focus:ring-brand-500/40 focus:border-brand-500";


  const btnBase =
    "h-11 w-full rounded-xl font-semibold shadow-sm transition " +
    "focus:outline-none focus:ring-4 focus:ring-brand-500/40 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(username, password);
      nav("/");
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

return (
<div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur dark:border-borderDark dark:bg-surface-1">
    <div className="border-b border-slate-100 p-6 dark:border-borderDark">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-brand-500 text-white grid place-items-center font-bold">
          S
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">SISEDU Escola</h1>
          <p className="text-xs text-slate-500 dark:text-slate-300">Acesso ao sistema</p>
        </div>
      </div>
    </div>

    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Use um usuário do seed (ex.: <b>prof1</b> / <b>123456</b>)
      </p>

      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Usuário</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`${inputBase} mt-1`}
          placeholder="ex.: prof1"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${inputBase} mt-1`}
          placeholder="••••••••"
        />
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <button
        disabled={loading}
        className="h-11 w-full rounded-xl bg-brand-500 text-white font-semibold shadow-sm hover:bg-brand-600 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-brand-500/40 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        © {new Date().getFullYear()} SISEDU
      </p>
    </form>
  </div>
);

}
