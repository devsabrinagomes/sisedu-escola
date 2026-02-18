import { hasMeaningfulHtml, normalizeHtml } from "@/components/RichEditor";
import type { Alternativa } from "@/types/core";
import type { AltKey, FilledMap } from "./validation";
import { ALT_KEYS, lastFilledIndex, validateAlternatives } from "./validation";

export type { AltKey, FilledMap };
export { validateAlternatives };
export const ALTS: Alternativa[] = ["A", "B", "C", "D", "E"];

export type RespostaPayload = {
  ordem: number; // 1..5
  texto_html: string;
  correta: boolean;
};

export function ordemToAlt(ordem: number): AltKey {
  return ordem === 1 ? "A" : ordem === 2 ? "B" : ordem === 3 ? "C" : ordem === 4 ? "D" : "E";
}

export function computeFilledCreate(args: {
  getHtml: Record<AltKey, () => string>;
  img: Record<AltKey, File | null>;
}): FilledMap {
  const { getHtml, img } = args;

  return {
    A: hasMeaningfulHtml(getHtml.A()) || !!img.A,
    B: hasMeaningfulHtml(getHtml.B()) || !!img.B,
    C: hasMeaningfulHtml(getHtml.C()) || !!img.C,
    D: hasMeaningfulHtml(getHtml.D()) || !!img.D,
    E: hasMeaningfulHtml(getHtml.E()) || !!img.E,
  };
}

export function computeFilledEdit(args: {
  getHtml: Record<AltKey, () => string>;
  img: Record<AltKey, File | null>;
  currentUrl: Record<AltKey, string>;
  remove: Record<AltKey, boolean>;
}): FilledMap {
  const { getHtml, img, currentUrl, remove } = args;

  return {
    A: hasMeaningfulHtml(getHtml.A()) || !!img.A || (!!currentUrl.A && !remove.A),
    B: hasMeaningfulHtml(getHtml.B()) || !!img.B || (!!currentUrl.B && !remove.B),
    C: hasMeaningfulHtml(getHtml.C()) || !!img.C || (!!currentUrl.C && !remove.C),
    D: hasMeaningfulHtml(getHtml.D()) || !!img.D || (!!currentUrl.D && !remove.D),
    E: hasMeaningfulHtml(getHtml.E()) || !!img.E || (!!currentUrl.E && !remove.E),
  };
}

export function buildRespostasPayload(params: {
  getHtml: Record<AltKey, () => string>;
  filled: FilledMap;
  altCorreta: AltKey;
}) {
  const { getHtml, filled, altCorreta } = params;
  const lastIdx = lastFilledIndex(filled);
  const used = ALT_KEYS.slice(0, Math.max(2, lastIdx + 1));

  const respostas: RespostaPayload[] = used.map((k, idx) => ({
    ordem: idx + 1,
    texto_html: normalizeHtml(getHtml[k]()),
    correta: k === altCorreta,
  }));

  return { used, respostas };
}

export { ALT_KEYS };
