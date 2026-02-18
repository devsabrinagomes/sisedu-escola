import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Alternativa, Disciplina } from "@/types/core";
import RichEditor, {
  useRichEditor,
  hasMeaningfulHtml,
  normalizeHtml,
} from "@/components/RichEditor";

import Accordion from "@/components/Accordion";
import {
  ALT_KEYS,
  ALTS,
  type AltKey,
  buildRespostasPayload,
  computeFilledCreate,
  computeFilledEdit,
  validateAlternatives,
} from "../utils/questaoForm.utils";

type Saber = { id: number; codigo: string; titulo: string; disciplina: number };
type Habilidade = { id: number; codigo: string; titulo: string; saber: number };

type RespostaDTO = {
  ordem: number;
  texto_html: string;
  imagem?: string | null;
  correta: boolean;
};

export type QuestaoDTO = {
  id: number;
  disciplina: number;
  saber: number | null;
  habilidade: number | null;
  enunciado_html: string;
  comando_html: string;
  texto_suporte_html: string;
  imagem_suporte?: string | null;
  ref_imagem: string;
  is_private: boolean;
  respostas?: RespostaDTO[];
};

type Mode = "create" | "edit";

function ReqStar() {
  return <span className="text-red-600">*</span>;
}

function ordemToAlt(ordem: number): AltKey {
  return ordem === 1
    ? "A"
    : ordem === 2
      ? "B"
      : ordem === 3
        ? "C"
        : ordem === 4
          ? "D"
          : "E";
}

