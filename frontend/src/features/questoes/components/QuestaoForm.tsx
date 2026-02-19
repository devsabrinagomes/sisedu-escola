import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import RichEditor, { useRichEditor, hasMeaningfulHtml, normalizeHtml } from "@/components/RichEditor";
import Accordion from "@/components/Accordion";

type Subject = { id: number; name: string };
type Descriptor = { id: number; topic: number; code: string; name: string };
type Skill = { id: number; descriptor: number; code: string; name: string };

type AltKey = "A" | "B" | "C" | "D" | "E";
const ALT_KEYS: AltKey[] = ["A", "B", "C", "D", "E"];

type OptionDTO = {
  id?: number;
  letter: AltKey;
  option_text: string;
  option_image?: string | null;
  correct: boolean;
};

type QuestionVersionDTO = {
  id: number;
  version_number: number;
  title: string;
  command: string;
  support_text: string;
  support_image?: string | null;
  image_reference?: string;
  subject: number;
  descriptor: number | null;
  skill: number | null;
  options?: OptionDTO[];
};

export type QuestionDTO = {
  id: number;
  private: boolean;
  created_by: number;
  created_at: string;
  versions?: QuestionVersionDTO[];
};

type Mode = "create" | "edit";

function ReqStar() {
  return <span className="text-red-600">*</span>;
}

function pickLatestVersion(versions?: QuestionVersionDTO[]) {
  if (!versions?.length) return null;
  return [...versions].sort((a, b) => (b.version_number ?? 0) - (a.version_number ?? 0))[0];
}

