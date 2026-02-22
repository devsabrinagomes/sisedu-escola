import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  ArrowLeft,
  Image as ImageIcon,
  Plus,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import AddToCadernoModal from "@/features/questoes/components/AddToCadernoModal";
import QuestionActions from "@/features/questoes/components/QuestionActions";
import { useToast } from "@/components/ui/toast/useToast";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

type OptionDTO = {
  id: number;
  letter: "A" | "B" | "C" | "D" | "E";
  option_text: string;
  option_image?: string | null;
  correct: boolean;
};

type VersionDTO = {
  id: number;
  question: number;
  version_number: number;
  title: string;
  command: string;
  support_text: string;
  support_image?: string | null;
  image_reference?: string | null;
  subject: number;
  descriptor: number | null;
  skill: number | null;
  annulled: boolean;
  created_at: string;
  options?: OptionDTO[];
};

type QuestionDTO = {
  id: number;
  private: boolean;
  deleted: boolean;
  created_by:
    | number
    | string
    | {
        id?: number;
        name?: string | null;
        full_name?: string | null;
        username?: string | null;
      };
  created_by_name?: string | null;
  created_by_full_name?: string | null;
  created_by_username?: string | null;
  creator?: {
    id?: number;
    name?: string | null;
    full_name?: string | null;
    username?: string | null;
  } | null;
  created_at?: string | null;
  subject_name?: string | null;
  versions?: VersionDTO[];
};

function hasMeaningfulText(s?: string) {
  return (s || "").replace(/\s+/g, " ").trim().length > 0;
}

function pickLatestVersion(versions?: VersionDTO[]) {
  if (!versions?.length) return null;
  return [...versions].sort(
    (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0),
  )[0];
}

