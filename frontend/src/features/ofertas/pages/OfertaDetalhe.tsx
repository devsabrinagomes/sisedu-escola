import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Download, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import PageCard from "@/components/layout/PageCard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast/useToast";
import {
  deleteOffer,
  downloadOfferApplicationKit,
  getOffer,
} from "@/features/ofertas/services/offers";
import type { OfferDTO } from "@/features/ofertas/types";
import {
  formatDate,
  formatDateTime,
  getOfferSigeSelection,
  getBookletId,
  getBookletName,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
  isOfferKitPending,
  setOfferKitPending,
} from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function OfertaDetalhe() {
  const { id } = useParams();
  const offerId = Number(id);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [item, setItem] = useState<OfferDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kitModalOpen, setKitModalOpen] = useState(false);
  const [kitPending, setKitPending] = useState(false);
  const [downloadingKit, setDownloadingKit] = useState(false);
  const [sigeSelection, setSigeSelection] = useState<ReturnType<typeof getOfferSigeSelection>>(null);

  useEffect(() => {
    if (!offerId) return;
    void load();
  }, [offerId]);

  useEffect(() => {
    if (!offerId) return;
    const pending = isOfferKitPending(offerId);
    const sige = getOfferSigeSelection(offerId);
    const shouldOpenFromNavigation = Boolean(
      (location.state as { showKitModal?: boolean } | null)?.showKitModal,
    );
    setKitPending(pending);
    setSigeSelection(sige);
    setKitModalOpen(shouldOpenFromNavigation);
  }, [offerId, location.state]);

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

  async function onDownloadKit() {
    if (!item) return;
    try {
      setDownloadingKit(true);
      await downloadOfferApplicationKit(item.id);
      setOfferKitPending(item.id, false);
      setKitPending(false);
      setKitModalOpen(false);
      toast({ type: "success", title: "Kit de aplicação baixado com sucesso" });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao baixar kit de aplicação",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDownloadingKit(false);
    }
  }

  function onCloseKitModal() {
    if (item && kitPending) {
      setOfferKitPending(item.id, true);
    }
    setKitModalOpen(false);
  }

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
    return <div className="text-sm text-slate-500">Carregando...</div>;
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  {kitPending ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700"
                      title="Download do kit de aplicação pendente"
                    >
                      <TriangleAlert className="h-3.5 w-3.5" />
                      Download do kit de aplicação pendente
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {item.description?.trim() || `Oferta #${item.id}`}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Criada em: {formatDateTime(item.created_at)}
                </div>
              </div>

              {isMine && (
                <div className="flex items-center gap-1 text-slate-500">
                  <button
                    type="button"
                    onClick={() => void onDownloadKit()}
                    disabled={downloadingKit}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition disabled:opacity-50"
                    title="Baixar kit aplicação"
                    aria-label="Baixar kit aplicação"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/ofertas/${item.id}/editar`)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition"
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
              <div className="text-xs font-semibold text-slate-600">Caderno</div>
              <Link
                to={`/cadernos/${getBookletId(item)}`}
                className="mt-1 inline-block text-sm text-slate-900 hover:text-emerald-700 hover:underline"
              >
                {getBookletName(item)}
              </Link>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Status</div>
              <span
                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(status)}`}
              >
                {getOfferStatusLabel(status)}
              </span>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Período</div>
              <div className="mt-1 text-sm text-slate-800">
                {formatDate(item.start_date)} - {formatDate(item.end_date)}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Escola</div>
              <div className="mt-1 text-sm text-slate-800">
                {sigeSelection?.school_names?.length
                  ? sigeSelection.school_names.join(", ")
                  : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Série</div>
              <div className="mt-1 text-sm text-slate-800">
                {sigeSelection?.series_years?.length
                  ? sigeSelection.series_years.map((year) => `${year}ª série`).join(", ")
                  : "-"}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Turma</div>
              <div className="mt-1 text-sm text-slate-800">
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

      {kitModalOpen && item ? (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/30" onClick={onCloseKitModal} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <div className="inline-flex items-center gap-2 text-base font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                  Oferta criada com sucesso!
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Baixe o kit de aplicação: caderno de prova e cartão-resposta.
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseKitModal}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={onCloseKitModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={downloadingKit}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void onDownloadKit()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={downloadingKit}
              >
                <Download className="h-4 w-4" />
                {downloadingKit ? "Baixando..." : "Baixar kit aplicação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageCard>
  );
}
