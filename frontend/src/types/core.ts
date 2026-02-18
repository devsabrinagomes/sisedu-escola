export type Disciplina = {
  id: number
  nome: string
}

export type Alternativa = "A" | "B" | "C" | "D" | "E"

export type Questao = {
  id: number
  disciplina: number
  disciplina_nome?: string
  enunciado_html: string
  alternativa_a: string
  alternativa_b: string
  alternativa_c: string
  alternativa_d: string
  alternativa_e: string
  alternativa_correta: Alternativa
  is_private: boolean
  criado_por?: string
  created_at: string
}