export default function QuestaoForm({
  mode,
  initialData,
  onSubmitFormData,
  onCancel,
}: {
  mode: Mode;
  initialData?: QuestaoDTO;
  onSubmitFormData: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [triedSubmit, setTriedSubmit] = useState(false);

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [saberes, setSaberes] = useState<Saber[]>([]);
  const [habilidades, setHabilidades] = useState<Habilidade[]>([]);

  const [loadingDisc, setLoadingDisc] = useState(true);
  const [loadingSab, setLoadingSab] = useState(false);
  const [loadingHab, setLoadingHab] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // campos
  const [disciplina, setDisciplina] = useState<number>(0);
  const [saberId, setSaberId] = useState<number | "">("");
  const [habilidadeId, setHabilidadeId] = useState<number | "">("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [altCorreta, setAltCorreta] = useState<Alternativa | "">("");
  const [altAtiva, setAltAtiva] = useState<AltKey>("A");

  // apoio
  const [currentSuporteUrl, setCurrentSuporteUrl] = useState("");
  const [suporteFile, setSuporteFile] = useState<File | null>(null);
  const [suportePreview, setSuportePreview] = useState("");
  const [removeSuporte, setRemoveSuporte] = useState(false);
  const [refImagem, setRefImagem] = useState("");

  // alternativas imagens
  const [altImg, setAltImg] = useState<Record<AltKey, File | null>>({
    A: null, B: null, C: null, D: null, E: null,
  });
  const [altPreview, setAltPreview] = useState<Record<AltKey, string>>({
    A: "", B: "", C: "", D: "", E: "",
  });

  const [currentAltImgUrl, setCurrentAltImgUrl] = useState<Record<AltKey, string>>({
    A: "", B: "", C: "", D: "", E: "",
  });
  const [removeAltImg, setRemoveAltImg] = useState<Record<AltKey, boolean>>({
    A: false, B: false, C: false, D: false, E: false,
  });

  // editores
  const enunciadoEd = useRichEditor("<p></p>");
  const comandoEd = useRichEditor("<p></p>");
  const textoApoioEd = useRichEditor("<p></p>");

  const altAEd = useRichEditor("<p></p>");
  const altBEd = useRichEditor("<p></p>");
  const altCEd = useRichEditor("<p></p>");
  const altDEd = useRichEditor("<p></p>");
  const altEEd = useRichEditor("<p></p>");

  // cleanup previews
  useEffect(() => {
    return () => {
      if (suportePreview) URL.revokeObjectURL(suportePreview);
      (["A", "B", "C", "D", "E"] as AltKey[]).forEach((k) => {
        if (altPreview[k]) URL.revokeObjectURL(altPreview[k]);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // carregar disciplinas
  useEffect(() => {
    (async () => {
      try {
        setLoadingDisc(true);
        const { data } = await api.get<Disciplina[]>("/disciplinas/");
        setDisciplinas(data);
      } catch {
        setErr("Não foi possível carregar as disciplinas.");
      } finally {
        setLoadingDisc(false);
      }
    })();
  }, []);

  const lastInjectedIdRef = React.useRef<number | null>(null);

  // injetar initialData (editar)
  useEffect(() => {
    if (mode !== "edit" || !initialData) return;

    // evita reinjetar sem necessidade (isso é o que tava te travando na prática)
    if (lastInjectedIdRef.current === initialData.id) return;
    lastInjectedIdRef.current = initialData.id;

    setDisciplina(initialData.disciplina ?? 0);
    setSaberId(initialData.saber ?? "");
    setHabilidadeId(initialData.habilidade ?? "");
    setIsPrivate(!!initialData.is_private);

    setRefImagem(initialData.ref_imagem ?? "");
    setCurrentSuporteUrl(initialData.imagem_suporte || "");
    setRemoveSuporte(false);
    setSuporteFile(null);
    setSuportePreview(""); // sem revoke aqui

    // textos principais
    enunciadoEd.editor?.commands.setContent(initialData.enunciado_html || "<p></p>");
    comandoEd.editor?.commands.setContent(initialData.comando_html || "<p></p>");
    textoApoioEd.editor?.commands.setContent(initialData.texto_suporte_html || "<p></p>");

    // respostas
    const respostas = Array.isArray(initialData.respostas) ? initialData.respostas : [];
    const byOrdem = new Map<number, RespostaDTO>();
    for (const r of respostas) byOrdem.set(r.ordem, r);

    const r1 = byOrdem.get(1);
    const r2 = byOrdem.get(2);
    const r3 = byOrdem.get(3);
    const r4 = byOrdem.get(4);
    const r5 = byOrdem.get(5);

    altAEd.editor?.commands.setContent(r1?.texto_html || "<p></p>");
    altBEd.editor?.commands.setContent(r2?.texto_html || "<p></p>");
    altCEd.editor?.commands.setContent(r3?.texto_html || "<p></p>");
    altDEd.editor?.commands.setContent(r4?.texto_html || "<p></p>");
    altEEd.editor?.commands.setContent(r5?.texto_html || "<p></p>");

    const correta = respostas.find((r) => r.correta);
    setAltCorreta(correta ? (ordemToAlt(correta.ordem) as Alternativa) : "");

    // imagens atuais vindas do backend
    setCurrentAltImgUrl({
      A: r1?.imagem || "",
      B: r2?.imagem || "",
      C: r3?.imagem || "",
      D: r4?.imagem || "",
      E: r5?.imagem || "",
    });

    // reseta uploads/remover e previews locais
    setAltImg({ A: null, B: null, C: null, D: null, E: null });
    setRemoveAltImg({ A: false, B: false, C: false, D: false, E: false });
    setAltPreview({ A: "", B: "", C: "", D: "", E: "" }); // sem revoke aqui
  }, [
    mode,
    initialData,
    enunciadoEd.editor,
    comandoEd.editor,
    textoApoioEd.editor,
    altAEd.editor,
    altBEd.editor,
    altCEd.editor,
    altDEd.editor,
    altEEd.editor,
  ]);

  // saberes por disciplina
  useEffect(() => {
    if (!disciplina) {
      setSaberes([]);
      setSaberId("");
      setHabilidades([]);
      setHabilidadeId("");
      return;
    }
    (async () => {
      try {
        setLoadingSab(true);
        const { data } = await api.get<Saber[]>("/saberes/", { params: { disciplina } });
        setSaberes(data);
        // não zera saber/habilidade no edit (senão apaga seleção), só no create
        if (mode === "create") {
          setSaberId("");
          setHabilidades([]);
          setHabilidadeId("");
        }
      } finally {
        setLoadingSab(false);
      }
    })();
  }, [disciplina, mode]);

  // habilidades por saber
  useEffect(() => {
    if (!saberId) {
      setHabilidades([]);
      setHabilidadeId("");
      return;
    }
    (async () => {
      try {
        setLoadingHab(true);
        const { data } = await api.get<Habilidade[]>("/habilidades/", { params: { saber: saberId } });
        setHabilidades(data);
        if (mode === "create") setHabilidadeId("");
      } finally {
        setLoadingHab(false);
      }
    })();
  }, [saberId, mode]);

  function pickSupportFile(f: File | null) {
    setSuporteFile(f);
    setRemoveSuporte(false);
    if (suportePreview) URL.revokeObjectURL(suportePreview);
    setSuportePreview(f ? URL.createObjectURL(f) : "");
  }

  function pickAltFile(key: AltKey, file: File | null) {
    setAltImg((p) => ({ ...p, [key]: file }));
    setRemoveAltImg((p) => ({ ...p, [key]: false }));

    if (altPreview[key]) URL.revokeObjectURL(altPreview[key]);
    setAltPreview((p) => ({ ...p, [key]: file ? URL.createObjectURL(file) : "" }));
  }

  function removeAltImage(key: AltKey) {
    setRemoveAltImg((p) => ({ ...p, [key]: true }));
    setAltImg((p) => ({ ...p, [key]: null }));
    if (altPreview[key]) URL.revokeObjectURL(altPreview[key]);
    setAltPreview((p) => ({ ...p, [key]: "" }));
  }

  const getHtml = useMemo(() => {
    return {
      A: () => altAEd.getHtml(),
      B: () => altBEd.getHtml(),
      C: () => altCEd.getHtml(),
      D: () => altDEd.getHtml(),
      E: () => altEEd.getHtml(),
    } as Record<AltKey, () => string>;
  }, [altAEd, altBEd, altCEd, altDEd, altEEd]);

  const filled = useMemo(() => {
    if (mode === "edit") {
      return computeFilledEdit({ getHtml, img: altImg, currentUrl: currentAltImgUrl, remove: removeAltImg });
    }
    return computeFilledCreate({ getHtml, img: altImg });
  }, [mode, getHtml, altImg, currentAltImgUrl, removeAltImg]);

  const canSave = useMemo(() => {
    if (disciplina <= 0) return false;
    if (!hasMeaningfulHtml(enunciadoEd.getHtml())) return false;
    if (!hasMeaningfulHtml(comandoEd.getHtml())) return false;

    const altErr = validateAlternatives({
      filled,
      altCorreta: (altCorreta as AltKey) || "",
    });
    return !altErr;
  }, [disciplina, enunciadoEd, comandoEd, filled, altCorreta]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTriedSubmit(true);
    setErr("");

    if (!hasMeaningfulHtml(comandoEd.getHtml())) {
      setErr("O comando é obrigatório.");
      return;
    }

    const altErr = validateAlternatives({
      filled,
      altCorreta: (altCorreta as AltKey) || "",
    });
    if (altErr) {
      setErr(altErr);
      return;
    }

    try {
      setSaving(true);

      const { used, respostas } = buildRespostasPayload({
        getHtml,
        filled,
        altCorreta: altCorreta as AltKey,
      });

      const fd = new FormData();
      fd.append("disciplina", String(disciplina));
      fd.append("enunciado_html", normalizeHtml(enunciadoEd.getHtml()));
      fd.append("comando_html", normalizeHtml(comandoEd.getHtml()));
      fd.append("texto_suporte_html", normalizeHtml(textoApoioEd.getHtml()));
      fd.append("ref_imagem", refImagem || "");
      fd.append("is_private", String(isPrivate));
      fd.append("respostas_payload", JSON.stringify(respostas));

      if (saberId) fd.append("saber", String(saberId));
      else if (mode === "edit") fd.append("saber", "");

      if (habilidadeId) fd.append("habilidade", String(habilidadeId));
      else if (mode === "edit") fd.append("habilidade", "");

      // suporte
      if (mode === "edit" && removeSuporte) fd.append("remove_imagem_suporte", "1");
      else if (suporteFile) fd.append("imagem_suporte", suporteFile);

      // imagens das alternativas (somente as usadas)
      used.forEach((k, idx) => {
        const ordem = idx + 1;
        const file = altImg[k];
        if (file) fd.append(`resposta_imagem_${ordem}`, file);

        if (mode === "edit") {
          if (removeAltImg[k]) fd.append(`remove_resposta_imagem_${ordem}`, "1");
        }
      });

      await onSubmitFormData(fd);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const AltImagemUI = ({ keyAlt }: { keyAlt: AltKey }) => {
    const showUrl =
      altPreview[keyAlt] ||
      (mode === "edit" && !removeAltImg[keyAlt] && currentAltImgUrl[keyAlt]
        ? currentAltImgUrl[keyAlt]
        : "");

    return (
      <div className="mt-3">
        <label className="text-xs font-medium text-slate-500">
          Imagem da alternativa {keyAlt} (opcional)
        </label>

        <div className="mt-2 flex items-start gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => pickAltFile(keyAlt, e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />

          {showUrl && (
            <img
              src={showUrl}
              alt={`Imagem alternativa ${keyAlt}`}
              className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
            />
          )}
        </div>

        {mode === "edit" && !!currentAltImgUrl[keyAlt] && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => removeAltImage(keyAlt)}
              className="text-sm text-red-600 hover:underline"
            >
              Remover imagem da alternativa {keyAlt}
            </button>
            {removeAltImg[keyAlt] && (
              <span className="text-xs text-slate-500">(vai remover ao salvar)</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {/* CARD MASTER */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        {/* Topo */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-slate-500">
              Disciplina <ReqStar />
            </label>
            <select
              value={disciplina}
              disabled={loadingDisc}
              onChange={(e) => setDisciplina(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value={0} disabled>
                Selecione…
              </option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Saber (opcional)</label>
            <select
              value={saberId}
              disabled={!disciplina || loadingSab}
              onChange={(e) => setSaberId(e.target.value ? Number(e.target.value) : "")}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Nenhum</option>
              {saberes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo} — {s.titulo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Habilidade (opcional)</label>
            <select
              value={habilidadeId}
              disabled={!saberId || loadingHab}
              onChange={(e) => setHabilidadeId(e.target.value ? Number(e.target.value) : "")}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Nenhuma</option>
              {habilidades.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.codigo} — {h.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Enunciado */}
        <div>
          <label className="text-xs font-medium text-slate-500">
            Enunciado <ReqStar />
          </label>
          <div className="mt-2">
            <RichEditor editor={enunciadoEd.editor} placeholder="Digite o enunciado…" />
          </div>
        </div>

        {/* Apoio */}
        <Accordion
          title="Apoio"
          subtitle="Texto de apoio + imagem de apoio (opcionais)"
          defaultOpen={false}
        >
          <div>
            <label className="text-xs font-medium text-slate-500">
              Texto de apoio (opcional)
            </label>
            <div className="mt-2">
              <RichEditor
                editor={textoApoioEd.editor}
                placeholder="Se houver texto base, cole aqui…"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-medium text-slate-500">
              Imagem de apoio (opcional)
            </label>

            <div className="mt-2 flex items-start gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => pickSupportFile(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />

              {(suportePreview || (mode === "edit" ? currentSuporteUrl : "")) && !removeSuporte && (
                <img
                  src={suportePreview || currentSuporteUrl}
                  alt="Imagem de apoio"
                  className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                />
              )}
            </div>

            {mode === "edit" && !!currentSuporteUrl && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRemoveSuporte(true);
                    setSuporteFile(null);
                    if (suportePreview) URL.revokeObjectURL(suportePreview);
                    setSuportePreview("");
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remover imagem de apoio
                </button>
                {removeSuporte && (
                  <span className="text-xs text-slate-500">(vai remover ao salvar)</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-slate-500">
              Referência da imagem (opcional)
            </label>
            <input
              value={refImagem}
              onChange={(e) => setRefImagem(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Ex: fonte/autor/link…"
            />
          </div>
        </Accordion>

        {/* Comando */}
        <div>
          <label className="text-xs font-medium text-slate-500">
            Comando <ReqStar />
          </label>
          <div className="mt-2">
            <RichEditor
              editor={comandoEd.editor}
              placeholder="Ex: Assinale a alternativa correta…"
            />
          </div>

          {triedSubmit && !hasMeaningfulHtml(comandoEd.getHtml()) && (
            <p className="mt-2 text-xs text-red-600">O comando é obrigatório.</p>
          )}
        </div>

        {/* Alternativas */}
        <Accordion
          title={
            <span>
              Alternativas <ReqStar />
            </span>
          }
          defaultOpen={true}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {ALT_KEYS.map((k) => {
                const active = altAtiva === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAltAtiva(k)}
                    className={[
                      "px-5 py-2.5 text-sm rounded-lg transition font-medium border",
                      active
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    Alternativa {k}
                  </button>
                );
              })}
            </div>

            {altAtiva === "A" && (
              <div>
                <RichEditor editor={altAEd.editor} placeholder="Digite a alternativa…" />
                <AltImagemUI keyAlt="A" />
              </div>
            )}
            {altAtiva === "B" && (
              <div>
                <RichEditor editor={altBEd.editor} placeholder="Digite a alternativa…" />
                <AltImagemUI keyAlt="B" />
              </div>
            )}
            {altAtiva === "C" && (
              <div>
                <RichEditor editor={altCEd.editor} placeholder="Digite a alternativa…" />
                <AltImagemUI keyAlt="C" />
              </div>
            )}
            {altAtiva === "D" && (
              <div>
                <RichEditor editor={altDEd.editor} placeholder="Digite a alternativa…" />
                <AltImagemUI keyAlt="D" />
              </div>
            )}
            {altAtiva === "E" && (
              <div>
                <RichEditor editor={altEEd.editor} placeholder="Digite a alternativa…" />
                <AltImagemUI keyAlt="E" />
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <label className="text-xs font-medium text-slate-500">
                Alternativa correta <ReqStar />
              </label>
              <select
                value={altCorreta}
                onChange={(e) => {
                  const v = e.target.value as Alternativa | "";
                  setAltCorreta(v);
                  if (v) setAltAtiva(v as AltKey);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {ALTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Accordion>

        {/* Rodapé */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 select-none">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span className="font-medium">Questão privada</span>
            <span className="text-xs text-slate-500">(somente você consegue usar)</span>
          </label>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canSave || saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Salvando…" : mode === "edit" ? "Salvar alterações" : "Salvar questão"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
