import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Eye, ArrowLeft, Image as ImageIcon } from "lucide-react";

type RespostaDTO = {
  id?: number;
  ordem: number; 
  opcao?: string; 
  texto_html: string;
  imagem?: string | null;
  correta: boolean;
};

type QuestaoDetalheDTO = {
  id: number;
  disciplina: number;
  disciplina_nome?: string;
  saber: number | null;
  habilidade: number | null;

  enunciado_html: string;
  comando_html: string;

  texto_suporte_html: string;
  imagem_suporte?: string | null;
  ref_imagem: string;

  is_private: boolean;
  criado_por?: string;
  created_at?: string;

  respostas?: RespostaDTO[];
};

function ordemToLetra(ordem: number) {
  return String.fromCharCode("A".charCodeAt(0) + (ordem - 1));
}

function hasMeaningfulHtml(html?: string) {
  const s = (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return s.length > 0;
}

export default function QuestaoDetalhe() {
  const { id } = useParams();
  const [item, setItem] = useState<QuestaoDetalheDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const { data } = await api.get<QuestaoDetalheDTO>(`/questoes/${id}/`);
        setItem(data);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Não foi possível carregar a questão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const respostasOrdenadas = useMemo(() => {
    const rs = Array.isArray(item?.respostas) ? item!.respostas! : [];
    return [...rs].sort((a, b) => a.ordem - b.ordem);
  }, [item]);

  const correta = useMemo(() => {
    return respostasOrdenadas.find((r) => r.correta);
  }, [respostasOrdenadas]);

  const showApoio = useMemo(() => {
    return (
      hasMeaningfulHtml(item?.texto_suporte_html) ||
      !!item?.imagem_suporte ||
      !!(item?.ref_imagem || "").trim()
    );
  }, [item]);

  if (loading)
    return <div className="text-sm text-slate-500">Carregando…</div>;

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

  if (!item)
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
          <p className="mt-1 text-sm text-slate-500">
            Visualização somente leitura.
          </p>
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
            {item.disciplina_nome ?? `Disciplina #${item.disciplina}`}
          </span>

          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-medium",
              item.is_private
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700",
            ].join(" ")}
          >
            {item.is_private ? "Privada" : "Pública"}
          </span>

          <span className="text-xs text-slate-500">
            Criado por{" "}
            <span className="font-medium text-slate-700">
              {item.criado_por ?? "-"}
            </span>
          </span>

          {correta && (
            <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Correta: {correta.opcao ?? ordemToLetra(correta.ordem)}
            </span>
          )}
        </div>

        {/* Enunciado */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2">
            Enunciado
          </div>
          <div
            className="prose prose-sm max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: item.enunciado_html || "" }}
          />
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
                    Texto de apoio + imagem + referência (se houver)
                  </div>
                </div>
                <span className="text-slate-400 group-open:rotate-180 transition">
                  ▾
                </span>
              </div>
            </summary>

            <div className="mt-4 space-y-4">
              {hasMeaningfulHtml(item.texto_suporte_html) && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Texto de apoio
                  </div>
                  <div
                    className="prose prose-sm max-w-none text-slate-800"
                    dangerouslySetInnerHTML={{
                      __html: item.texto_suporte_html || "",
                    }}
                  />
                </div>
              )}

              {item.imagem_suporte && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-slate-500" />
                    Imagem de apoio
                  </div>
                  <img
                    src={item.imagem_suporte}
                    alt="Imagem de apoio"
                    className="max-h-[320px] w-auto rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              )}

              {!!(item.ref_imagem || "").trim() && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">
                    Referência da imagem
                  </div>
                  <div className="text-sm text-slate-700 break-words">
                    {item.ref_imagem}
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
          <div
            className="prose prose-sm max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: item.comando_html || "" }}
          />
        </div>

        {/* Alternativas */}
        <div>
          <div className="text-xs font-semibold text-slate-700 mb-3">
            Alternativas
          </div>

          {respostasOrdenadas.length === 0 ? (
            <div className="text-sm text-slate-500">
              Nenhuma alternativa cadastrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {respostasOrdenadas.map((r) => {
                const letra = r.opcao ?? ordemToLetra(r.ordem);
                const isCorreta = !!r.correta;

                return (
                  <div
                    key={`${r.ordem}-${letra}`}
                    className={[
                      "rounded-xl border p-4 transition",
                      isCorreta
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {letra})
                      </div>

                      {isCorreta && (
                        <span className="text-xs font-semibold text-emerald-700">
                          ✔ Alternativa correta
                        </span>
                      )}
                    </div>

                    {hasMeaningfulHtml(r.texto_html) && (
                      <div
                        className="prose prose-sm max-w-none text-slate-800"
                        dangerouslySetInnerHTML={{ __html: r.texto_html || "" }}
                      />
                    )}

                    {r.imagem && (
                      <img
                        src={r.imagem}
                        alt={`Imagem alternativa ${letra}`}
                        className="mt-3 max-h-[260px] w-auto rounded-lg border border-slate-200 bg-white"
                      />
                    )}

                    {!hasMeaningfulHtml(r.texto_html) && !r.imagem && (
                      <div className="text-sm text-slate-500">
                        (Sem conteúdo)
                      </div>
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
