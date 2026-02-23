import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import TablePagination from "@/components/ui/TablePagination";
import { useToast } from "@/components/ui/toast/useToast";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import type { BookletDTO } from "@/features/cadernos/types";
import { formatDateTime } from "@/features/cadernos/utils";
import {
  deleteBooklet,
  listBooklets,
} from "@/features/cadernos/services/booklets";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type SortKey = "name" | "count" | "created_at";
type SortDir = "asc" | "desc";

function countItems(booklet: BookletDTO) {
  if (typeof booklet.items_count === "number") return booklet.items_count;
  if (Array.isArray(booklet.items)) return booklet.items.length;
  return 0;
}

export default function CadernosList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId } = useAuth();
  const [items, setItems] = useState<BookletDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "created_at",
    dir: "desc",
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }

  function getSortIcon(column: SortKey) {
    const active = sort.key === column;
    if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    return sort.dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    );
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs font-medium text-slate-500">Buscar cadernos</label>
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Nome do caderno"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          <Link
            to="/cadernos/novo"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            + Novo caderno
          </Link>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {loading ? "Carregando..." : `${sortedItems.length} caderno(s)`}
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-sm text-slate-500">Carregando...</div>
        ) : sortedItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            Nenhum caderno encontrado.
          </div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Nome
                    {getSortIcon("name")}
                  </button>
                </th>
                <th className="w-40 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("count")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Qtd questões
                    {getSortIcon("count")}
                  </button>
                </th>
                <th className="w-56 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("created_at")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Criado em
                    {getSortIcon("created_at")}
                  </button>
                </th>
                <th className="w-52 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const isMine = Number(item.created_by) === Number(userId);
                return (
                  <tr
                    key={item.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-sm text-slate-800">
                      <Link
                        to={`/cadernos/${item.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">{countItems(item)}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        {isMine && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate(`/cadernos/${item.id}/editar`)}
                              className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
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
