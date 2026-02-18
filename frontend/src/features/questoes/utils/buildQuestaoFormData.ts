import { normalizeHtml } from "@/components/RichEditor";
import type { AltKey } from "./validation";
import type { RespostaPayload } from "./questaoForm.utils";

type BaseArgs = {
  disciplina: number;
  saberId?: number | "";
  habilidadeId?: number | "";
  enunciadoHtml: string;
  comandoHtml: string;
  textoApoioHtml: string;
  refImagem: string;
  isPrivate: boolean;

  // suporte
  suporteFile: File | null;

  // respostas
  respostas: RespostaPayload[];
  usedKeys: AltKey[];

  // imagens alternativas (ordem 1..)
  altImg: Record<AltKey, File | null>;
};

type EditArgs = BaseArgs & {
  mode: "edit";
  removeSuporte: boolean;
  removeAltImg: Record<AltKey, boolean>;
};

type CreateArgs = BaseArgs & {
  mode: "create";
};

export function buildQuestaoFormData(args: CreateArgs | EditArgs) {
  const fd = new FormData();

  fd.append("disciplina", String(args.disciplina));
  fd.append("enunciado_html", normalizeHtml(args.enunciadoHtml));
  fd.append("comando_html", normalizeHtml(args.comandoHtml));
  fd.append("texto_suporte_html", normalizeHtml(args.textoApoioHtml));
  fd.append("ref_imagem", args.refImagem || "");
  fd.append("is_private", String(args.isPrivate));

  // saber/habilidade opcionais
  if (args.saberId) fd.append("saber", String(args.saberId));
  else if (args.mode === "edit") fd.append("saber", "");

  if (args.habilidadeId) fd.append("habilidade", String(args.habilidadeId));
  else if (args.mode === "edit") fd.append("habilidade", "");

  // payload respostas
  fd.append("respostas_payload", JSON.stringify(args.respostas));

  // suporte
  if (args.mode === "edit" && args.removeSuporte) {
    fd.append("remove_imagem_suporte", "1");
  } else if (args.suporteFile) {
    fd.append("imagem_suporte", args.suporteFile);
  }

  // imagens alternativas: por ordem usada (1..n)
  args.usedKeys.forEach((k, idx) => {
    const ordem = idx + 1;
    const file = args.altImg[k];
    if (file) fd.append(`resposta_imagem_${ordem}`, file);

    if (args.mode === "edit") {
      const remove = (args as EditArgs).removeAltImg[k];
      if (remove) fd.append(`remove_resposta_imagem_${ordem}`, "1");
    }
  });

  return fd;
}
