import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Check } from "lucide-react";
import RichEditor, {
  hasMeaningfulHtml,
  normalizeHtml,
  useRichEditor,
} from "@/components/RichEditor";

export type Alternativa = "A" | "B" | "C" | "D" | "E";

type SubjectDTO = { id: number; name: string };
type TopicDTO = { id: number; subject: number; description: string };
type DescriptorDTO = { id: number; topic: number; code: string; name: string };
type SkillDTO = { id: number; descriptor: number; code: string; name: string };

type QuestionOptionDTO = {
  id: number;
  letter: Alternativa;
  option_text: string;
  option_image: string | null;
  correct: boolean;
};

type QuestionVersionDTO = {
  id: number;
  question: number;
  version_number: number;
  title: string;
  command: string;
  support_text: string;
  support_image: string | null;
  image_reference: string | null;
  subject: number;
  descriptor: number | null;
  skill: number | null;
  annulled: boolean;
  created_at: string;
  options: QuestionOptionDTO[];
};

export type QuestaoDTO = {
  id: number;
  private: boolean;
  deleted: boolean;
  created_by: number;
  created_at: string;
  subject_name?: string | null;
  versions: QuestionVersionDTO[];
};

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  initialData?: QuestaoDTO | null;
  onSubmitFormData: (fd: FormData) => Promise<void>;
  onCancel?: () => void;
};

const LETTERS: Alternativa[] = ["A", "B", "C", "D", "E"];

function pickLatestVersion(versions?: QuestionVersionDTO[]) {
  if (!versions?.length) return null;
  return [...versions].sort((a, b) => {
    const av = a.version_number ?? 0;
    const bv = b.version_number ?? 0;
    if (bv !== av) return bv - av;
    return String(b.created_at).localeCompare(String(a.created_at));
  })[0];
}

function hasMeaningfulText(value: string) {
  return hasMeaningfulHtml(value);
}

function firstErrorText(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  if (typeof value === "string") return value;
  return "";
}

function toFriendlySaveError(e: any): string {
  const data = e?.response?.data;

  if (data?.detail) return String(data.detail);

  if (data && typeof data === "object") {
    const titleError = firstErrorText((data as any).title);
    if (titleError) {
      const low = titleError.toLowerCase();
      if (low.includes("required") || low.includes("blank") || low.includes("obrigat")) {
        return "O enunciado é obrigatório.";
      }
      return `Enunciado: ${titleError}`;
    }

    const commandError = firstErrorText((data as any).command);
    if (commandError) {
      const low = commandError.toLowerCase();
      if (low.includes("required") || low.includes("blank") || low.includes("obrigat")) {
        return "O comando é obrigatório.";
      }
      return `Comando: ${commandError}`;
    }

    const firstField = Object.entries(data as Record<string, unknown>)[0];
    if (firstField) {
      const [field, value] = firstField;
      const text = firstErrorText(value);
      if (text) return `${field}: ${text}`;
    }
  }

  const fallback = typeof e?.message === "string" ? e.message : "";
  if (fallback.includes("status code 400")) {
    return "Revise os campos obrigatórios e tente novamente.";
  }
  return fallback || "Não foi possível salvar.";
}

async function fetchList<T>(url: string): Promise<T[]> {
  const { data } = await api.get(url);
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  return [];
}

