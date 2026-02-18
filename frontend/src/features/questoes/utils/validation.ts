import { hasMeaningfulHtml } from "@/components/RichEditor";

export type AltKey = "A" | "B" | "C" | "D" | "E";
export const ALT_KEYS: AltKey[] = ["A", "B", "C", "D", "E"];

export type FilledMap = Record<AltKey, boolean>;

export function lastFilledIndex(filled: FilledMap) {
  return Math.max(...ALT_KEYS.map((k, i) => (filled[k] ? i : -1)));
}

export function validateComando(comandoHtml: string) {
  if (!hasMeaningfulHtml(comandoHtml)) return "O comando é obrigatório.";
  return null;
}

export function validateEnunciado(enunciadoHtml: string) {
  if (!hasMeaningfulHtml(enunciadoHtml)) return "O enunciado é obrigatório.";
  return null;
}

/**
 * Regras:
 * - mínimo 2 alternativas
 * - A e B obrigatórias
 * - vazias só no final (sem “buraco” tipo A,B,D)
 * - correta deve existir e estar preenchida
 */
export function validateAlternatives(params: {
  filled: FilledMap;
  altCorreta: AltKey | "";
}) {
  const { filled, altCorreta } = params;

  // A e B obrigatórias
  if (!filled.A || !filled.B) {
    return "As alternativas A e B são obrigatórias.";
  }

  const lastIdx = lastFilledIndex(filled);
  if (lastIdx < 1) {
    return "Informe pelo menos duas alternativas (A e B).";
  }

  // sem buracos: tudo até a última preenchida tem que estar preenchido
  const noHoles = ALT_KEYS.slice(0, lastIdx + 1).every((k) => filled[k]);
  if (!noHoles) {
    return "As alternativas vazias só podem ser no final (sem pular letras).";
  }

  // correta
  if (!altCorreta) return "Selecione a alternativa correta.";
  if (!filled[altCorreta]) return "A alternativa correta precisa estar preenchida.";
  if (ALT_KEYS.indexOf(altCorreta) > lastIdx) {
    return "A alternativa correta precisa estar dentro das alternativas preenchidas.";
  }

  return null;
}
