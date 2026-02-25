import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import TablePagination from "@/components/ui/TablePagination";
import { useTableSort } from "@/components/ui/table/useTableSort";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import { listGabaritoOffers } from "@/features/gabaritos/services/gabaritos";
import { useOfferListData } from "@/features/ofertas/hooks/useOfferListData";
import type { OfferDTO, OfferStatus } from "@/features/gabaritos/types";
import {
  formatDate,
  getBookletName,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
} from "@/features/ofertas/utils";

type SortKey = "offer" | "booklet" | "period" | "status";

export default function GabaritosList() {
  const {
    items,
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
      page: 1,
    },
    loadOffers: listGabaritoOffers,
    loadErrorMessage: "Não foi possível carregar as ofertas para gabaritos.",
  });

  const { sort, toggleSort, getSortIcon } = useTableSort<SortKey>({
    key: "offer",
    dir: "asc",
  });
  const showLoading = useDelayedLoading(loading);

  function setStatusFilter(value: string) {
    const nextStatus: OfferStatus | "all" =
      value === "upcoming" || value === "open" || value === "closed" ? value : "all";

    setFilters((prev) => ({
      ...prev,
      status: nextStatus,
      page: 1,
    }));
  }

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const statusA = getOfferStatus(a);
      const statusB = getOfferStatus(b);
      const valueA =
        sort.key === "offer"
          ? (a.description || "").toLowerCase()
          : sort.key === "booklet"
            ? getBookletName(a).toLowerCase()
            : sort.key === "period"
              ? `${a.start_date}-${a.end_date}`
              : statusA;
      const valueB =
        sort.key === "offer"
          ? (b.description || "").toLowerCase()
          : sort.key === "booklet"
            ? getBookletName(b).toLowerCase()
            : sort.key === "period"
              ? `${b.start_date}-${b.end_date}`
              : statusB;
      return String(valueA).localeCompare(String(valueB), "pt-BR", {
        sensitivity: "base",
      });
    });
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [items, sort]);

  const hasFilters = Boolean(
    filters.search || (filters.status && filters.status !== "all"),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-borderDark dark:bg-surface-1" aria-busy={loading}>
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">Gabaritos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-300">Gerencie o preenchimento e correção dos gabaritos.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
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
                placeholder="Descrição da oferta ou caderno"
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
          <div className="lg:col-span-2 flex items-end justify-end">
            {hasFilters ? (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: "",
                    status: "all",
                    page: 1,
                  })
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-borderDark dark:bg-surface-1 dark:text-slate-300 dark:hover:bg-surface-2"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-300">
          {loading ? (showLoading ? <EqualizerLoader size={16} /> : null) : `${count} oferta(s)`}
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
          </div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-borderDark dark:bg-surface-2">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("offer")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Oferta
                    {getSortIcon("offer")}
                  </button>
                </th>
                <th className="w-40 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("period")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Período
                    {getSortIcon("period")}
                  </button>
                </th>
                <th className="w-32 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Status
                    {getSortIcon("status")}
                  </button>
                </th>
                <th className="w-48 px-5 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((offer) => {
                const status = getOfferStatus(offer);
                const canManage = status === "open";
                return (
                  <tr
                    key={offer.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50 dark:border-borderDark dark:hover:bg-surface-2"
                  >
                    <td className="px-5 py-3 text-sm text-slate-800 dark:text-slate-100">
                      <Link
                        to={`/gabaritos/ofertas/${offer.id}`}
                        className="block font-medium text-slate-900 hover:text-brand-500 hover:underline dark:text-slate-100 dark:hover:text-brand-400"
                      >
                        {offer.description?.trim() || `Oferta #${offer.id}`}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">{getBookletName(offer)}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      <div>{formatDate(offer.start_date)} -</div>
                      <div>{formatDate(offer.end_date)}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(status)}`}
                      >
                        {getOfferStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {canManage ? (
                        <Link
                          to={`/gabaritos/ofertas/${offer.id}`}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-lg btn-primary px-3 py-2 text-xs font-semibold"
                        >
                          Gerenciar gabaritos
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Disponível apenas para ofertas com status Aberta"
                          className="inline-flex cursor-not-allowed items-center justify-center whitespace-nowrap rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-surface-2 dark:text-slate-400"
                        >
                          Gerenciar gabaritos
                        </button>
                      )}
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
    </div>
  );
}
