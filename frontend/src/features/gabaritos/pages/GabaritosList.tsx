import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import TablePagination from "@/components/ui/TablePagination";
import { listGabaritoOffers } from "@/features/gabaritos/services/gabaritos";
import type { OfferDTO, OfferFilters, OfferStatus } from "@/features/gabaritos/types";
import {
  formatDate,
  getBookletName,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
} from "@/features/ofertas/utils";

type SortKey = "offer" | "booklet" | "period" | "status";
type SortDir = "asc" | "desc";

export default function GabaritosList() {
  const [items, setItems] = useState<OfferDTO[]>([]);
  const [count, setCount] = useState(0);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [filters, setFilters] = useState<OfferFilters>({
    search: "",
    status: "all",
    page: 1,
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "offer",
    dir: "asc",
  });

  useEffect(() => {
    void loadOffers();
  }, [filters]);

  async function loadOffers() {
    try {
      setLoading(true);
      setErr("");
      const data = await listGabaritoOffers(filters);
      setItems(data.results.filter((offer) => !offer.deleted));
      setCount(data.count);
      setNextPage(data.next);
      setPreviousPage(data.previous);
    } catch {
      setItems([]);
      setCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setErr("Não foi possível carregar as ofertas para gabaritos.");
    } finally {
      setLoading(false);
    }
  }

  function setStatusFilter(value: string) {
    const nextStatus: OfferStatus | "all" =
      value === "upcoming" || value === "open" || value === "closed" ? value : "all";

    setFilters((prev) => ({
      ...prev,
      status: nextStatus,
      page: 1,
    }));
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
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <label className="mb-1 block text-xs font-medium text-slate-500">Buscar ofertas</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={filters.search || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
                }
                placeholder="Descrição da oferta ou caderno"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select
              value={filters.status || "all"}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200"
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {loading ? "Carregando..." : `${count} oferta(s)`}
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
            Nenhuma oferta encontrada.
          </div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("offer")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Oferta
                    {getSortIcon("offer")}
                  </button>
                </th>
                <th className="w-40 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("period")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Período
                    {getSortIcon("period")}
                  </button>
                </th>
                <th className="w-32 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Status
                    {getSortIcon("status")}
                  </button>
                </th>
                <th className="w-48 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((offer) => {
                const status = getOfferStatus(offer);
                return (
                  <tr
                    key={offer.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-sm text-slate-800">
                      <div className="font-medium text-slate-900">
                        {offer.description?.trim() || `Oferta #${offer.id}`}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{getBookletName(offer)}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <div>{formatDate(offer.start_date)} -</div>
                      <div>{formatDate(offer.end_date)}</div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(status)}`}
                      >
                        {getOfferStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <Link
                        to={`/gabaritos/ofertas/${offer.id}`}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Gerenciar gabaritos
                      </Link>
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
