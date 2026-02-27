import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Download,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import TablePagination from "@/components/ui/TablePagination";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import { useTableSort } from "@/components/ui/table/useTableSort";
import { useToast } from "@/components/ui/toast/useToast";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import type { BookletDTO } from "@/features/cadernos/types";
import { formatDateTime } from "@/features/cadernos/utils";
import {
  deleteBooklet,
  listBooklets,
} from "@/features/cadernos/services/booklets";
import {
  downloadBookletApplicationKit,
} from "@/features/ofertas/services/offers";
import { isBookletKitPending, setBookletKitPending } from "@/features/ofertas/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type SortKey = "name" | "count" | "created_at";

function countItems(booklet: BookletDTO) {
  if (typeof booklet.items_count === "number") return booklet.items_count;
  if (Array.isArray(booklet.items)) return booklet.items.length;
  return 0;
}

export default function CadernosList() {
  const navigate = useNavigate();
  const { toast, dismiss } = useToast();
  const { userId } = useAuth();
  const [items, setItems] = useState<BookletDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { sort, toggleSort, getSortIcon } = useTableSort<SortKey>({
    key: "created_at",
    dir: "desc",
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingKitId, setDownloadingKitId] = useState<number | null>(null);
  const showLoading = useDelayedLoading(loading);

  useEffect(() => {
    void load("");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load(q);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [q]);

  async function load(searchText: string) {
    try {
      setLoading(true);
      setErr("");
      const data = await listBooklets({ search: searchText });
      setItems(data.filter((item) => !item.deleted));
    } catch (error: unknown) {
      setItems([]);
      setErr("Não foi possível carregar os cadernos.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteConfirm() {
    if (!selectedId) return;
    try {
      setDeleting(true);
      await deleteBooklet(selectedId);
      setItems((prev) => prev.filter((item) => item.id !== selectedId));
      setSelectedId(null);
      toast({ type: "success", title: "Caderno removido com sucesso" });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao remover caderno",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDeleting(false);
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const av =
        sort.key === "name"
          ? a.name
          : sort.key === "count"
            ? countItems(a)
            : new Date(a.created_at).getTime();
      const bv =
        sort.key === "name"
          ? b.name
          : sort.key === "count"
            ? countItems(b)
            : new Date(b.created_at).getTime();

      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "pt-BR", {
        sensitivity: "base",
      });
    });
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [items, sort]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage]);

  async function onDownloadKit(bookletId: number) {
    const loadingToastId = toast({
      type: "info",
      title: "Baixando kit de aplicação...",
      message: "Aguarde enquanto os PDFs são gerados.",
      duration: 20000,
    });
    try {
      setDownloadingKitId(bookletId);
      await downloadBookletApplicationKit(bookletId);
      setBookletKitPending(bookletId, false);
      toast({ type: "success", title: "Kit de aplicação baixado com sucesso" });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao baixar kit de aplicação",
        message: getApiErrorMessage(error),
      });
    } finally {
      dismiss(loadingToastId);
      setDownloadingKitId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-borderDark dark:bg-surface-1" aria-busy={loading}>
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">Cadernos de Prova</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-300">Crie, edite e gerencie seus cadernos.</p>
        </div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-300">Buscar cadernos</label>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Nome do caderno"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-borderDark dark:bg-surface-1 dark:text-slate-100"
            />
          </div>

          <Link
            to="/cadernos/novo"
            className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
          >
            + Novo caderno
          </Link>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-300">
          {loading ? (showLoading ? <EqualizerLoader size={16} /> : null) : `${sortedItems.length} caderno(s)`}
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-borderDark dark:bg-surface-1" aria-busy={loading}>
        {loading ? (
          <div className="flex items-center justify-center px-4 py-8">
            {showLoading ? <EqualizerLoader size={36} /> : null}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
            Nenhum caderno encontrado.
          </div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-borderDark dark:bg-surface-2">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Nome
                    {getSortIcon("name")}
                  </button>
                </th>
                <th className="w-40 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("count")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Qtd questões
                    {getSortIcon("count")}
                  </button>
                </th>
                <th className="w-56 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("created_at")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Criado em
                    {getSortIcon("created_at")}
                  </button>
                </th>
                <th className="w-52 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const isMine = Number(item.created_by) === Number(userId);
                const kitPending = isBookletKitPending(item.id);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-borderDark dark:hover:bg-surface-2"
                  >
                    <td className="px-5 py-3 text-sm text-slate-800 dark:text-slate-100">
                      {kitPending ? (
                        <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                          <TriangleAlert className="h-3.5 w-3.5 shrink-0 self-center" />
                          <span className="leading-none">Download pendente</span>
                        </div>
                      ) : null}
                      <Link
                        to={`/cadernos/${item.id}`}
                        className="block font-medium text-slate-900 hover:text-brand-500 hover:underline dark:text-slate-100 dark:hover:text-brand-400"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">{countItems(item)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1">
                        {isMine && (
                          <>
                            <button
                              type="button"
                              onClick={() => void onDownloadKit(item.id)}
                              disabled={downloadingKitId === item.id}
                              className="p-2 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-emerald-50 dark:text-slate-300 dark:hover:text-brand-400 dark:hover:bg-brand-500/15 transition disabled:opacity-50"
                              title="Baixar kit aplicação"
                              aria-label="Baixar kit aplicação"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/cadernos/${item.id}/editar`)}
                              className="p-2 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-emerald-50 dark:text-slate-300 dark:hover:text-brand-400 dark:hover:bg-brand-500/15 transition"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 dark:hover:text-red-300 transition"
                              title="Remover definitivamente"
                              aria-label="Remover definitivamente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!loading && sortedItems.length > 0 && (
        <TablePagination
          page={currentPage}
          hasPrevious={currentPage > 1}
          hasNext={currentPage < totalPages}
          onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        />
      )}

      <ConfirmDialog
        open={selectedId !== null}
        title="Excluir caderno"
        description="Tem certeza que deseja excluir este caderno?"
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setSelectedId(null);
        }}
        onConfirm={onDeleteConfirm}
      />
    </div>
  );
}
