import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageCard from "@/components/layout/PageCard";
import { useToast } from "@/components/ui/toast/useToast";
import { getReportOffer, getReportsByClass } from "@/features/relatorios/services/reports";
import type { OfferDTO, ReportByClassRowDTO } from "@/features/relatorios/types";
import { getBookletName } from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

function formatPct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export default function RelatorioTurmasList() {
  const { id } = useParams();
  const offerId = Number(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offer, setOffer] = useState<OfferDTO | null>(null);
  const [rows, setRows] = useState<ReportByClassRowDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!offerId) return;
    void loadData();
  }, [offerId]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [offerData, rowsData] = await Promise.all([
        getReportOffer(offerId),
        getReportsByClass(offerId),
      ]);
      setOffer(offerData);
      setRows(rowsData);
    } catch (err: unknown) {
      setError("Não foi possível carregar os relatórios por turma.");
      toast({
        type: "error",
        title: "Erro ao carregar turmas",
        message: getApiErrorMessage(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageCard
      breadcrumb={[
        { label: "Relatórios", to: "/relatorios" },
        { label: "Turmas" },
      ]}
      title="Relatórios por turma"
      subtitle={offer ? `${offer.description || `Oferta #${offer.id}`} • ${getBookletName(offer)}` : "Resumo por turma da oferta"}
      onBack={() => navigate("/relatorios")}
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
          Carregando turmas...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.class_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">{row.class_name}</div>
              <div className="space-y-3 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo</div>
                <div className="text-sm text-slate-700">
                  Total de alunos avaliados:{" "}
                  <span className="font-semibold text-slate-900">{row.total_students}</span>
                </div>
                <div className="text-sm text-slate-700">
                  Percentual de acerto:{" "}
                  <span className="font-semibold text-slate-900">{formatPct(row.accuracy_percent)}</span>
                </div>
                {row.absent_count > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {row.absent_count} aluno(s) sem respostas ({formatPct(row.absent_percent)}).
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/relatorios/ofertas/${offerId}?class_ref=${row.class_id}&class_name=${encodeURIComponent(row.class_name)}`,
                    )
                  }
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Acessar
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Nenhuma turma vinculada a esta oferta.
            </div>
          ) : null}
        </div>
      )}
    </PageCard>
  );
}
