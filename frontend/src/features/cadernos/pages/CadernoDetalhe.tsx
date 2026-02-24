import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast/useToast";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import { api } from "@/lib/api";
import type {
  BookletDTO,
  BookletItemDTO,
  BookletItemDraft,
  QuestionDTO,
} from "@/features/cadernos/types";
import {
  formatDateTime,
  pickLatestVersion,
  stripHtml,
  toBookletDraftFromItem,
} from "@/features/cadernos/utils";
import {
  deleteBooklet,
  getBooklet,
  listBookletItems,
} from "@/features/cadernos/services/booklets";
import {
  downloadBookletApplicationKit,
} from "@/features/ofertas/services/offers";
import { isBookletKitPending, setBookletKitPending } from "@/features/ofertas/utils";

export default function CadernoDetalhe() {
  const { id } = useParams();
  const bookletId = Number(id);
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();
  const [item, setItem] = useState<BookletDTO | null>(null);
  const [resolvedDrafts, setResolvedDrafts] = useState<BookletItemDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingKit, setDownloadingKit] = useState(false);
  const [kitModalOpen, setKitModalOpen] = useState(false);

  useEffect(() => {
    if (!bookletId) return;
    void load();
  }, [bookletId]);

  useEffect(() => {
    if (!bookletId) return;
    const shouldOpenFromNavigation = Boolean(
      (location.state as { showKitModal?: boolean } | null)?.showKitModal,
    );
    setKitModalOpen(shouldOpenFromNavigation);
  }, [bookletId, location.state]);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const booklet = await getBooklet(bookletId);
      let items = booklet.items ?? [];
      if (!items.length) {
        try {
          items = await listBookletItems(bookletId);
        } catch {
          items = [];
        }
      }
      setItem({
        ...booklet,
        items: [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      });
    } catch {
      setErr("Não foi possível carregar o caderno.");
    } finally {
      setLoading(false);
    }
  }

  const isMine = Number(item?.created_by) === Number(userId);
  const kitPending = isBookletKitPending(bookletId);
  const sortedDrafts = useMemo(() => {
    if (!item?.items) return [];
    return item.items.map((bookletItem: BookletItemDTO) => toBookletDraftFromItem(bookletItem));
  }, [item?.items]);

  useEffect(() => {
    if (!sortedDrafts.length) {
      setResolvedDrafts([]);
      return;
    }
    void enrichDraftsWithQuestionData(sortedDrafts);
  }, [sortedDrafts]);

  async function enrichDraftsWithQuestionData(drafts: BookletItemDraft[]) {
    const needsEnrich = drafts.filter(
      (draft) =>
        (!draft.subject_name || draft.subject_name === "-") &&
        typeof draft.question_id === "number",
    );

    const needsTitle = drafts.filter(
      (draft) =>
        (!draft.title || /^Questão #\d+$/.test(draft.title)) &&
        typeof draft.question_id === "number",
    );

    const ids = Array.from(
      new Set(
        [...needsEnrich, ...needsTitle]
          .map((draft) => draft.question_id)
          .filter((value): value is number => typeof value === "number"),
      ),
    );

    if (!ids.length) {
      setResolvedDrafts(drafts);
      return;
    }

    const detailsByQuestionId = new Map<number, QuestionDTO>();
    await Promise.all(
      ids.map(async (questionId) => {
        try {
          const { data } = await api.get<QuestionDTO>(`/questions/${questionId}/`);
          detailsByQuestionId.set(questionId, data);
        } catch {
          // mantém fallback existente sem bloquear render
        }
      }),
    );

    const merged = drafts.map((draft) => {
      if (typeof draft.question_id !== "number") return draft;
      const detail = detailsByQuestionId.get(draft.question_id);
      if (!detail) return draft;
      const latest = pickLatestVersion(detail.versions);
      return {
        ...draft,
        title:
          stripHtml(latest?.title || "") ||
          draft.title ||
          `Questão #${draft.question_id}`,
        subject_name:
          detail.subject_name ||
          (latest?.subject ? `Disciplina #${latest.subject}` : null) ||
          draft.subject_name,
      };
    });

    setResolvedDrafts(merged);
  }

  async function onDelete() {
    if (!isMine || !item) return;
    try {
      setDeleting(true);
      await deleteBooklet(item.id);
      toast({
        type: "success",
        title: "Caderno removido com sucesso",
      });
      navigate("/cadernos");
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao remover caderno",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function onDownloadKit() {
    try {
      setDownloadingKit(true);
      await downloadBookletApplicationKit(bookletId);
      setBookletKitPending(bookletId, false);
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
    setKitModalOpen(false);
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Carregando...</div>;
  }

  if (err) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
        <Link
          to="/cadernos"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    );
  }

  if (!item) {
    return <div className="text-sm text-slate-500">Não encontrado.</div>;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 border-b border-slate-100 pb-4">
        <div className="space-y-3">
          <Breadcrumb
            items={[
              { label: "Cadernos", to: "/cadernos" },
              { label: "Detalhes" },
            ]}
          />
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Detalhes do caderno
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Visualização somente leitura.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                {kitPending ? (
                  <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 self-center" />
                    <span className="leading-none">Download do kit de aplicação pendente</span>
                  </div>
                ) : null}
                <div className="text-xs font-semibold text-slate-700">Nome</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{item.name}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Criado em: {formatDateTime(item.created_at)}
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
                    onClick={() => navigate(`/cadernos/${bookletId}/editar`)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    title="Editar caderno"
                    aria-label="Editar caderno"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 transition"
                    title="Remover caderno"
                    aria-label="Remover caderno"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Itens do caderno</h2>
          </div>
          {resolvedDrafts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Nenhuma questão adicionada.
            </div>
          ) : (
            <table className="w-full table-auto border-collapse">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="w-14 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Ordem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Questão
                  </th>
                  <th className="w-64 px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    Disciplina
                  </th>
                </tr>
              </thead>
              <tbody>
                {resolvedDrafts.map((bookletItem, index) => (
                  <tr
                    key={bookletItem.local_id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-sm text-slate-700">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {bookletItem.title || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                        {bookletItem.subject_name || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen && isMine}
        title="Remover caderno"
        description="Tem certeza que deseja remover esse caderno? Essa ação não pode ser desfeita."
        confirmText={deleting ? "Removendo..." : "Remover"}
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
                  Caderno criado com sucesso!
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
                title="Baixar kit aplicação"
              >
                <Download className="h-4 w-4" />
                {downloadingKit ? "Baixando..." : "Baixar kit aplicação"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
