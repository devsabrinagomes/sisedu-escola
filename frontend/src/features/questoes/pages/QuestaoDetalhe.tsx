import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Image as ImageIcon,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/AuthContext";

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
  created_by: number;
  created_at: string;
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
  const [item, setItem] = useState<QuestionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get<QuestionDTO>(`/questions/${id}/`);
        setItem(data);
      } catch (e: any) {
        setErr(
          e?.response?.data?.detail || "Não foi possível carregar a questão.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const loggedUserId = Number(auth?.userId ?? auth?.id);
  const createdById = Number(item?.created_by);
  const isMine =
    Number.isFinite(loggedUserId) &&
    Number.isFinite(createdById) &&
    loggedUserId === createdById;

  async function onDelete() {
    if (!item || !isMine) return;
    setActionErr("");
    try {
      setDeleting(true);
      await api.delete(`/questions/${item.id}/`);
      nav("/questoes");
    } catch (e: any) {
      setActionErr(
        e?.response?.data?.detail || "Não foi possível remover a questão.",
      );
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
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

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>;

  if (err)
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {err}
        </div>
        <div className="flex items-center gap-2">
          {isMine && (
            <Link
              to={`/questoes/${id}/editar`}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Link>
          )}
          <Link
            to="/questoes"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </div>
    );

  if (!item || !v)
    return <div className="text-sm text-slate-500">Não encontrado.</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link
              to="/questoes"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              aria-label="Voltar para questões"
              title="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Link to="/questoes" className="hover:text-slate-800">
              Questões
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">Detalhes</span>
          </div>

          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Detalhes da questão
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Visualização somente leitura.
            </p>
          </div>
        </div>
      </div>

      {actionErr && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionErr}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex flex-wrap items-start justify-between gap-4">
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
              {item.private ? "Privada" : "Pública"}
            </span>

            {correta && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Correta: {correta.letter}
              </span>
            )}
          </div>

          {isMine && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/questoes/${id}/editar`}
                title="Editar questão"
                aria-label="Editar questão"
                className="p-2 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
              >
                <Pencil className="h-[18px] w-[18px]" />
              </Link>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                title="Remover questão"
                aria-label="Remover questão"
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </div>
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
                      Texto + imagem + referência (se houver)
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
                      Referência da imagem
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

      {deleteOpen && isMine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar modal"
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Remover questão
              </h2>
              <button
                type="button"
                onClick={() => !deleting && setDeleteOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-slate-700">
              Tem certeza que deseja remover essa questão?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Essa ação não pode ser desfeita.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