export default function QuestaoDetalhe() {
  const { id } = useParams();
  const nav = useNavigate();
  const auth = useAuth() as any;
  const { toast } = useToast();
  const [item, setItem] = useState<QuestionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cadernoModalOpen, setCadernoModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get<QuestionDTO>(`/questions/${id}/`);
        setItem(data);
      } catch (e: any) {
        setErr(
          e?.response?.data?.detail ||
            "N\u00e3o foi poss\u00edvel carregar a quest\u00e3o.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const userId = Number(
    auth?.userId ??
      auth?.id ??
      auth?.user?.id ??
      auth?.user?.pk ??
      auth?.user?.user_id ??
      auth?.data?.id,
  );
  const createdById = Number(
    (item as any)?.created_by?.id ??
      (item as any)?.created_by?.pk ??
      (item as any)?.created_by_id ??
      item?.created_by,
  );
  const isMine =
    Number.isFinite(userId) &&
    Number.isFinite(createdById) &&
    userId === createdById;
  const canAddToCaderno = !isMine && !item?.private;

  const creatorLabel = useMemo(() => {
    if (!item) return "-";

    const byRoot =
      item.created_by_full_name ||
      item.created_by_name ||
      item.created_by_username;
    if (byRoot) return byRoot;

    const byCreator =
      item.creator?.full_name ||
      item.creator?.name ||
      item.creator?.username;
    if (byCreator) return byCreator;

    if (typeof item.created_by === "object" && item.created_by) {
      return (
        item.created_by.full_name ||
        item.created_by.name ||
        item.created_by.username ||
        "-"
      );
    }

    if (typeof item.created_by === "string" && item.created_by.trim()) {
      return item.created_by;
    }

    if (typeof item.created_by === "number") {
      return String(item.created_by);
    }

    return "-";
  }, [item]);

  const createdAtLabel = useMemo(() => {
    if (!item?.created_at) return "";
    const dt = new Date(item.created_at);
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    })
      .format(dt)
      .replace(",", " às");
  }, [item?.created_at]);

  const metadataLabel = createdAtLabel
    ? `Criada por: ${creatorLabel} • ${createdAtLabel}`
    : `Criada por: ${creatorLabel}`;

  async function onDelete() {
    if (!item || !isMine) return;
    try {
      setDeleting(true);
      await api.delete(`/questions/${item.id}/`);
      toast({
        type: "success",
        title: "Questão removida com sucesso",
      });
      nav("/questoes");
    } catch (e: any) {
      toast({
        type: "error",
        title: "Erro ao remover questão",
        message: getApiErrorMessage(e),
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function onToggleAnnulled() {
    if (!item || !isMine) return;
    const latest = pickLatestVersion(item.versions);
    const nextAnnulled = !Boolean(latest?.annulled);

    try {
      await api.patch(`/questions/${item.id}/`, { annulled: nextAnnulled });
      setItem((prev) => {
        if (!prev) return prev;
        const latestVersion = pickLatestVersion(prev.versions);
        if (!latestVersion || !prev.versions?.length) return prev;
        return {
          ...prev,
          versions: prev.versions.map((version) =>
            version.id === latestVersion.id
              ? { ...version, annulled: nextAnnulled }
              : version,
          ),
        };
      });
      toast({
        type: "success",
        title: nextAnnulled ? "Questão anulada" : "Questão reativada",
      });
    } catch (e: any) {
      toast({
        type: "error",
        title: "Erro ao alterar status da questão",
        message: getApiErrorMessage(e),
      });
    }
  }

  const v = useMemo(() => pickLatestVersion(item?.versions), [item]);

  const optionsSorted = useMemo(() => {
    const ops = Array.isArray(v?.options) ? v!.options! : [];
    return [...ops].sort((a, b) => a.letter.localeCompare(b.letter));
  }, [v]);

  const correta = useMemo(
    () => optionsSorted.find((o) => o.correct),
    [optionsSorted],
  );

  const showApoio = useMemo(() => {
    return (
      hasMeaningfulText(v?.support_text) ||
      !!v?.support_image ||
      hasMeaningfulText(v?.image_reference || "")
    );
  }, [v]);

  if (loading) return <div className="text-sm text-slate-500">Carregando...</div>;

  if (err)
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>

        <Link
          to="/questoes"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    );

  if (!item || !v)
    return <div className="text-sm text-slate-500">{"N\u00e3o encontrado."}</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div className="space-y-3">
          <Breadcrumb
            items={[
              { label: "Quest\u00f5es", to: "/questoes" },
              { label: "Detalhes" },
            ]}
          />

          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {"Detalhes da quest\u00e3o"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {"Visualiza\u00e7\u00e3o somente leitura."}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {item.subject_name || "—"}
              </span>

              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium",
                  item.private
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700",
                ].join(" ")}
              >
                {item.private ? "Privada" : "P\u00fablica"}
              </span>

              {correta && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Correta: {correta.letter}
                </span>
              )}
              {v.annulled && (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                  Anulada
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {metadataLabel}
            </div>
          </div>
          {isMine && (
            <QuestionActions
              isMine={isMine}
              annulled={Boolean(v.annulled)}
              onEdit={() => nav(`/questoes/${id}/editar`)}
              onToggleAnnulled={onToggleAnnulled}
              onAddToCaderno={() => setCadernoModalOpen(true)}
              canAddToCaderno={!v.annulled}
              onRemove={() => setDeleteOpen(true)}
              variant="icons"
            />
          )}
          {canAddToCaderno && (
            <button
              type="button"
              onClick={() => setCadernoModalOpen(true)}
              title="Adicionar ao caderno"
              aria-label="Adicionar ao caderno"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition shrink-0"
            >
              <Plus size={18} />
              <span>Adicionar ao caderno</span>
            </button>
          )}
        </div>

        <div className="border-t border-slate-100" />

        <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6">
          {/* Enunciado (title) */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Enunciado
            </div>
            <div className="text-slate-900">{v.title || "(Sem enunciado)"}</div>
          </div>

          {/* Apoio (opcional) */}
          {showApoio && (
            <details className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Apoio
                    </div>
                    <div className="text-xs text-slate-500">
                      {"Texto + imagem + refer\u00eancia (se houver)"}
                    </div>
                  </div>
                  <span className="text-slate-400 group-open:rotate-180 transition">
                    ▾
                  </span>
                </div>
              </summary>

              <div className="mt-4 space-y-4">
                {hasMeaningfulText(v.support_text) && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Texto de apoio
                    </div>
                    <div className="text-slate-800 whitespace-pre-wrap">
                      {v.support_text}
                    </div>
                  </div>
                )}

                {v.support_image && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-slate-500" />
                      Imagem de apoio
                    </div>
                    <img
                      src={v.support_image}
                      alt="Imagem de apoio"
                      className="max-h-[320px] w-auto rounded-xl border border-slate-200 bg-white"
                    />
                  </div>
                )}

                {hasMeaningfulText(v.image_reference || "") && (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1">
                      {"Refer\u00eancia da imagem"}
                    </div>
                    <div className="text-sm text-slate-700 break-words">
                      {v.image_reference}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Comando */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Comando
            </div>
            <div className="text-slate-800 whitespace-pre-wrap">
              {v.command || "—"}
            </div>
          </div>

          {/* Alternativas */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-3">
              Alternativas
            </div>

            {optionsSorted.length === 0 ? (
              <div className="text-sm text-slate-500">
                Nenhuma alternativa cadastrada.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {optionsSorted.map((o) => (
                  <div
                    key={o.id}
                    className={[
                      "rounded-xl border p-4 transition",
                      o.correct
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {o.letter})
                      </div>
                      {o.correct && (
                        <span className="text-xs font-semibold text-emerald-700">
                          ✔ Alternativa correta
                        </span>
                      )}
                    </div>

                    {hasMeaningfulText(o.option_text) ? (
                      <div className="text-slate-800 whitespace-pre-wrap">
                        {o.option_text}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">(Sem texto)</div>
                    )}

                    {o.option_image && (
                      <img
                        src={o.option_image}
                        alt={`Imagem alternativa ${o.letter}`}
                        className="mt-3 max-h-[260px] w-auto rounded-lg border border-slate-200 bg-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen && isMine}
        title="Remover questão"
        description="Tem certeza que deseja remover essa questão? Essa ação não pode ser desfeita."
        confirmText={deleting ? "Removendo..." : "Remover"}
        loading={deleting}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={onDelete}
      />

      <AddToCadernoModal
        open={cadernoModalOpen}
        questionId={item?.id ?? null}
        onClose={() => setCadernoModalOpen(false)}
        onSuccess={() =>
          toast({
            type: "success",
            title: "Adicionada ao caderno",
          })
        }
        onError={(e) =>
          toast({
            type: "error",
            title: "Erro ao adicionar ao caderno",
            message: getApiErrorMessage(e),
          })
        }
      />
    </div>
  );
}
