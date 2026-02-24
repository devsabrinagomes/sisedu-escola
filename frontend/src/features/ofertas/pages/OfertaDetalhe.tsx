import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import PageCard from "@/components/layout/PageCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast/useToast";
import {
  deleteOffer,
  getOffer,
} from "@/features/ofertas/services/offers";
import type { OfferDTO } from "@/features/ofertas/types";
import {
  formatDate,
  formatDateTime,
  getBookletId,
  getBookletName,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
  getOfferSigeSelection,
} from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function OfertaDetalhe() {
  const { id } = useParams();
  const offerId = Number(id);
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [item, setItem] = useState<OfferDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sigeSelection, setSigeSelection] = useState<ReturnType<typeof getOfferSigeSelection>>(null);

  useEffect(() => {
    if (!offerId) return;
    void load();
  }, [offerId]);

  useEffect(() => {
    if (!offerId) return;
    const sige = getOfferSigeSelection(offerId);
    setSigeSelection(sige);
  }, [offerId]);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const data = await getOffer(offerId);
      setItem(data);
    } catch {
      setErr("Não foi possível carregar a oferta.");
    } finally {
      setLoading(false);
    }
  }

  const isMine = Number(item?.created_by) === Number(userId);
  const status = useMemo(() => (item ? getOfferStatus(item) : "upcoming"), [item]);

  async function onDelete() {
    if (!item || !isMine) return;
    try {
      setDeleting(true);
      await deleteOffer(item.id);
      toast({ type: "success", title: "Oferta removida com sucesso" });
      navigate("/ofertas");
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao remover oferta",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Carregando...</div>;
  }

  return (
    <PageCard
      breadcrumb={[
        { label: "Ofertas", to: "/ofertas" },
        { label: "Detalhes" },
      ]}
      title="Detalhes da oferta"
      subtitle="Visualização somente leitura."
      onBack={() => navigate("/ofertas")}
    >
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {!err && item && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-borderDark dark:bg-surface-1">
          <div className="border-b border-slate-100 dark:border-borderDark px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {item.description?.trim() || `Oferta #${item.id}`}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Criada em: {formatDateTime(item.created_at)}
                </div>
              </div>

              {isMine && (
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => navigate(`/ofertas/${item.id}/editar`)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-emerald-50 hover:text-brand-500 transition"
                    title="Editar oferta"
                    aria-label="Editar oferta"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 transition"
                    title="Remover oferta"
                    aria-label="Remover oferta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Caderno</div>
              <Link
                to={`/cadernos/${getBookletId(item)}`}
                className="mt-1 inline-block text-sm text-slate-900 dark:text-slate-100 hover:text-brand-500 hover:underline"
              >
                {getBookletName(item)}
              </Link>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Status</div>
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(status)}`}
              >
                {getOfferStatusLabel(status)}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Período</div>
              <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                {formatDate(item.start_date)} - {formatDate(item.end_date)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Escola</div>
              <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                {sigeSelection?.school_names?.length
                  ? sigeSelection.school_names.join(", ")
                  : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Série</div>
              <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                {sigeSelection?.series_years?.length
                  ? sigeSelection.series_years.map((year) => `${year}ª série`).join(", ")
                  : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Turma</div>
              <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                {sigeSelection?.class_names?.length
                  ? sigeSelection.class_names.join(", ")
                  : "-"}
              </div>
            </div>

          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen && isMine}
        title="Excluir oferta"
        description="Tem certeza que deseja excluir esta oferta?"
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={onDelete}
      />
    </PageCard>
  );
}
