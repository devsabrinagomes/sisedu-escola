export type HelpCategory =
  | "Primeiros passos"
  | "Questões"
  | "Cadernos"
  | "Ofertas"
  | "Gabaritos/Correção"
  | "Relatórios";

export type HelpItem = {
  id: string;
  categoria: HelpCategory;
  pergunta: string;
  principal?: boolean;
  passos: string[];
  dicas?: string[];
  errosComuns?: string[];
};

export const HELP_CONTENT: HelpItem[] = [
  {
    id: "inicio-acesso",
    categoria: "Primeiros passos",
    pergunta: "Como começar a usar o sistema?",
    principal: true,
    passos: [
      "Criar questões: cadastre as questões que serão usadas na avaliação.",
      "Montar o caderno: reúna as questões em um caderno de prova. O caderno representa a avaliação que será aplicada.",
      "Criar oferta: defina para qual turma e em qual período a avaliação será aplicada.",
      "Aplicar avaliação: antes da aplicação, baixe o caderno de prova (para impressão) e o cartão-resposta padrão. Esses arquivos estão disponíveis para download na listagem de cadernos e também na tela de detalhes do caderno. Oriente os alunos a preencher apenas o cartão-resposta padrão para permitir a correção.",
      "Registrar gabaritos: após a aplicação, registre as respostas dos alunos no sistema.",
      "Consultar relatórios: veja gráficos e resultados de desempenho por turma e por questão.",
    ],
    dicas: [
      "Você pode usar qualquer funcionalidade a qualquer momento, mas esta sequência é a forma recomendada de utilização do sistema.",
    ],
  },
  {
    id: "questoes-criar",
    categoria: "Questões",
    pergunta: "Como criar uma nova questão?",
    principal: true,
    passos: [
      "Acesse Questões e clique em Nova questão.",
      "Preencha classificação (disciplina, saber e habilidade).",
      "Informe enunciado, comando e alternativas.",
      "Marque a alternativa correta e salve.",
    ],
    errosComuns: [
      "Salvar sem marcar alternativa correta.",
      "Cadastrar alternativa vazia ou duplicada.",
    ],
  },
  {
    id: "questoes-caderno",
    categoria: "Questões",
    pergunta: "Como adicionar questão em um caderno?",
    passos: [
      "Na lista de questões, clique em Adicionar ao caderno.",
      "Escolha o caderno desejado no modal.",
      "Confirme em Adicionar.",
    ],
    dicas: ["Use a busca por código para localizar questões rapidamente."],
  },
  {
    id: "cadernos-montar",
    categoria: "Cadernos",
    pergunta: "Como montar um caderno de prova?",
    principal: true,
    passos: [
      "Acesse Cadernos e clique em Novo caderno.",
      "Defina o nome do caderno.",
      "Clique em Adicionar questões e selecione as versões desejadas.",
      "Reordene as questões e salve.",
    ],
    errosComuns: ["Não salvar após reordenar os itens."],
  },
  {
    id: "ofertas-criar",
    categoria: "Ofertas",
    pergunta: "Como criar uma oferta?",
    principal: true,
    passos: [
      "Acesse Ofertas e clique em Nova oferta.",
      "Preencha descrição, caderno e período.",
      "Selecione escola, série e turmas no SIGE.",
      "Salve a oferta.",
    ],
    dicas: ["Confirme as datas para evitar oferta fora do período."],
  },
  {
    id: "gabaritos-preencher",
    categoria: "Gabaritos/Correção",
    pergunta: "Como preencher e corrigir gabaritos?",
    principal: true,
    passos: [
      "Acesse Gabaritos e abra uma oferta com status Aberta.",
      "Selecione a turma e clique em Responder para o aluno.",
      "Marque as respostas e salve.",
      "Use o resumo para acompanhar acertos, erros e brancos.",
    ],
    errosComuns: [
      "Tentar preencher gabarito de oferta Encerrada.",
      "Não salvar antes de fechar o drawer.",
    ],
  },
  {
    id: "relatorios-gerar",
    categoria: "Relatórios",
    pergunta: "Como gerar relatórios por oferta e por turma?",
    principal: true,
    passos: [
      "Acesse Relatórios e filtre por escola, série e oferta.",
      "Clique em Gerar relatório.",
      "Use os cards por turma para detalhar desempenho.",
      "Exporte o arquivo quando necessário.",
    ],
    dicas: ["Aplique filtros antes de exportar para obter recortes mais úteis."],
  },
];

export const HELP_CATEGORIES: Array<"Tudo" | HelpCategory> = [
  "Tudo",
  "Primeiros passos",
  "Questões",
  "Cadernos",
  "Ofertas",
  "Gabaritos/Correção",
  "Relatórios",
];

export function searchHelpItem(item: HelpItem, term: string) {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) return true;
  const text = [
    item.categoria,
    item.pergunta,
    item.passos.join(" "),
    item.dicas?.join(" ") || "",
    item.errosComuns?.join(" ") || "",
  ]
    .join(" ")
    .toLowerCase();
  return text.includes(normalizedTerm);
}
