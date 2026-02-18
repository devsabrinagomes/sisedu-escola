import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "@/lib/api"
import type { Questao } from "@/types/core"

export default function QuestaoDetalhe() {
  const { id } = useParams()
  const [item, setItem] = useState<Questao | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await api.get<Questao>(`/questoes/${id}/`)
      setItem(data)
      setLoading(false)
    })()
  }, [id])

  if (loading) return <div className="text-sm text-slate-500 dark:text-slate-400">Carregando…</div>
  if (!item) return <div className="text-sm text-slate-500 dark:text-slate-400">Não encontrado.</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Detalhes da questão</h1>
        <Link
          to="/questoes"
          className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Voltar
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-white/5 p-6 space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <b>Disciplina:</b> {item.disciplina_nome ?? item.disciplina} &nbsp;•&nbsp;
          <b>Correta:</b> {item.alternativa_correta} &nbsp;•&nbsp;
          <b>Criado por:</b> {item.criado_por ?? "-"}
        </div>

        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Enunciado</div>
          <div
            className="prose max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: item.enunciado_html || "" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3"><b>A)</b> {item.alternativa_a}</div>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3"><b>B)</b> {item.alternativa_b}</div>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3"><b>C)</b> {item.alternativa_c}</div>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3"><b>D)</b> {item.alternativa_d}</div>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3 md:col-span-2"><b>E)</b> {item.alternativa_e}</div>
        </div>
      </div>
    </div>
  )
}
