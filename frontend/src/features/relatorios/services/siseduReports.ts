import { siseduApi } from "@/lib/siseduApi";

export type Disciplina = {
  id: number;
  nome: string;
};

export type Saber = {
  id: number;
  nome: string;
  codigo?: string;
  topicoId?: number;
};

export type Habilidade = {
  id: number;
  nome: string;
  codigo?: string;
};

export type SaberesFilters = {
  disciplinaId: number;
  topicoId?: number;
};

export type HabilidadesFilters = {
  disciplinaId: number;
  serie?: number;
  nivel?: number;
};

export type SiseduContextFilters = {
  topicoId?: number;
  serie?: number;
  nivel?: number;
};

export type Subject = {
  id: number;
  name: string;
};

export type Descriptor = {
  id: number;
  name: string;
  code?: string;
  topicId?: number;
};

export type Skill = {
  id: number;
  name: string;
  code?: string;
};

function asNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
}

function extractName(value: unknown): string | undefined {
  if (typeof value === "string") return asNonEmptyString(value);
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  return (
    asNonEmptyString(row.nome) ||
    asNonEmptyString(row.name) ||
    asNonEmptyString(row.descricao) ||
    asNonEmptyString(row.description)
  );
}

function toArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as any).results)) {
    return (payload as any).results as T[];
  }
  return [];
}

export function mapDisciplina(row: unknown): Disciplina | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as Record<string, unknown>;
  const wrapped = raw.disciplina && typeof raw.disciplina === "object" ? (raw.disciplina as Record<string, unknown>) : null;
  const id = asNumber(raw.id) || asNumber(raw.disciplina_id) || asNumber(wrapped?.id);
  const nome =
    extractName(raw.nome) ||
    extractName(raw.name) ||
    extractName(raw.disciplina) ||
    extractName(wrapped);
  if (!id || !nome) return null;
  return { id, nome };
}

export function mapDescritorToSaber(row: unknown): Saber | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as Record<string, unknown>;
  const wrapped = raw.descritor && typeof raw.descritor === "object" ? (raw.descritor as Record<string, unknown>) : null;
  const id = asNumber(raw.id) || asNumber(raw.descritor_id) || asNumber(raw.saber_id) || asNumber(wrapped?.id);
  const nome =
    extractName(raw.descritor) ||
    extractName(raw.saber) ||
    extractName(raw.nome) ||
    extractName(raw.name) ||
    extractName(wrapped);
  if (!id || !nome) return null;
  return {
    id,
    nome,
    codigo:
      asNonEmptyString(raw.codigo) ||
      asNonEmptyString(raw.code) ||
      asNonEmptyString(wrapped?.codigo) ||
      asNonEmptyString(wrapped?.code),
    topicoId: asNumber(raw.topico) || asNumber(raw.topico_id) || asNumber(wrapped?.topico) || asNumber(wrapped?.topico_id),
  };
}

export function mapNivelDesempenhoToHabilidade(row: unknown): Habilidade | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as Record<string, unknown>;
  const wrapped =
    raw.nivel_desempenho && typeof raw.nivel_desempenho === "object"
      ? (raw.nivel_desempenho as Record<string, unknown>)
      : null;
  const id =
    asNumber(raw.id) ||
    asNumber(raw.nivel_desempenho_id) ||
    asNumber(raw.habilidade_id) ||
    asNumber(wrapped?.id);
  const nome =
    extractName(raw.nivel_desempenho) ||
    extractName(raw.habilidade) ||
    extractName(raw.nome) ||
    extractName(raw.name) ||
    extractName(wrapped);
  if (!id || !nome) return null;
  return {
    id,
    nome,
    codigo:
      asNonEmptyString(raw.codigo) ||
      asNonEmptyString(raw.code) ||
      asNonEmptyString(wrapped?.codigo) ||
      asNonEmptyString(wrapped?.code),
  };
}

export async function getDisciplinas() {
  const { data } = await siseduApi.get("/report/disciplinas/");
  return toArray(data).map(mapDisciplina).filter(Boolean) as Disciplina[];
}

export async function getSaberes(filters: SaberesFilters) {
  const params: Record<string, number> = {
    disciplina: filters.disciplinaId,
  };
  if (typeof filters.topicoId === "number") params.topico = filters.topicoId;
  const { data } = await siseduApi.get("/report/descritores/", {
    params,
  });
  return toArray(data).map(mapDescritorToSaber).filter(Boolean) as Saber[];
}

export async function getHabilidades(filters: HabilidadesFilters) {
  const params: Record<string, number> = {
    disciplina: filters.disciplinaId,
  };
  if (typeof filters.serie === "number") params.serie = filters.serie;
  if (typeof filters.nivel === "number") params.nivel = filters.nivel;
  const { data } = await siseduApi.get("/report/niveis_desempenho/", {
    params,
  });
  return toArray(data).map(mapNivelDesempenhoToHabilidade).filter(Boolean) as Habilidade[];
}

export function toSubject(row: Disciplina): Subject {
  return { id: row.id, name: row.nome };
}

export function toDescriptor(row: Saber): Descriptor {
  return {
    id: row.id,
    name: row.nome,
    code: row.codigo,
    topicId: row.topicoId,
  };
}

export function toSkill(row: Habilidade): Skill {
  return {
    id: row.id,
    name: row.nome,
    code: row.codigo,
  };
}

export async function getSubjects() {
  const disciplinas = await getDisciplinas();
  return disciplinas.map(toSubject);
}

export async function getDescriptors(filters: SaberesFilters) {
  const saberes = await getSaberes(filters);
  return saberes.map(toDescriptor);
}

export async function getSkills(filters: HabilidadesFilters) {
  const habilidades = await getHabilidades(filters);
  return habilidades.map(toSkill);
}

function readPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function resolveSiseduContextFilters(overrides?: SiseduContextFilters): SiseduContextFilters {
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const topicoFromQuery = readPositiveNumber(search?.get("topico"));
  const serieFromQuery = readPositiveNumber(search?.get("serie"));
  const nivelFromQuery = readPositiveNumber(search?.get("nivel"));

  const topicoFromEnv = readPositiveNumber(import.meta.env.VITE_SISEDU_TOPICO_ID);
  const serieFromEnv = readPositiveNumber(import.meta.env.VITE_SISEDU_SERIE);
  const nivelFromEnv = readPositiveNumber(import.meta.env.VITE_SISEDU_NIVEL);

  return {
    topicoId: overrides?.topicoId || topicoFromQuery || topicoFromEnv,
    serie: overrides?.serie || serieFromQuery || serieFromEnv,
    nivel: overrides?.nivel || nivelFromQuery || nivelFromEnv,
  };
}
