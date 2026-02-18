import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { Menu, X } from "lucide-react";
import { links } from "./Sidebar"

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Layout() {
  const [open, setOpen] = useState(false);

  // fecha ao apertar ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-emerald-700/20 bg-emerald-600 text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Botão sanduíche: só no mobile */}
            <button
              type="button"
              className="inline-flex lg:hidden items-center justify-center rounded-lg p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="font-semibold tracking-tight">SISEDU Escola</div>
          </div>
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