export default function QuestaoForm({
  mode,
  initialData,
  onSubmitFormData,
  onCancel,
}: {
  mode: Mode;
  initialData?: QuestionDTO;
  onSubmitFormData: (fd: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // combos
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [descriptors, setDescriptors] = useState<Descriptor[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [loadingSkill, setLoadingSkill] = useState(false);

  // campos de relação
  const [subjectId, setSubjectId] = useState<number>(0);
  const [descriptorId, setDescriptorId] = useState<number | "">("");
  const [skillId, setSkillId] = useState<number | "">("");

  // flags
  const [isPrivate, setIsPrivate] = useState(false);

  // suporte
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportPreview, setSupportPreview] = useState("");
  const [removeSupport, setRemoveSupport] = useState(false);
  const [currentSupportUrl, setCurrentSupportUrl] = useState("");
  const [imageReference, setImageReference] = useState("");

  // editores (novo schema)
  const titleEd = useRichEditor("<p></p>");
  const commandEd = useRichEditor("<p></p>");
  const supportTextEd = useRichEditor("<p></p>");

  // alternativas (texto + img + correta)
  const [altAtiva, setAltAtiva] = useState<AltKey>("A");
  const [altCorreta, setAltCorreta] = useState<AltKey | "">("");

  const altEditors = {
    A: useRichEditor("<p></p>"),
    B: useRichEditor("<p></p>"),
    C: useRichEditor("<p></p>"),
    D: useRichEditor("<p></p>"),
    E: useRichEditor("<p></p>"),
  };

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

  // cleanup previews
  useEffect(() => {
    return () => {
      if (supportPreview) URL.revokeObjectURL(supportPreview);
      ALT_KEYS.forEach((k) => { if (altPreview[k]) URL.revokeObjectURL(altPreview[k]); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load subjects
  useEffect(() => {
    (async () => {
      try {
        setLoadingSubjects(true);
        const { data } = await api.get<Subject[]>("/subjects/");
        setSubjects(data);
      } catch {
        setErr("Não foi possível carregar as disciplinas (subjects).");
      } finally {
        setLoadingSubjects(false);
      }
    })();
  }, []);

  // load descriptors by subject
  useEffect(() => {
    if (!subjectId) {
      setDescriptors([]);
      setDescriptorId("");
      setSkills([]);
      setSkillId("");
      return;
    }
    (async () => {
      try {
        setLoadingDesc(true);
        const { data } = await api.get<Descriptor[]>("/descriptors/", { params: { subject: subjectId } });
        setDescriptors(data);
        if (mode === "create") {
          setDescriptorId("");
          setSkills([]);
          setSkillId("");
        }
      } finally {
        setLoadingDesc(false);
      }
    })();
  }, [subjectId, mode]);

  // load skills by descriptor
  useEffect(() => {
    if (!descriptorId) {
      setSkills([]);
      setSkillId("");
      return;
    }
    (async () => {
      try {
        setLoadingSkill(true);
        const { data } = await api.get<Skill[]>("/skills/", { params: { descriptor: descriptorId } });
        setSkills(data);
        if (mode === "create") setSkillId("");
      } finally {
        setLoadingSkill(false);
      }
    })();
  }, [descriptorId, mode]);

  // inject initialData (edit)
  const lastInjectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (mode !== "edit" || !initialData) return;
    if (lastInjectedIdRef.current === initialData.id) return;
    lastInjectedIdRef.current = initialData.id;

    setIsPrivate(!!initialData.private);

    const v = pickLatestVersion(initialData.versions);
    if (!v) return;

    setSubjectId(v.subject ?? 0);
    setDescriptorId(v.descriptor ?? "");
    setSkillId(v.skill ?? "");

    titleEd.editor?.commands.setContent(v.title || "<p></p>");
    commandEd.editor?.commands.setContent(v.command || "<p></p>");
    supportTextEd.editor?.commands.setContent(v.support_text || "<p></p>");

    setImageReference(v.image_reference || "");
    setCurrentSupportUrl(v.support_image || "");
    setRemoveSupport(false);
    setSupportFile(null);
    setSupportPreview("");

    const opts = Array.isArray(v.options) ? v.options : [];
    const byLetter = new Map<AltKey, OptionDTO>();
    opts.forEach((o) => byLetter.set(o.letter, o));

    ALT_KEYS.forEach((k) => {
      altEditors[k].editor?.commands.setContent(byLetter.get(k)?.option_text || "<p></p>");
    });

    const correct = opts.find((o) => o.correct);
    setAltCorreta(correct ? correct.letter : "");

    setCurrentAltImgUrl({
      A: byLetter.get("A")?.option_image || "",
      B: byLetter.get("B")?.option_image || "",
      C: byLetter.get("C")?.option_image || "",
      D: byLetter.get("D")?.option_image || "",
      E: byLetter.get("E")?.option_image || "",
    });

    setAltImg({ A: null, B: null, C: null, D: null, E: null });
    setRemoveAltImg({ A: false, B: false, C: false, D: false, E: false });
    setAltPreview({ A: "", B: "", C: "", D: "", E: "" });
  }, [mode, initialData, titleEd.editor, commandEd.editor, supportTextEd.editor, altEditors.A.editor, altEditors.B.editor, altEditors.C.editor, altEditors.D.editor, altEditors.E.editor]);

  function pickSupportFile(f: File | null) {
    setSupportFile(f);
    setRemoveSupport(false);
    if (supportPreview) URL.revokeObjectURL(supportPreview);
    setSupportPreview(f ? URL.createObjectURL(f) : "");
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

  const canSave = useMemo(() => {
    if (subjectId <= 0) return false;
    if (!hasMeaningfulHtml(titleEd.getHtml())) return false;
    if (!hasMeaningfulHtml(commandEd.getHtml())) return false;

    // valida alternativas: pelo menos 2 preenchidas + 1 correta
    const filled = ALT_KEYS.filter((k) => hasMeaningfulHtml(altEditors[k].getHtml()));
    if (filled.length < 2) return false;
    if (!altCorreta) return false;
    if (!filled.includes(altCorreta)) return false;

    return true;
  }, [subjectId, titleEd, commandEd, altEditors, altCorreta]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTriedSubmit(true);
    setErr("");

    if (!hasMeaningfulHtml(commandEd.getHtml())) {
      setErr("O comando é obrigatório.");
      return;
    }

    const filled = ALT_KEYS.filter((k) => hasMeaningfulHtml(altEditors[k].getHtml()));
    if (filled.length < 2) {
      setErr("Preencha pelo menos 2 alternativas.");
      return;
    }
    if (!altCorreta || !filled.includes(altCorreta)) {
      setErr("Escolha a alternativa correta (e ela precisa estar preenchida).");
      return;
    }

    try {
      setSaving(true);

      // monta options_payload (somente alternativas preenchidas)
      const options = filled.map((k) => ({
        letter: k,
        option_text: normalizeHtml(altEditors[k].getHtml()),
        correct: k === altCorreta,
      }));

      const fd = new FormData();
      fd.append("private", String(isPrivate));
      fd.append("subject", String(subjectId));
      fd.append("title", normalizeHtml(titleEd.getHtml()));
      fd.append("command", normalizeHtml(commandEd.getHtml()));
      fd.append("support_text", normalizeHtml(supportTextEd.getHtml()));
      fd.append("image_reference", imageReference || "");
      fd.append("options_payload", JSON.stringify(options));

      if (descriptorId) fd.append("descriptor", String(descriptorId));
      else if (mode === "edit") fd.append("descriptor", "");

      if (skillId) fd.append("skill", String(skillId));
      else if (mode === "edit") fd.append("skill", "");

      // suporte imagem
      if (mode === "edit" && removeSupport) fd.append("remove_support_image", "1");
      else if (supportFile) fd.append("support_image", supportFile);

      // imagens das alternativas (pelas letters)
      filled.forEach((k) => {
        const file = altImg[k];
        if (file) fd.append(`option_image_${k}`, file);
        if (mode === "edit" && removeAltImg[k]) fd.append(`remove_option_image_${k}`, "1");
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

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        {/* Topo */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-slate-500">
              Disciplina <ReqStar />
            </label>
            <select
              value={subjectId}
              disabled={loadingSubjects}
              onChange={(e) => setSubjectId(Number(e.target.value))}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value={0} disabled>Selecione…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Descritor (opcional)</label>
            <select
              value={descriptorId}
              disabled={!subjectId || loadingDesc}
              onChange={(e) => setDescriptorId(e.target.value ? Number(e.target.value) : "")}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Nenhum</option>
              {descriptors.map((d) => (
                <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Habilidade (opcional)</label>
            <select
              value={skillId}
              disabled={!descriptorId || loadingSkill}
              onChange={(e) => setSkillId(e.target.value ? Number(e.target.value) : "")}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="">Nenhuma</option>
              {skills.map((h) => (
                <option key={h.id} value={h.id}>{h.code} — {h.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Enunciado (title) */}
        <div>
          <label className="text-xs font-medium text-slate-500">
            Enunciado <ReqStar />
          </label>
          <div className="mt-2">
            <RichEditor editor={titleEd.editor} placeholder="Digite o enunciado…" />
          </div>
        </div>

        {/* Apoio */}
        <Accordion title="Apoio" subtitle="Texto de apoio + imagem (opcionais)" defaultOpen={false}>
          <div>
            <label className="text-xs font-medium text-slate-500">Texto de apoio (opcional)</label>
            <div className="mt-2">
              <RichEditor editor={supportTextEd.editor} placeholder="Se houver texto base, cole aqui…" />
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs font-medium text-slate-500">Imagem de apoio (opcional)</label>

            <div className="mt-2 flex items-start gap-4">
              <input type="file" accept="image/*" onChange={(e) => pickSupportFile(e.target.files?.[0] || null)} className="block w-full text-sm" />

              {(supportPreview || (mode === "edit" ? currentSupportUrl : "")) && !removeSupport && (
                <img src={supportPreview || currentSupportUrl} alt="Imagem de apoio" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
              )}
            </div>

            {mode === "edit" && !!currentSupportUrl && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRemoveSupport(true);
                    setSupportFile(null);
                    if (supportPreview) URL.revokeObjectURL(supportPreview);
                    setSupportPreview("");
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remover imagem de apoio
                </button>
                {removeSupport && <span className="text-xs text-slate-500">(vai remover ao salvar)</span>}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-slate-500">Referência da imagem (opcional)</label>
            <input
              value={imageReference}
              onChange={(e) => setImageReference(e.target.value)}
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
            <RichEditor editor={commandEd.editor} placeholder="Ex: Assinale a alternativa correta…" />
          </div>
          {triedSubmit && !hasMeaningfulHtml(commandEd.getHtml()) && (
            <p className="mt-2 text-xs text-red-600">O comando é obrigatório.</p>
          )}
        </div>

        {/* Alternativas */}
        <Accordion title={<span>Alternativas <ReqStar /></span>} defaultOpen={true}>
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

            {ALT_KEYS.map((k) => (
              altAtiva === k ? (
                <div key={k}>
                  <RichEditor editor={altEditors[k].editor} placeholder="Digite a alternativa…" />
                  <AltImagemUI keyAlt={k} />
                </div>
              ) : null
            ))}

            <div className="mt-5 flex items-center gap-3">
              <label className="text-xs font-medium text-slate-500">
                Alternativa correta <ReqStar />
              </label>
              <select
                value={altCorreta}
                onChange={(e) => {
                  const v = e.target.value as AltKey | "";
                  setAltCorreta(v);
                  if (v) setAltAtiva(v);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="" disabled>Selecione…</option>
                {ALT_KEYS.map((a) => <option key={a} value={a}>{a}</option>)}
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
