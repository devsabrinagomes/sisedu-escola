import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Eye, ArrowLeft, Image as ImageIcon } from "lucide-react";

type Subject = { id: number; name: string };

type OptionDTO = {
  id?: number;
  letter: "A" | "B" | "C" | "D" | "E";
  option_text: string;
  option_image?: string | null;
  correct: boolean;
};

type QuestionVersionDTO = {
  id: number;
  version_number: number;
  title: string; // enunciado
  command: string;
  support_text: string;
  support_image?: string | null;
  image_reference?: string;

  subject: number;
  descriptor: number | null;
  skill: number | null;

  options?: OptionDTO[];
};

type QuestionDTO = {
  id: number;
  private: boolean;
  deleted?: boolean;
  created_by: number;
  created_at?: string;

  versions?: QuestionVersionDTO[];
};

function hasMeaningfulHtml(html?: string) {
  const s = (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return s.length > 0;
}

function pickLatestVersion(versions?: QuestionVersionDTO[]) {
  if (!versions?.length) return null;
  return [...versions].sort(
    (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)
  )[0];
}

export default function QuestaoDetalhe() {
  const { id } = useParams();
  const [item, setItem] = useState<QuestionDTO | null>(null);
  const [subjectsMap, setSubjectsMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // carrega subjects (pra mostrar nome bonitinho)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<Subject[]>("/subjects/");
        const mp = new Map<number, string>();
        (data || []).forEach((s) => mp.set(s.id, s.name));
        setSubjectsMap(mp);
      } catch {
        // se falhar, ok: a tela segue com #id
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get<QuestionDTO>(`/questions/${id}/`);
        setItem(data);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Não foi possível carregar a questão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const latest = useMemo(() => pickLatestVersion(item?.versions), [item]);

  const optionsOrdenadas = useMemo(() => {
    const opts = Array.isArray(latest?.options) ? latest!.options! : [];
    const order = { A: 1, B: 2, C: 3, D: 4, E: 5 } as const;
    return [...opts].sort((a, b) => order[a.letter] - order[b.letter]);
  }, [latest]);

  const correta = useMemo(
    () => optionsOrdenadas.find((o) => o.correct),
    [optionsOrdenadas]
  );

  const showApoio = useMemo(() => {
    return (
      hasMeaningfulHtml(latest?.support_text) ||
      !!latest?.support_image ||
      !!(latest?.image_reference || "").trim()
    );
  }, [latest]);

  const subjectLabel = useMemo(() => {
    const sid = latest?.subject;
    if (!sid) return "Disciplina";
    return subjectsMap.get(sid) ?? `Subject #${sid}`;
  }, [latest?.subject, subjectsMap]);

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>;

  if (err)
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
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

  if (!item || !latest)
    return <div className="text-sm text-slate-500">Não encontrado.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-emerald-600" />
            <h1 className="text-xl font-semibold text-slate-900">
              Detalhes da questão
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Visualização somente leitura.</p>
        </div>

        <Link
          to="/questoes"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      {/* Card master */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            {subjectLabel}
          </span>

          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-medium",
              item.private ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
            ].join(" ")}
          >
            {item.private ? "Privada" : "Pública"}
          </span>

          {correta && (
            <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Correta: {correta.letter}
            </span>
          )}
        </div>

        {/* Enunciado (title) */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">Enunciado</div>
          <div
            className="prose prose-sm max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: latest.title || "" }}
          />
        </div>

        {/* Apoio */}
        {showApoio && (
          <details className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Apoio</div>
                  <div className="text-xs text-slate-500">
                    Texto de apoio + imagem + referência (se houver)
                  </div>
                </div>
                <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
              </div>
            </summary>

            <div className="mt-4 space-y-4">
              {hasMeaningfulHtml(latest.support_text) && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Texto de apoio
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-slate-800"
                    dangerouslySetInnerHTML={{ __html: latest.support_text || "" }}
                  />
                </div>
              )}

              {latest.support_image && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-slate-500" />
                    Imagem de apoio
                  </div>
                  <img
                    src={latest.support_image}
                    alt="Imagem de apoio"
                    className="max-h-[320px] w-auto rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              )}

              {!!(latest.image_reference || "").trim() && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    Referência da imagem
                  </div>
                  <div className="text-sm text-slate-700 break-words">
                    {latest.image_reference}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}

        {/* Comando */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">Comando</div>
          <div
            className="prose prose-sm max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: latest.command || "" }}
          />
        </div>

        {/* Alternativas */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-3">Alternativas</div>

          {optionsOrdenadas.length === 0 ? (
            <div className="text-sm text-slate-500">Nenhuma alternativa cadastrada.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {optionsOrdenadas.map((o) => {
                const isCorreta = !!o.correct;

                return (
                  <div
                    key={o.letter}
                    className={[
                      "rounded-xl border p-4 transition",
                      isCorreta
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {o.letter})
                      </div>

                      {isCorreta && (
                        <span className="text-xs font-semibold text-emerald-700">
                          ✔ Alternativa correta
                        </span>
                      )}
                    </div>

                    {hasMeaningfulHtml(o.option_text) && (
                      <div
                        className="prose prose-sm max-w-none text-slate-800"
                        dangerouslySetInnerHTML={{ __html: o.option_text || "" }}
                      />
                    )}

                    {o.option_image && (
                      <img
                        src={o.option_image}
                        alt={`Imagem alternativa ${o.letter}`}
                        className="mt-3 max-h-[260px] w-auto rounded-lg border border-slate-200 bg-white"
                      />
                    )}

                    {!hasMeaningfulHtml(o.option_text) && !o.option_image && (
                      <div className="text-sm text-slate-500">(Sem conteúdo)</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