function RichTextField({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const { editor } = useRichEditor(value || "<p></p>");

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (disabled) return;
      onChange(editor.getHTML());
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [disabled, editor, onChange]);

  useEffect(() => {
    if (!editor) return;
    const current = normalizeHtml(editor.getHTML() || "");
    const next = normalizeHtml(value || "");
    if (current !== next) {
      editor.commands.setContent(next || "<p></p>", false);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div
      className={[
        "mt-1 rounded-lg border border-slate-200 bg-white",
        disabled ? "opacity-70" : "",
      ].join(" ")}
    >
      <RichEditor editor={editor} placeholder={placeholder} />
    </div>
  );
}

export default function QuestaoForm({
  mode,
  initialData,
  onSubmitFormData,
  onCancel,
}: Props) {
  const latest = useMemo(
    () => pickLatestVersion(initialData?.versions),
    [initialData]
  );

  // ====== catálogo ======
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [topics, setTopics] = useState<TopicDTO[]>([]);
  const [descriptors, setDescriptors] = useState<DescriptorDTO[]>([]);
  const [skills, setSkills] = useState<SkillDTO[]>([]);

  // ====== form fields ======
  const [isPrivate, setIsPrivate] = useState<boolean>(
    mode === "edit" ? !!initialData?.private : false
  );

  const [subjectId, setSubjectId] = useState<number | "">(
    latest?.subject ?? ""
  );
  const [topicId, setTopicId] = useState<number | "">("");
  const [descriptorId, setDescriptorId] = useState<number | "">(
    latest?.descriptor ?? ""
  );
  const [skillId, setSkillId] = useState<number | "">(
    latest?.skill ?? ""
  );

  const [title, setTitle] = useState<string>(latest?.title ?? "");
  const [command, setCommand] = useState<string>(latest?.command ?? "");
  const [supportText, setSupportText] = useState<string>(latest?.support_text ?? "");
  const [imageReference, setImageReference] = useState<string>(latest?.image_reference ?? "");

  const [supportImageFile, setSupportImageFile] = useState<File | null>(null);
  const [removeSupportImage, setRemoveSupportImage] = useState(false);

  type OptionState = {
    letter: Alternativa;
    option_text: string;
    correct: boolean;
    input_mode: "text" | "image";
    // arquivo novo
    file: File | null;
    // url atual (edit)
    currentUrl?: string | null;
    // remover imagem (edit)
    remove?: boolean;
  };

  const [options, setOptions] = useState<OptionState[]>(() => {
    const byLetter = new Map((latest?.options ?? []).map((o) => [o.letter, o]));

    const makeOption = (letter: Alternativa): OptionState => {
      const server = byLetter.get(letter);
      const optionText = server?.option_text ?? "";
      const currentUrl = server?.option_image ?? null;
      const hasText = hasMeaningfulText(optionText);
      const hasImage = !!currentUrl;
      const removeImageByDefault = hasText && hasImage;

      return {
        letter,
        option_text: optionText,
        correct: !!server?.correct || (!server && letter === "A"),
        input_mode: hasText ? "text" : hasImage ? "image" : "text",
        file: null,
        currentUrl,
        remove: removeImageByDefault,
      };
    };

    const base = (["A", "B", "C", "D"] as Alternativa[]).map(makeOption);
    const hasE = byLetter.has("E");
    if (hasE) base.push(makeOption("E"));

    // fallback defensivo para garantir uma correta
    if (!base.some((o) => o.correct)) base[0].correct = true;
    return base;
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // ====== load subjects ======
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchList<SubjectDTO>("/subjects/");
        setSubjects(list);
      } catch {
        setSubjects([]);
      }
    })();
  }, []);

  // ====== load topics when subject changes ======
  useEffect(() => {
    (async () => {
      if (!subjectId) {
        setTopics([]);
        setTopicId("");
        return;
      }
      try {
        const list = await fetchList<TopicDTO>("/topics/");
        const filtered = list.filter((t) => t.subject === Number(subjectId));
        setTopics(filtered);

        // se tá edit e já tem descriptor, tenta achar o topic dele
        if (mode === "edit" && latest?.descriptor && filtered.length) {
          // deixa pro efeito de descriptors ajustar depois
        } else {
          setTopicId(filtered[0]?.id ?? "");
        }
      } catch {
        setTopics([]);
        setTopicId("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  // ====== load descriptors when topic changes ======
  useEffect(() => {
    (async () => {
      if (!topicId) {
        setDescriptors([]);
        if (mode === "create") setDescriptorId("");
        return;
      }
      try {
        const list = await fetchList<DescriptorDTO>("/descriptors/");
        const filtered = list.filter((d) => d.topic === Number(topicId));
        setDescriptors(filtered);

        // se current descriptor não pertence a esse topic, reseta
        const current = Number(descriptorId || 0);
        if (!filtered.some((d) => d.id === current)) {
          setDescriptorId(filtered[0]?.id ?? "");
        }
      } catch {
        setDescriptors([]);
        if (mode === "create") setDescriptorId("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  // ====== load skills when descriptor changes ======
  useEffect(() => {
    (async () => {
      if (!descriptorId) {
        setSkills([]);
        if (mode === "create") setSkillId("");
        return;
      }
      try {
        const list = await fetchList<SkillDTO>("/skills/");
        const filtered = list.filter((s) => s.descriptor === Number(descriptorId));
        setSkills(filtered);

        const current = Number(skillId || 0);
        if (!filtered.some((s) => s.id === current)) {
          setSkillId(filtered[0]?.id ?? "");
        }
      } catch {
        setSkills([]);
        if (mode === "create") setSkillId("");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptorId]);

  // ====== se edit e tem descriptor, tenta deduzir o topic ======
  useEffect(() => {
    (async () => {
      if (mode !== "edit") return;
      if (!subjectId) return;

      // se já tem topic escolhido, não mexe
      if (topicId) return;

      // baixa tudo e acha o topic do descriptor atual
      if (!latest?.descriptor) return;

      try {
        const allDesc = await fetchList<DescriptorDTO>("/descriptors/");
        const d = allDesc.find((x) => x.id === Number(latest.descriptor));
        if (d) setTopicId(d.topic);
      } catch {
        // ignora
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, subjectId, latest?.descriptor]);

  // ====== options helpers ======
  function setCorrect(letter: Alternativa) {
    setOptions((prev) =>
      prev.map((o) => ({ ...o, correct: o.letter === letter }))
    );
  }

  function addOption() {
    setOptions((prev) => {
      if (prev.length >= 5) return prev;
      const nextLetter = "E" as Alternativa;
      return [
        ...prev,
        {
          letter: nextLetter,
          option_text: "",
          correct: false,
          input_mode: "text",
          file: null,
          currentUrl: null,
          remove: false,
        },
      ];
    });
  }

  function removeLastOption() {
    setOptions((prev) => {
      if (prev.length <= 4) return prev;
      const trimmed = prev.slice(0, prev.length - 1);
      // se removeu a correta, marca a primeira como correta
      if (!trimmed.some((o) => o.correct)) {
        trimmed[0] = { ...trimmed[0], correct: true };
      }
      return trimmed;
    });
  }

  function optionHasImage(opt: OptionState) {
    return !!opt.file || (!!opt.currentUrl && !opt.remove);
  }

  function optionHasText(opt: OptionState) {
    return hasMeaningfulText(opt.option_text || "");
  }

  function optionIsEmpty(opt: OptionState) {
    return !optionHasText(opt) && !optionHasImage(opt);
  }

  function optionHasBoth(opt: OptionState) {
    return optionHasText(opt) && optionHasImage(opt);
  }

  function validateOptions(): string | null {
    if (options.length < 4 || options.length > 5) {
      return "Cadastre entre 4 e 5 alternativas.";
    }

    if (options.some(optionIsEmpty)) {
      return "Cada alternativa deve ter texto ou imagem.";
    }

    if (options.some(optionHasBoth)) {
      return "Cada alternativa deve ter somente texto ou somente imagem.";
    }

    return null;
  }

  function buildFormData(): FormData {
    const fd = new FormData();

    fd.set("private", String(isPrivate ? "true" : "false"));
    fd.set("title", normalizeHtml(title ?? ""));
    fd.set("command", normalizeHtml(command ?? ""));
    fd.set("support_text", normalizeHtml(supportText ?? ""));
    fd.set("image_reference", imageReference ?? "");

    if (!subjectId) throw new Error("Selecione a disciplina (subject).");
    fd.set("subject", String(subjectId));

    if (descriptorId) fd.set("descriptor", String(descriptorId));
    if (skillId) fd.set("skill", String(skillId));

    if (supportImageFile) fd.set("support_image", supportImageFile);
    if (removeSupportImage) fd.set("remove_support_image", "1");

    // options_payload (JSON)
    const payload = options.map((o) => ({
      letter: o.letter,
      option_text: o.input_mode === "image" ? "" : normalizeHtml(o.option_text ?? ""),
      correct: !!o.correct,
    }));
    fd.set("options_payload", JSON.stringify(payload));

    // imagens por letra
    for (const opt of options) {
      if (opt.input_mode === "image" && opt.file) {
        fd.set(`option_image_${opt.letter}`, opt.file);
      }
      if (opt.input_mode === "text" || opt.remove) {
        fd.set(`remove_option_image_${opt.letter}`, "1");
      }
    }

    return fd;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (!hasMeaningfulText(title)) {
      setErr("O enunciado é obrigatório.");
      return;
    }

    if (!hasMeaningfulText(command)) {
      setErr("O comando é obrigatório.");
      return;
    }

    const optionsError = validateOptions();
    if (optionsError) {
      setErr(optionsError);
      return;
    }

    try {
      setSaving(true);
      const fd = buildFormData();
      await onSubmitFormData(fd);
    } catch (e: any) {
      setErr(toFriendlySaveError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {/* PRIVACIDADE */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Visibilidade</div>
            <div className="text-xs text-slate-500">
              Pública aparece pra todos; privada só pra você.
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="sr-only"
              aria-label="Marcar questão como privada"
            />
            <span
              className={[
                "inline-flex h-5 w-5 items-center justify-center rounded border transition-all duration-200",
                isPrivate ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white",
              ].join(" ")}
              aria-hidden="true"
            >
              <Check
                className={[
                  "h-3.5 w-3.5 text-white transition-all duration-200",
                  isPrivate ? "scale-100 opacity-100" : "scale-50 opacity-0",
                ].join(" ")}
              />
            </span>
            Privada
          </label>
        </div>
      </div>

      {/* CURRÍCULO */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="text-sm font-semibold text-slate-900">Classificação</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SUBJECT */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Disciplina</label>
            <select
              value={subjectId}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setSubjectId(v as any);
                setTopicId("");
                setDescriptorId("");
                setSkillId("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* TOPIC */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Tópico</label>
            <select
              value={topicId}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setTopicId(v as any);
                setDescriptorId("");
                setSkillId("");
              }}
              disabled={!subjectId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Selecione…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.description}
                </option>
              ))}
            </select>
          </div>

          {/* DESCRIPTOR */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Descritor</label>
            <select
              value={descriptorId}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setDescriptorId(v as any);
                setSkillId("");
              }}
              disabled={!topicId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">(Opcional) Selecione…</option>
              {descriptors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* SKILL */}
          <div>
            <label className="text-xs font-semibold text-slate-700">Habilidade</label>
            <select
              value={skillId}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setSkillId(v as any);
              }}
              disabled={!descriptorId}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">(Opcional) Selecione…</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="text-sm font-semibold text-slate-900">Conteúdo</div>

        <div>
          <label className="text-xs font-semibold text-slate-700">Enunciado</label>
          <RichTextField
            value={title}
            onChange={setTitle}
            placeholder="Digite o enunciado…"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700">Comando</label>
          <RichTextField
            value={command}
            onChange={setCommand}
            placeholder="Ex: Marque a alternativa correta."
          />
        </div>

        <details className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Apoio (opcional)
          </summary>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Texto de apoio</label>
              <RichTextField
                value={supportText}
                onChange={setSupportText}
                placeholder="Texto de apoio…"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Imagem de apoio</label>

              {mode === "edit" && latest?.support_image && !removeSupportImage && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={latest.support_image}
                    alt="Imagem atual"
                    className="h-16 w-16 rounded-lg border border-slate-200 object-cover bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setRemoveSupportImage(true)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remover imagem atual
                  </button>
                </div>
              )}

              {removeSupportImage && (
                <div className="mt-2 text-xs text-slate-600">
                  ✅ Vai remover a imagem atual ao salvar.
                  <button
                    type="button"
                    onClick={() => setRemoveSupportImage(false)}
                    className="ml-2 underline"
                  >
                    desfazer
                  </button>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSupportImageFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Referência da imagem</label>
              <input
                value={imageReference}
                onChange={(e) => setImageReference(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Fonte/URL/créditos…"
              />
            </div>
          </div>
        </details>
      </div>

      {/* ALTERNATIVAS */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Alternativas</div>

          <div className="flex items-center gap-2">
            {options.length < 5 ? (
              <button
                type="button"
                onClick={addOption}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                + Adicionar alternativa (E)
              </button>
            ) : (
              <button
                type="button"
                onClick={removeLastOption}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                - Remover alternativa (E)
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt) => (
            <div
              key={opt.letter}
              className={[
                "rounded-xl bg-white p-4",
                opt.correct ? "border-2 border-emerald-500" : "border border-slate-200",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{opt.letter})</div>

                <button
                  type="button"
                  onClick={() => setCorrect(opt.letter)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"
                  aria-label={`Marcar alternativa ${opt.letter} como correta`}
                  title="Marcar como correta"
                >
                  <span
                    className={[
                      "inline-flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200",
                      opt.correct
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-slate-300 bg-white",
                    ].join(" ")}
                  >
                    <Check
                      className={[
                        "h-3.5 w-3.5 text-white transition-all duration-200",
                        opt.correct ? "scale-100 opacity-100" : "scale-50 opacity-0",
                      ].join(" ")}
                    />
                  </span>
                  Correta
                </button>
              </div>

              <div className="mt-2 inline-flex rounded-lg border border-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setOptions((prev) =>
                      prev.map((o) =>
                        o.letter === opt.letter
                          ? {
                              ...o,
                              input_mode: "text",
                              file: null,
                              remove: !!o.currentUrl ? true : o.remove,
                            }
                          : o
                      )
                    );
                  }}
                  className={[
                    "rounded-md px-2 py-1 text-xs font-semibold transition",
                    opt.input_mode === "text"
                      ? "bg-emerald-100 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  Texto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOptions((prev) =>
                      prev.map((o) =>
                        o.letter === opt.letter
                          ? {
                              ...o,
                              input_mode: "image",
                              option_text: "",
                              remove: false,
                            }
                          : o
                      )
                    );
                  }}
                  className={[
                    "rounded-md px-2 py-1 text-xs font-semibold transition",
                    opt.input_mode === "image"
                      ? "bg-emerald-100 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  Imagem
                </button>
              </div>

              <RichTextField
                value={opt.option_text}
                onChange={(v) => {
                  setOptions((prev) =>
                    prev.map((o) =>
                      o.letter === opt.letter
                        ? {
                            ...o,
                            input_mode: "text",
                            option_text: v,
                            file: null,
                            remove: !!o.currentUrl ? true : o.remove,
                          }
                        : o
                    )
                  );
                }}
                disabled={opt.input_mode === "image"}
                placeholder={`Texto da alternativa ${opt.letter}…`}
              />

              <div className="mt-2">
                <label className="text-xs font-semibold text-slate-700">
                  Imagem
                </label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={opt.input_mode === "text"}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setOptions((prev) =>
                      prev.map((o) =>
                        o.letter === opt.letter
                          ? {
                              ...o,
                              input_mode: "image",
                              option_text: "",
                              file,
                              remove: false,
                            }
                          : o
                      )
                    );
                  }}
                  className="mt-1 block w-full text-sm disabled:opacity-50"
                />
              </div>

              {(!!opt.file || (!!opt.currentUrl && !opt.remove)) && (
                <div className="mt-2 flex items-center gap-3">
                  {opt.file ? (
                    <div className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      Nova imagem selecionada
                    </div>
                  ) : (
                    <img
                      src={opt.currentUrl as string}
                      alt={`Imagem ${opt.letter}`}
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover bg-white"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOptions((prev) =>
                        prev.map((o) =>
                          o.letter === opt.letter
                            ? { ...o, file: null, remove: true }
                            : o
                        )
                      );
                    }}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remover imagem
                  </button>
                </div>
              )}

              {optionIsEmpty(opt) && (
                <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  Preencha o texto ou envie uma imagem.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        ) : (
          <Link
            to="/questoes"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "Salvando…" : mode === "create" ? "Criar questão" : "Salvar nova versão"}
        </button>
      </div>
    </form>
  );
}
