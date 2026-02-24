import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { Menu, Moon, Sun } from "lucide-react";
import logo from "../assets/images/logo/logo.png";
import logoDark from "../assets/images/logo/logo-darkmode.png";
import { useTheme } from "@/shared/hooks/useTheme";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // fecha ao apertar ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-darkbg dark:text-slate-100">
      {/* HEADER */}
      <header className="sticky top-0 z-20 h-auto border-b border-green-500 bg-white shadow-md dark:border-borderDark dark:bg-surface-1">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Botão sanduíche: só no mobile */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:hidden dark:text-slate-100 dark:hover:bg-surface-2 dark:focus-visible:ring-brand-500/40"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <img
              src={theme === "dark" ? logoDark : logo}
              alt="SISEDU Escola"
              className="h-20 w-auto"
            />
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-borderDark dark:bg-surface-2 dark:text-brand-400 dark:hover:bg-surface-2"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* DRAWER MOBILE */}
      <div
        className={cx(
          "fixed inset-0 z-40 lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* backdrop */}
        <div
          className={cx(
            "absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />

        {/* painel animado */}
        <div
          className={cx(
            "absolute left-4 top-4 w-[86%] max-w-[320px]",
            "transition-all duration-300 ease-out",
            open
              ? "translate-x-0 opacity-100"
              : "-translate-x-8 opacity-0"
          )}
          role="dialog"
          aria-modal="true"
        >
          <Sidebar
            onNavigate={() => setOpen(false)}
            showTitle
            headerRight={
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Fechar"
              >
                ✕
              </button>
            }
          />
        </div>
      </div>


      {/* CONTEÚDO */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex gap-6">
          {/* Sidebar fixa: só desktop */}
          <div className="hidden lg:block w-64 shrink-0">
            <Sidebar />
          </div>

          <section className="min-w-0 flex-1">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}
