import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import PageCard from "@/components/layout/PageCard";
import Tabs from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/toast/useToast";
import SigeCombobox from "@/features/gabaritos/components/SigeCombobox";
import { listMockSigeSchoolClasses } from "@/features/gabaritos/services/gabaritos";
import {
  downloadReportItemsCsv,
  downloadReportStudentsCsv,
  getOfferReportSummary,
  getReportOffer,
} from "@/features/relatorios/services/reports";
import type {
  OfferDTO,
  ReportItemRowDTO,
  ReportStudentStatus,
  ReportSummaryDTO,
} from "@/features/relatorios/types";
import {
  formatDate,
  getBookletName,
  getOfferSigeSelection,
  getOfferStatus,
  getOfferStatusBadgeClass,
  getOfferStatusLabel,
  type OfferSigeSelection,
} from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

type Option = {
  value: number;
  label: string;
};

type TabValue = "overview" | "students" | "items" | "exports";
type StudentSelection =
  | { kind: "finalized"; label: string }
  | { kind: "not_finalized"; label: string }
  | { kind: "bucket"; range: string; label: string }
  | null;

function getStatusLabel(status: ReportStudentStatus) {
  if (status === "ABSENT") return "Ausente";
  if (status === "FINALIZED") return "Finalizado";
  if (status === "RECOGNIZED") return "Em andamento";
  return "Sem respostas";
}

