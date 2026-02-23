import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DatePickerInput from "@/components/ui/DatePickerInput";
import TablePagination from "@/components/ui/TablePagination";
import { useToast } from "@/components/ui/toast/useToast";
import { deleteOffer, listOffers } from "@/features/ofertas/services/offers";
import type { OfferDTO, OfferFilters, OfferStatus } from "@/features/ofertas/types";
import {
  formatDate,
  formatDateTime,
  getBookletName,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
} from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

type SortKey = "id" | "booklet" | "period" | "created_at";
type SortDir = "asc" | "desc";

export default function OfertasList() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<OfferDTO[]>([]);
  const [count, setCount] = useState(0);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [filters, setFilters] = useState<OfferFilters>({
    search: "",
    status: "all",
    start_date: "",
    end_date: "",
    page: 1,
  });

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "created_at",
    dir: "desc",
  });

  useEffect(() => {
    void loadOffers();
  }, [filters]);

  async function loadOffers() {
    try {
      setLoading(true);
      setErr("");
      const data = await listOffers(filters);
      setItems(data.results.filter((offer) => !offer.deleted));
      setCount(data.count);
      setNextPage(data.next);
      setPreviousPage(data.previous);
    } catch {
      setItems([]);
      setCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setErr("Não foi possível carregar as ofertas.");
    } finally {
      setLoading(false);
    }
  }

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
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={filters.search || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))
                }
                placeholder="Buscar ofertas..."
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

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">Início a partir de</label>
            <DatePickerInput
              value={filters.start_date || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, start_date: e, page: 1 }))
              }
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-medium text-slate-500">Fim até</label>
            <DatePickerInput
              value={filters.end_date || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, end_date: e, page: 1 }))
              }
            />
          </div>

        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {loading ? "Carregando..." : `${count} oferta(s)`}
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
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpar
              </button>
            )}
            <Link
              to="/ofertas/nova"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              + Nova oferta
            </Link>
          </div>
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
            <div className="mt-3">
              <Link
                to="/ofertas/nova"
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Criar oferta
              </Link>
            </div>
          </div>
        ) : (
          <table className="w-full table-auto border-collapse">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-16 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("id")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Código
                    {getSortIcon("id")}
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("booklet")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Oferta
                    {getSortIcon("booklet")}
                  </button>
                </th>
                <th className="w-52 px-5 py-3 text-left text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSort("period")}
                    className="inline-flex items-center gap-1 hover:text-slate-900"
                  >
                    Período
                    {getSortIcon("period")}
                  </button>
                </th>
                <th className="w-28 px-5 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="w-36 px-5 py-3 text-left text-xs font-semibold text-slate-600">
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
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-sm text-slate-700">{offer.id}</td>
                    <td className="px-5 py-3 text-sm text-slate-800">
                      <Link
                        to={`/ofertas/${offer.id}`}
                        className="font-medium text-slate-900 hover:text-emerald-700 hover:underline"
                      >
                        {offer.description?.trim() || "-"}
                      </Link>
                      <div className="mt-1 line-clamp-1 text-xs text-slate-500">
                        {getBookletName(offer)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      {formatDate(offer.start_date)} - {formatDate(offer.end_date)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(status)}`}
                      >
                        {getOfferStatusLabel(status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/ofertas/${offer.id}`)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Ver
                        </button>
                        {isMine && (
                          <>
                            <button
                              type="button"
                              onClick={() => navigate(`/ofertas/${offer.id}/editar`)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(offer.id)}
                              className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Excluir
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
