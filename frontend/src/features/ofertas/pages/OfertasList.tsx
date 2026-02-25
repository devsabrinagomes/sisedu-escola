import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DatePickerInput from "@/components/ui/DatePickerInput";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import TablePagination from "@/components/ui/TablePagination";
import { useTableSort } from "@/components/ui/table/useTableSort";
import { useToast } from "@/components/ui/toast/useToast";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import { useOfferListData } from "@/features/ofertas/hooks/useOfferListData";
import {
  deleteOffer,
  listOffers,
} from "@/features/ofertas/services/offers";
import type { OfferDTO, OfferStatus } from "@/features/ofertas/types";
import {
  formatDate,
  getBookletName,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
} from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

type SortKey = "id" | "booklet" | "period" | "created_at";

export default function OfertasList() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    items,
    setItems,
    count,
    nextPage,
    previousPage,
    loading,
    err,
    filters,
    setFilters,
  } = useOfferListData<OfferDTO>({
    initialFilters: {
      search: "",
      status: "all",
      start_date: "",
      end_date: "",
      page: 1,
    },
    loadOffers: listOffers,
    loadErrorMessage: "Não foi possível carregar as ofertas.",
  });

  const { sort, toggleSort, getSortIcon } = useTableSort<SortKey>({
    key: "created_at",
    dir: "desc",
  });
  const showLoading = useDelayedLoading(loading);

  async function onDeleteConfirm() {
    if (!deletingId) return;
    try {
      setDeleting(true);
      await deleteOffer(deletingId);
      setItems((prev) => prev.filter((offer) => offer.id !== deletingId));
      setDeletingId(null);
      toast({ type: "success", title: "Oferta removida com sucesso" });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao remover oferta",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDeleting(false);
    }
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const av =
        sort.key === "id"
          ? a.id
          : sort.key === "booklet"
            ? getBookletName(a)
            : sort.key === "period"
              ? `${a.start_date}-${a.end_date}`
              : new Date(a.created_at).getTime();
      const bv =
        sort.key === "id"
          ? b.id
          : sort.key === "booklet"
            ? getBookletName(b)
            : sort.key === "period"
              ? `${b.start_date}-${b.end_date}`
              : new Date(b.created_at).getTime();

      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), "pt-BR", { sensitivity: "base" });
    });

    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [items, sort]);

  function setStatusFilter(value: string) {
    const nextStatus: OfferStatus | "all" =
      value === "upcoming" || value === "open" || value === "closed"
        ? value
        : "all";

    setFilters((prev) => ({
      ...prev,
      status: nextStatus,
      page: 1,
    }));
  }

  const hasFilters = Boolean(
    filters.search ||
      (filters.status && filters.status !== "all") ||
      filters.start_date ||
      filters.end_date,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-borderDark dark:bg-surface-1" aria-busy={loading}>
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">Ofertas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-300">Defina período e turmas para aplicação.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300">Buscar ofertas</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={filters.search || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
                }
                placeholder="Nome da oferta ou caderno"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-borderDark dark:bg-surface-1 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300">Status</label>
            <select
              value={filters.status || "all"}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-borderDark dark:bg-surface-1 dark:text-slate-100"
            >
              <option value="all">Todos</option>
              <option value="upcoming">Em breve</option>
              <option value="open">Aberta</option>
              <option value="closed">Encerrada</option>
            </select>
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300">Início a partir de</label>
            <DatePickerInput
              value={filters.start_date || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, start_date: e, page: 1 }))
              }
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-300">Fim até</label>
            <DatePickerInput
              value={filters.end_date || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, end_date: e, page: 1 }))
              }
            />
          </div>

        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-300">
            {loading ? (showLoading ? <EqualizerLoader size={16} /> : null) : `${count} oferta(s)`}
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: "",
                    status: "all",
                    start_date: "",
                    end_date: "",
                    page: 1,
                  })
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300 dark:hover:bg-surface-2"
              >
                Limpar
              </button>
            )}
            <Link
              to="/ofertas/nova"
              className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
            >
              + Nova oferta
            </Link>
          </div>
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
            Nenhuma oferta encontrada.
            <div className="mt-3">
              <Link
                to="/ofertas/nova"
                className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
              >
                Criar oferta
              </Link>
            </div>
          </div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-borderDark dark:bg-surface-2">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("booklet")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Oferta
                    {getSortIcon("booklet")}
                  </button>
                </th>
                <th className="w-44 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("period")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Período
                    {getSortIcon("period")}
                  </button>
                </th>
                <th className="w-40 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Status</th>
                <th className="w-28 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((offer) => {
                const status = getOfferStatus(offer);
                const isMine = Number(offer.created_by) === Number(userId);
                return (
                  <tr
                    key={offer.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-borderDark dark:hover:bg-surface-2"
                  >
                    <td className="px-5 py-3 text-sm text-slate-800 dark:text-slate-100">
                      <Link
                        to={`/ofertas/${offer.id}`}
                        className="block font-medium text-slate-900 hover:text-brand-500 hover:underline dark:text-slate-100 dark:hover:text-brand-400"
                      >
                        {offer.description?.trim() || "-"}
                      </Link>
                      <div className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-300">
                        {getBookletName(offer)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatDate(offer.start_date)} - {formatDate(offer.end_date)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(status)}`}
                      >
                        {getOfferStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1">
                        {isMine && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate(`/ofertas/${offer.id}/editar`)}
                              className="p-2 rounded-lg text-slate-500 hover:text-brand-500 hover:bg-emerald-50 dark:text-slate-300 dark:hover:text-brand-400 dark:hover:bg-brand-500/15 transition"
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(offer.id)}
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

      <TablePagination
        page={filters.page || 1}
        hasPrevious={Boolean(previousPage)}
        hasNext={Boolean(nextPage)}
        loading={loading}
        onPrevious={() =>
          setFilters((prev) => ({ ...prev, page: Math.max(1, (prev.page || 1) - 1) }))
        }
        onNext={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
      />

      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir oferta"
        description="Tem certeza que deseja excluir esta oferta?"
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setDeletingId(null);
        }}
        onConfirm={onDeleteConfirm}
      />
    </div>
  );
}