function getStatusBadgeClass(status: ReportStudentStatus) {
  if (status === "ABSENT") return "bg-amber-50 text-amber-700 border border-amber-100";
  if (status === "FINALIZED") return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (status === "RECOGNIZED") return "bg-indigo-50 text-indigo-700 border border-indigo-100";
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function formatPct(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function parseBucketRange(range: string) {
  const match = String(range).match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function isInBucketRange(correctPct: number, range: string) {
  const parsed = parseBucketRange(range);
  if (!parsed) return false;
  if (parsed.max >= 100) return correctPct >= parsed.min && correctPct <= parsed.max;
  return correctPct >= parsed.min && correctPct < parsed.max;
}

export default function RelatorioOfertaDetalhe() {
  const { offerId } = useParams();
  const parsedOfferId = Number(offerId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const classRefFromQuery = Number(searchParams.get("class_ref") || "");
  const initialClassRef = Number.isFinite(classRefFromQuery) && classRefFromQuery > 0 ? classRefFromQuery : undefined;
  const classNameFromQuery = String(searchParams.get("class_name") || "").trim();
  const schoolRefFromQueryRaw = searchParams.get("school_ref");
  const serieFromQueryRaw = searchParams.get("serie");

  const [offer, setOffer] = useState<OfferDTO | null>(null);
  const [offerLoading, setOfferLoading] = useState(true);
  const [offerError, setOfferError] = useState("");
  const [sigeSelection, setSigeSelection] = useState<OfferSigeSelection | null>(null);

  const [filtersLoading, setFiltersLoading] = useState(false);
  const [schoolOptions, setSchoolOptions] = useState<Option[]>([]);
  const [classOptionsBySchool, setClassOptionsBySchool] = useState<Record<number, Option[]>>({});
  const [selectedSchoolRef, setSelectedSchoolRef] = useState<number | undefined>(undefined);
  const [selectedClassRef, setSelectedClassRef] = useState<number | undefined>(undefined);

  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [summary, setSummary] = useState<ReportSummaryDTO | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [studentSelection, setStudentSelection] = useState<StudentSelection>(null);
  const [downloading, setDownloading] = useState<"students" | "items" | null>(null);

  const classOptions = useMemo(() => {
    if (!selectedSchoolRef) return [];
    return classOptionsBySchool[selectedSchoolRef] || [];
  }, [classOptionsBySchool, selectedSchoolRef]);

  const selectedSchoolLabel = useMemo(
    () => schoolOptions.find((option) => option.value === selectedSchoolRef)?.label || "-",
    [schoolOptions, selectedSchoolRef],
  );
  const selectedClassLabel = useMemo(
    () => classOptions.find((option) => option.value === selectedClassRef)?.label || "-",
    [classOptions, selectedClassRef],
  );

  const topWrongItems = useMemo(() => {
    if (!summary) return [];
    return [...summary.items].sort((a, b) => b.wrong_pct - a.wrong_pct).slice(0, 5);
  }, [summary]);

  const presentCount = Math.max((summary?.students_total || 0) - (summary?.absent_count || 0), 0);

  useEffect(() => {
    if (!parsedOfferId) return;
    void loadOffer();
  }, [parsedOfferId]);

  useEffect(() => {
    if (!offer || filtersLoading) return;
    void loadSummary();
  }, [offer?.id, selectedClassRef, filtersLoading]);

  useEffect(() => {
    if (!selectedSchoolRef) {
      setSelectedClassRef(undefined);
      return;
    }
    const available = classOptionsBySchool[selectedSchoolRef] || [];
    if (available.length === 0) {
      setSelectedClassRef(undefined);
      return;
    }
    if (!available.some((option) => option.value === selectedClassRef)) {
      setSelectedClassRef(available[0].value);
    }
  }, [selectedSchoolRef, classOptionsBySchool]);

  async function loadOffer() {
    try {
      setOfferLoading(true);
      setOfferError("");
      const data = await getReportOffer(parsedOfferId);
      setOffer(data);

      const selection = getOfferSigeSelection(parsedOfferId);
      setSigeSelection(selection);
      await loadFilterOptions(selection);
    } catch {
      setOffer(null);
      setOfferError("Não foi possível carregar a oferta.");
    } finally {
      setOfferLoading(false);
    }
  }

  async function loadFilterOptions(selection: OfferSigeSelection | null) {
    const schoolRefs = Array.from(new Set((selection?.school_refs || []).filter(Number.isFinite)));
    const schoolNames = selection?.school_names || [];
    const allowedClassRefs = new Set((selection?.class_refs || []).filter(Number.isFinite));

    if (schoolRefs.length === 0) {
      setSchoolOptions([]);
      setClassOptionsBySchool({});
      setSelectedSchoolRef(undefined);
      setSelectedClassRef(undefined);
      return;
    }

    try {
      setFiltersLoading(true);
      const classesBySchool: Record<number, Option[]> = {};
      for (let index = 0; index < schoolRefs.length; index += 1) {
        const schoolRef = schoolRefs[index];
        const classes = await listMockSigeSchoolClasses(schoolRef);
        classesBySchool[schoolRef] = classes
          .filter((item) => allowedClassRefs.size === 0 || allowedClassRefs.has(item.class_ref))
          .map((item) => ({ value: item.class_ref, label: item.name }))
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
      }

      const schools = schoolRefs.map((schoolRef, index) => ({
        value: schoolRef,
        label: schoolNames[index] || `Escola ${schoolRef}`,
      }));

      setSchoolOptions(schools);
      setClassOptionsBySchool(classesBySchool);
      const initialSchool =
        initialClassRef !== undefined
          ? schools.find((school) =>
              (classesBySchool[school.value] || []).some((item) => item.value === initialClassRef),
            )?.value || schools[0]?.value
          : schools[0]?.value;
      setSelectedSchoolRef(initialSchool);
      const firstClass =
        initialSchool && initialClassRef !== undefined
          ? classesBySchool[initialSchool]?.some((item) => item.value === initialClassRef)
            ? initialClassRef
            : classesBySchool[initialSchool]?.[0]?.value
          : initialSchool
            ? classesBySchool[initialSchool]?.[0]?.value
            : undefined;
      setSelectedClassRef(firstClass);
    } catch (error: unknown) {
      setSchoolOptions([]);
      setClassOptionsBySchool({});
      setSelectedSchoolRef(undefined);
      setSelectedClassRef(undefined);
      toast({
        type: "error",
        title: "Erro ao carregar filtros",
        message: getApiErrorMessage(error),
      });
    } finally {
      setFiltersLoading(false);
    }
  }

  async function loadSummary() {
    if (!offer) return;
    try {
      setSummaryLoading(true);
      setSummaryError("");
      const data = await getOfferReportSummary(offer.id, selectedClassRef);
      setSummary(data);
      setStudentSelection(null);
    } catch (error: unknown) {
      setSummary(null);
      setSummaryError("Não foi possível carregar o relatório da oferta.");
      toast({
        type: "error",
        title: "Erro ao carregar relatório",
        message: getApiErrorMessage(error),
      });
    } finally {
      setSummaryLoading(false);
    }
  }

  async function onDownloadStudentsCsv() {
    if (!offer) return;
    try {
      setDownloading("students");
      await downloadReportStudentsCsv(offer.id, selectedClassRef);
      toast({ type: "success", title: "CSV por aluno baixado com sucesso" });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao baixar CSV por aluno",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDownloading(null);
    }
  }

  async function onDownloadItemsCsv() {
    if (!offer) return;
    try {
      setDownloading("items");
      await downloadReportItemsCsv(offer.id, selectedClassRef);
      toast({ type: "success", title: "CSV por questão baixado com sucesso" });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao baixar CSV por questão",
        message: getApiErrorMessage(error),
      });
    } finally {
      setDownloading(null);
    }
  }

  const offerStatus = offer ? getOfferStatus(offer) : "upcoming";

  const resolvedClassName =
    classNameFromQuery ||
    classOptions.find((option) => option.value === selectedClassRef)?.label ||
    (selectedClassRef ? `Turma ${selectedClassRef}` : "");

  const pageTitle = initialClassRef ? `Relatório da turma ${resolvedClassName}` : "Relatório da oferta";
  const pageSubtitle = initialClassRef
    ? "Acompanhe desempenho da turma selecionada."
    : "Acompanhe desempenho por turma, aluno e questão.";
  const offerReportSearchParams = new URLSearchParams();
  offerReportSearchParams.set("offer_id", String(parsedOfferId));
  if (schoolRefFromQueryRaw) {
    offerReportSearchParams.set("school_ref", schoolRefFromQueryRaw);
  }
  if (serieFromQueryRaw) {
    offerReportSearchParams.set("serie", serieFromQueryRaw);
  }
  const offerReportPath = `/relatorios?${offerReportSearchParams.toString()}`;
  const breadcrumbItems = initialClassRef
    ? [
        { label: "Relatórios", to: "/relatorios" },
        { label: "Relatório da oferta", to: offerReportPath },
        { label: "Relatório da turma" },
      ]
    : [
        { label: "Relatórios", to: "/relatorios" },
        { label: "Relatório da oferta" },
      ];
  const onBackTarget = initialClassRef ? offerReportPath : "/relatorios";
  const summaryTotals = summary?.totals || {
    students_total: summary?.students_total || 0,
    absent: summary?.absent_count || 0,
    finalized: summary?.finalized_count || 0,
    in_progress: summary?.in_progress_count || 0,
  };
  const nonFinalizedCount = Math.max(summaryTotals.students_total - summaryTotals.finalized, 0);
  const summaryStudentsBase = Math.max(summaryTotals.students_total, 1);
  const summaryFinalizedPct = (summaryTotals.finalized / summaryStudentsBase) * 100;
  const summaryNotFinalizedPct = (nonFinalizedCount / summaryStudentsBase) * 100;
  const accuracyBuckets =
    summary?.accuracy_buckets ||
    [
      { range: "0-25", pct_students: 0, count_students: 0 },
      { range: "25-50", pct_students: 0, count_students: 0 },
      { range: "50-75", pct_students: 0, count_students: 0 },
      { range: "75-100", pct_students: 0, count_students: 0 },
    ];
  const pieSize = 144;
  const pieRadius = 52;
  const pieStroke = 32;
  const pieCenter = pieSize / 2;
  const pieCircumference = 2 * Math.PI * pieRadius;
  const finalizedStroke = (summaryFinalizedPct / 100) * pieCircumference;
  const notFinalizedStroke = Math.max(pieCircumference - finalizedStroke, 0);
  const selectedStudents = useMemo(() => {
    if (!summary || !studentSelection) return [];
    if (studentSelection.kind === "finalized") {
      return summary.students.filter((student) => student.status === "FINALIZED");
    }
    if (studentSelection.kind === "not_finalized") {
      return summary.students.filter((student) => student.status !== "FINALIZED");
    }
    return summary.students.filter((student) => isInBucketRange(student.correct_pct, studentSelection.range));
  }, [summary, studentSelection]);
  const serieLabel = sigeSelection?.series_years?.length
    ? sigeSelection.series_years.map((value) => `${value}ª série`).join(", ")
    : "-";
  const headerRightSlot = initialClassRef ? (
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <Download className="h-4 w-4" />
        {downloading ? "Baixando..." : "Baixar"}
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <button
          type="button"
          onClick={() => void onDownloadStudentsCsv()}
          disabled={downloading !== null}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {downloading === "students" ? "Baixando..." : "CSV por aluno"}
        </button>
        <button
          type="button"
          onClick={() => void onDownloadItemsCsv()}
          disabled={downloading !== null}
          className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {downloading === "items" ? "Baixando..." : "CSV por questão"}
        </button>
      </div>
    </details>
  ) : null;

  return (
    <PageCard
      breadcrumb={breadcrumbItems}
      title={pageTitle}
      subtitle={pageSubtitle}
      onBack={() => navigate(onBackTarget)}
      rightSlot={headerRightSlot}
    >
      {offerLoading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : offerError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {offerError}
        </div>
      ) : offer ? (
        <div className="space-y-6">
          {!initialClassRef ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="text-xs font-semibold text-slate-700">Resumo da oferta</div>
              </div>
              <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Oferta</div>
                  <div className="mt-1 text-sm text-slate-800">{offer.description?.trim() || `Oferta #${offer.id}`}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Caderno</div>
                  <div className="mt-1 text-sm text-slate-800">
                    <Link
                      to={`/cadernos/${typeof offer.booklet === "number" ? offer.booklet : offer.booklet.id}`}
                      className="hover:text-emerald-700 hover:underline"
                    >
                      {getBookletName(offer)}
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Período</div>
                  <div className="mt-1 text-sm text-slate-800">
                    {formatDate(offer.start_date)} - {formatDate(offer.end_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Status</div>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getOfferStatusBadgeClass(offerStatus)}`}
                  >
                    {getOfferStatusLabel(offerStatus)}
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                Quantidade de questões: <span className="font-semibold">{summary?.items_total ?? "-"}</span>
              </div>
            </div>
          ) : null}

          {!initialClassRef ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">Filtros</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SigeCombobox
                  label="Escola"
                  placeholder="Selecione a escola"
                  value={selectedSchoolRef}
                  options={schoolOptions}
                  loading={filtersLoading}
                  onChange={(nextSchoolRef) => setSelectedSchoolRef(nextSchoolRef)}
                  emptyText="Nenhuma escola disponível para esta oferta."
                />
                <SigeCombobox
                  label="Turma"
                  placeholder="Selecione uma turma"
                  value={selectedClassRef}
                  options={classOptions}
                  loading={filtersLoading}
                  disabled={!selectedSchoolRef}
                  onChange={(nextClassRef) => setSelectedClassRef(nextClassRef)}
                  emptyText="Nenhuma turma disponível para esta escola."
                />
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Escola selecionada: <span className="font-medium text-slate-700">{selectedSchoolLabel}</span>
                {" | "}
                Turma selecionada: <span className="font-medium text-slate-700">{selectedClassLabel}</span>
              </div>
            </div>
          ) : null}

          {summaryError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {summaryError}
            </div>
          )}

          {summaryLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
              Carregando relatório...
            </div>
          ) : summary ? (
            <>
              {initialClassRef ? (
                <>
                  <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2 sm:gap-x-6">
                      <div>
                        <span className="font-semibold text-slate-900">Escola: </span>
                        {selectedSchoolLabel}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Série: </span>
                        {serieLabel}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Oferta: </span>
                        {offer.description?.trim() || `Oferta #${offer.id}`}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Caderno: </span>
                        {getBookletName(offer)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Período: </span>
                        {formatDate(offer.start_date)} - {formatDate(offer.end_date)}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                      <div className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-900">
                          Percentual de alunos que finalizaram o teste
                        </div>
                        <div className="flex flex-col items-center gap-3">
                          <svg viewBox={`0 0 ${pieSize} ${pieSize}`} className="h-36 w-36">
                            <circle cx={pieCenter} cy={pieCenter} r={pieRadius} fill="none" stroke="#e2e8f0" strokeWidth={pieStroke} />
                            <circle
                              cx={pieCenter}
                              cy={pieCenter}
                              r={pieRadius}
                              fill="none"
                              stroke="var(--blue-fill)"
                              strokeWidth={pieStroke}
                              strokeDasharray={`${finalizedStroke} ${pieCircumference}`}
                              strokeDashoffset={0}
                              transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                              className="cursor-pointer"
                              onClick={() => setStudentSelection({ kind: "finalized", label: "Finalizaram" })}
                            />
                            <circle
                              cx={pieCenter}
                              cy={pieCenter}
                              r={pieRadius}
                              fill="none"
                              stroke="var(--red-fill)"
                              strokeWidth={pieStroke}
                              strokeDasharray={`${notFinalizedStroke} ${pieCircumference}`}
                              strokeDashoffset={-finalizedStroke}
                              transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                              className="cursor-pointer"
                              onClick={() => setStudentSelection({ kind: "not_finalized", label: "Não finalizaram" })}
                            />
                            <circle cx={pieCenter} cy={pieCenter} r={18} fill="white" />
                          </svg>
                          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                            <button
                              type="button"
                              onClick={() => setStudentSelection({ kind: "finalized", label: "Finalizaram" })}
                              className="inline-flex items-center gap-2 text-slate-700 hover:underline"
                            >
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: "var(--blue-fill)", border: "1px solid var(--blue-stroke)" }}
                              />
                              Finalizaram: {formatPct(summaryFinalizedPct)} ({summaryTotals.finalized})
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentSelection({ kind: "not_finalized", label: "Não finalizaram" })}
                              className="inline-flex items-center gap-2 text-slate-700 hover:underline"
                            >
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: "var(--red-fill)", border: "1px solid var(--red-stroke)" }}
                              />
                              Não finalizaram: {formatPct(summaryNotFinalizedPct)} ({nonFinalizedCount})
                            </button>
                          </div>
                          <div className="text-xs text-slate-500">Clique no gráfico para ver a lista de alunos.</div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-900">
                          Percentual de alunos por faixa de acerto
                        </div>
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="w-full table-auto border-collapse">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Percentual de acerto</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Percentual de alunos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accuracyBuckets.map((bucket, index) => {
                                const bucketColor =
                                  index === 0
                                    ? { fill: "var(--red-fill)", stroke: "var(--red-stroke)" }
                                    : index === 1
                                      ? { fill: "var(--yellow-fill)", stroke: "var(--yellow-stroke)" }
                                      : index === 2
                                        ? { fill: "var(--green-fill)", stroke: "var(--green-stroke)" }
                                        : { fill: "var(--blue-fill)", stroke: "var(--blue-stroke)" };
                                return (
                                  <tr
                                    key={bucket.range}
                                    style={{ backgroundColor: bucketColor.fill }}
                                    className="cursor-pointer hover:brightness-95"
                                    onClick={() =>
                                      setStudentSelection({
                                        kind: "bucket",
                                        range: bucket.range,
                                        label: `Faixa ${bucket.range}%`,
                                      })
                                    }
                                  >
                                    <td
                                      className="px-4 py-3 text-sm font-medium text-slate-800"
                                      style={{ borderTop: `1px solid ${bucketColor.stroke}` }}
                                    >
                                      {bucket.range}%
                                    </td>
                                    <td
                                      className="px-4 py-3 text-sm font-semibold text-slate-800"
                                      style={{ borderTop: `1px solid ${bucketColor.stroke}` }}
                                    >
                                      {formatPct(bucket.pct_students)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                          Clique na tabela para ver a lista de alunos.
                        </div>
                      </div>
                  </div>
                  {studentSelection ? (
                    <div className="mt-4 rounded-lg border border-slate-200 p-4">
                      <div className="mb-3 text-sm font-semibold text-slate-900">
                        Alunos relacionados: {studentSelection.label}
                      </div>
                      {selectedStudents.length === 0 ? (
                        <div className="text-sm text-slate-500">Nenhum aluno encontrado para este recorte.</div>
                      ) : (
                        <div className="overflow-auto">
                          <table className="w-full table-auto border-collapse">
                            <thead className="border-b border-slate-200 bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Aluno</th>
                                <th className="w-28 px-3 py-2 text-left text-xs font-semibold text-slate-600">% acerto</th>
                                <th className="w-40 px-3 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedStudents.map((row) => (
                                <tr key={`${row.class_ref}-${row.student_ref}`} className="border-t border-slate-100">
                                  <td className="px-3 py-2 text-sm text-slate-800">{row.name}</td>
                                  <td className="px-3 py-2 text-sm text-slate-700">{formatPct(row.correct_pct)}</td>
                                  <td className="px-3 py-2 text-sm text-slate-700">
                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(row.status)}`}>
                                      {getStatusLabel(row.status)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}

              {!initialClassRef ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-slate-600">Total alunos</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{summary.students_total}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-slate-600">Presentes / Ausentes</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {presentCount} / {summary.absent_count}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-slate-600">Finalizados / Em andamento</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {summary.finalized_count} / {summary.in_progress_count}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-slate-600">Média de acertos</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{summary.avg_correct.toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-slate-600">% acerto</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">{formatPct(summary.avg_correct_pct)}</div>
                  </div>
                </div>
              ) : null}

              {!initialClassRef ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                  <Tabs<TabValue>
                    tabs={[
                      { value: "overview", label: "Visão geral" },
                      { value: "students", label: "Por aluno", count: summary.students.length },
                      { value: "items", label: "Por questão", count: summary.items.length },
                      { value: "exports", label: "Exportações" },
                    ]}
                    active={activeTab}
                    onChange={setActiveTab}
                  />

                {activeTab === "overview" ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        Distribuição de acertos
                      </div>
                      {summary.distribution.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500">Sem dados de distribuição.</div>
                      ) : (
                        <table className="w-full table-auto border-collapse">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">Acertos</th>
                              <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">Alunos</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Distribuição</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.distribution.map((bucket) => {
                              const maxCount = Math.max(...summary.distribution.map((item) => item.count), 1);
                              const widthPct = (bucket.count / maxCount) * 100;
                              return (
                                <tr key={bucket.correct} className="border-t border-slate-100">
                                  <td className="px-4 py-3 text-sm text-slate-700">{bucket.correct}</td>
                                  <td className="px-4 py-3 text-sm text-slate-700">{bucket.count}</td>
                                  <td className="px-4 py-3">
                                    <div className="h-2 rounded bg-slate-100">
                                      <div
                                        className="h-2 rounded"
                                        style={{
                                          width: `${widthPct}%`,
                                          backgroundColor: "var(--blue-fill)",
                                          border: "1px solid var(--blue-stroke)",
                                        }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
                        Top 5 questões mais erradas
                      </div>
                      {topWrongItems.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-slate-500">Sem dados por questão.</div>
                      ) : (
                        <table className="w-full table-auto border-collapse">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="w-24 px-4 py-3 text-left text-xs font-semibold text-slate-600">Questão</th>
                              <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-slate-600">% erro</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Comparativo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topWrongItems.map((item) => (
                              <tr key={item.booklet_item_id} className="border-t border-slate-100">
                                <td className="px-4 py-3 text-sm text-slate-700">{item.order}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{formatPct(item.wrong_pct)}</td>
                                <td className="px-4 py-3">
                                  <div className="h-2 rounded bg-slate-100">
                                    <div
                                      className="h-2 rounded"
                                      style={{
                                        width: `${Math.min(item.wrong_pct, 100)}%`,
                                        backgroundColor: "var(--red-fill)",
                                        border: "1px solid var(--red-stroke)",
                                      }}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeTab === "students" ? (
                  summary.students.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 px-4 py-6 text-sm text-slate-500">
                      Nenhum aluno encontrado para o filtro selecionado.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full table-auto border-collapse">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Aluno</th>
                            <th className="w-44 px-4 py-3 text-left text-xs font-semibold text-slate-600">Acertos/Erros/Brancos/Total</th>
                            <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">% acerto</th>
                            <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                            <th className="w-32 px-4 py-3 text-left text-xs font-semibold text-slate-600">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.students.map((row) => (
                            <tr key={`${row.class_ref}-${row.student_ref}`} className="border-t border-slate-100">
                              <td className="px-4 py-3 text-sm text-slate-800">{row.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                {row.correct}/{row.wrong}/{row.blank}/{row.total}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700">{formatPct(row.correct_pct)}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(row.status)}`}>
                                  {getStatusLabel(row.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                <button
                                  type="button"
                                  disabled
                                  title="Detalhamento em breve"
                                  className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
                                >
                                  Detalhar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}

                {activeTab === "items" ? (
                  summary.items.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 px-4 py-6 text-sm text-slate-500">
                      Nenhuma questão encontrada para o filtro selecionado.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full table-auto border-collapse">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="w-24 px-4 py-3 text-left text-xs font-semibold text-slate-600">Questão</th>
                            <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">% acerto</th>
                            <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">% erro</th>
                            <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">% branco</th>
                            <th className="w-40 px-4 py-3 text-left text-xs font-semibold text-slate-600">Alternativa mais marcada</th>
                            <th className="w-28 px-4 py-3 text-left text-xs font-semibold text-slate-600">Total respondidas</th>
                            <th className="w-36 px-4 py-3 text-left text-xs font-semibold text-slate-600">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.items.map((row: ReportItemRowDTO) => (
                            <tr key={row.booklet_item_id} className="border-t border-slate-100">
                              <td className="px-4 py-3 text-sm text-slate-800">{row.order}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{formatPct(row.correct_pct)}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{formatPct(row.wrong_pct)}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{formatPct(row.blank_pct)}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{row.most_marked_option || "-"}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">{row.total_answered}</td>
                              <td className="px-4 py-3 text-sm text-slate-700">
                                <Link
                                  to={`/questoes/${row.question_id}`}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Ver questão
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : null}

                {activeTab === "exports" ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-semibold text-slate-900">Exportações</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void onDownloadStudentsCsv()}
                        disabled={downloading !== null}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloading === "students" ? "Baixando..." : "Baixar CSV (por aluno)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDownloadItemsCsv()}
                        disabled={downloading !== null}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloading === "items" ? "Baixando..." : "Baixar CSV (por questão)"}
                      </button>
                    </div>
                  </div>
                ) : null}
                </div>
              ) : null}

              {!initialClassRef && summary.students_total === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Não há aplicações para a turma selecionada.
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </PageCard>
  );
}
