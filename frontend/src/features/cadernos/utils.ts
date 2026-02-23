import type {
  BookletItemDTO,
  BookletItemDraft,
  BookletItemQuestionVersionDTO,
  QuestionDTO,
  QuestionVersionDTO,
  SubjectDTO,
} from "@/features/cadernos/types";

export function stripHtml(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

export function pickLatestVersion(versions?: QuestionVersionDTO[]) {
  if (!versions?.length) return null;
  return [...versions].sort((a, b) => {
    const an = a.version_number ?? 0;
    const bn = b.version_number ?? 0;
    if (bn !== an) return bn - an;
    return String(b.created_at).localeCompare(String(a.created_at));
  })[0];
}

export function toBookletDraftFromQuestion(
  question: QuestionDTO,
  subjectsById: Map<number, string>,
): BookletItemDraft | null {
  const latest = pickLatestVersion(question.versions);
  if (!latest) return null;

  return {
    local_id: `qv-${latest.id}`,
    question_version_id: latest.id,
    question_id: question.id,
    order: 0,
    title: stripHtml(latest.title || ""),
    subject_name:
      question.subject_name ||
      subjectsById.get(latest.subject) ||
      (latest.subject ? `Disciplina #${latest.subject}` : null),
    descriptor_label: latest.descriptor ? `Saber #${latest.descriptor}` : null,
    skill_label: latest.skill ? `Habilidade #${latest.skill}` : null,
    annulled: latest.annulled,
  };
}

function questionVersionIdOf(item: BookletItemDTO) {
  if (item.question_version_data?.id) return item.question_version_data.id;
  return typeof item.question_version === "number"
    ? item.question_version
    : item.question_version.id;
}

function questionVersionDataOf(item: BookletItemDTO): BookletItemQuestionVersionDTO | null {
  if (item.question_version_data) return item.question_version_data;
  return typeof item.question_version === "number" ? null : item.question_version;
}

export function toBookletDraftFromItem(item: BookletItemDTO): BookletItemDraft {
  const versionId = questionVersionIdOf(item);
  const versionData = questionVersionDataOf(item);
  const questionId = item.question_id ?? versionData?.question;

  return {
    local_id: item.id ? `item-${item.id}` : `qv-${versionId}`,
    persisted_item_id: item.id,
    question_version_id: versionId,
    question_id: questionId,
    order: item.order ?? 0,
    title: stripHtml(versionData?.title || "") || `Questão #${questionId ?? "?"}`,
    subject_name:
      versionData?.subject_name ||
      (versionData?.subject ? `Disciplina #${versionData.subject}` : null),
    descriptor_label: versionData?.descriptor
      ? `Saber #${versionData.descriptor}`
      : null,
    skill_label: versionData?.skill ? `Habilidade #${versionData.skill}` : null,
    annulled: Boolean(versionData?.annulled),
  };
}

export function normalizeOrders(items: BookletItemDraft[]) {
  return items.map((item, index) => ({ ...item, order: index + 1 }));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })
    .format(dt)
    .replace(",", " às");
}

export function toSubjectsMap(subjects: SubjectDTO[]) {
  const map = new Map<number, string>();
  for (const subject of subjects) {
    map.set(subject.id, subject.name);
  }
  return map;
}
