import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("prof1");
  const [password, setPassword] = useState("123456");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

const inputBase =
  "h-11 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-slate-900 " +
  "placeholder:text-slate-400 shadow-sm " +
  "focus:outline-none focus:ring-4 focus:ring-emerald-200 focus:border-emerald-500";


  const btnBase =
    "h-11 w-full rounded-xl font-semibold shadow-sm transition " +
    "focus:outline-none focus:ring-4 focus:ring-emerald-200 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(username, password);
      nav("/");
    } catch {
      setErr("Usuário ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

return (
<div className="w-full max-w-md mx-auto rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur overflow-hidden">
    <div className="p-6 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold">
          S
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">SISEDU Escola</h1>
          <p className="text-xs text-slate-500">Acesso ao sistema</p>
        </div>
      </div>
    </div>

    <form onSubmit={onSubmit} className="p-6 space-y-4">
      <p className="text-sm text-slate-600">
        Use um usuário do seed (ex.: <b>prof1</b> / <b>123456</b>)
      </p>

      <div>
        <label className="text-xs font-medium text-slate-600">Usuário</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`${inputBase} mt-1`}
          placeholder="ex.: prof1"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600">Senha</label>
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
        className="h-11 w-full rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-xs text-slate-400">
        © {new Date().getFullYear()} SISEDU
      </p>
    </form>
  </div>
);

}
