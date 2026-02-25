import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import SigeCombobox from "@/features/gabaritos/components/SigeCombobox";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import { listMockSigeSchoolClasses, listMockSigeSchools } from "@/features/gabaritos/services/gabaritos";
import {
  downloadReportItemsCsv,
  downloadReportStudentsCsv,
  getOfferReportSummary,
  getReportsByClass,
  getReportsOverview,
  listReportOffers,
} from "@/features/relatorios/services/reports";
import type {
  OfferDTO,
  OfferFilters,
  ReportByClassRowDTO,
  ReportsOverviewDTO,
  ReportSummaryDTO,
  ReportStudentRowDTO,
} from "@/features/relatorios/types";
import {
  formatPct,
  getReportStudentStatusBadgeClass,
  getReportStudentStatusLabel,
  isInBucketRange,
} from "@/features/relatorios/utils";
import { formatDate, getBookletName, getOfferSigeSelection } from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import { useToast } from "@/components/ui/toast/useToast";

type Option = {
  value: number;
  label: string;
};

type ClassRow = {
  class_ref: number;
  name: string;
  year: number;
  serie?: string | null;
};

type LoadedFilters = {
  schoolLabel: string;
  serieLabel: string;
  offer: OfferDTO;
  schoolRef?: number;
  serie?: number;
};

function extractSerie(value: string | null | undefined) {
  const text = String(value || "");
  const match = text.match(/(\d+)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

type StudentSelection =
  | { kind: "finalized"; label: string }
  | { kind: "not_finalized"; label: string }
  | { kind: "bucket"; range: string; label: string }
  | null;

export default function RelatoriosList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [overview, setOverview] = useState<ReportsOverviewDTO | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  const [schools, setSchools] = useState<Option[]>([]);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [classesBySchool, setClassesBySchool] = useState<Record<number, ClassRow[]>>({});
  const [seriesBySchool, setSeriesBySchool] = useState<Record<number, Option[]>>({});

  const [offers, setOffers] = useState<OfferDTO[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);

  const [selectedSchoolRef, setSelectedSchoolRef] = useState<number | undefined>(undefined);
  const [selectedSerie, setSelectedSerie] = useState<number | undefined>(undefined);
  const [selectedOfferId, setSelectedOfferId] = useState<number | undefined>(undefined);

  const [loadedFilters, setLoadedFilters] = useState<LoadedFilters | null>(null);
  const [summary, setSummary] = useState<ReportSummaryDTO | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [classReports, setClassReports] = useState<ReportByClassRowDTO[]>([]);
  const [studentSelection, setStudentSelection] = useState<StudentSelection>(null);
  const [downloading, setDownloading] = useState<"students" | "items" | null>(null);
  const showSummaryLoading = useDelayedLoading(summaryLoading);
  const showOverviewLoading = useDelayedLoading(overviewLoading);
  const selectedStudentsCardRef = useRef<HTMLDivElement | null>(null);
  const classReportsSectionRef = useRef<HTMLDivElement | null>(null);
  const initializedFromQueryRef = useRef(false);

  useEffect(() => {
    void loadOverview();
    void loadFilterOptions();
  }, []);

  useEffect(() => {
    if (initializedFromQueryRef.current) return;
    if (offersLoading || schoolLoading) return;
    const offerIdRaw = searchParams.get("offer_id");
    if (!offerIdRaw) {
      initializedFromQueryRef.current = true;
      return;
    }

    const offerId = Number(offerIdRaw);
    if (!Number.isFinite(offerId) || offerId <= 0) {
      initializedFromQueryRef.current = true;
      return;
    }

    const schoolRefRaw = searchParams.get("school_ref");
    const serieRaw = searchParams.get("serie");
    const schoolRef =
      schoolRefRaw && Number.isFinite(Number(schoolRefRaw)) && Number(schoolRefRaw) > 0
        ? Number(schoolRefRaw)
        : undefined;
    const serie =
      serieRaw && Number.isFinite(Number(serieRaw)) && Number(serieRaw) > 0 ? Number(serieRaw) : undefined;

    const applyFromQuery = async () => {
      if (schoolRef) {
        await onChangeSchool(schoolRef);
      } else {
        setSelectedSchoolRef(undefined);
      }
      setSelectedSerie(serie);
      setSelectedOfferId(offerId);
      await onLoadReport(offerId, { schoolRef, serie });
    };

    initializedFromQueryRef.current = true;
    void applyFromQuery();
  }, [offersLoading, schoolLoading, searchParams]);

  useEffect(() => {
    if (!studentSelection) return;
    const handle = window.setTimeout(() => {
      selectedStudentsCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [studentSelection]);

  async function loadOverview() {
    try {
      setOverviewLoading(true);
      setOverviewError("");
      const data = await getReportsOverview();
      setOverview(data);
    } catch (error: unknown) {
      setOverview(null);
      setOverviewError("Não foi possível carregar a visão geral de relatórios.");
      toast({
        type: "error",
        title: "Erro ao carregar visão geral",
        message: getApiErrorMessage(error),
      });
    } finally {
      setOverviewLoading(false);
    }
  }

  async function loadAllOffersForUser(filters?: OfferFilters) {
    const result: OfferDTO[] = [];
    let page = 1;
    while (page < 100) {
      const data = await listReportOffers({ ...(filters || {}), page });
      result.push(...data.results);
      if (!data.next) break;
      page += 1;
    }
    return result.filter((offer) => !offer.deleted && Number(offer.created_by) === Number(userId));
  }

  async function loadFilterOptions() {
    try {
      setSchoolLoading(true);
      setOffersLoading(true);
      const [schoolsData, offersData] = await Promise.all([
        listMockSigeSchools(),
        loadAllOffersForUser({ status: "all" }),
      ]);
      setSchools(
        schoolsData
          .map((school) => ({ value: school.school_ref, label: school.name }))
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      );
      setOffers(offersData);
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao carregar filtros",
        message: getApiErrorMessage(error),
      });
    } finally {
      setSchoolLoading(false);
      setOffersLoading(false);
    }
  }

  async function ensureClassesAndSeries(schoolRef: number) {
    if (classesBySchool[schoolRef]) return;
    const rows = await listMockSigeSchoolClasses(schoolRef);
    const normalized = rows.map((row) => ({
      class_ref: row.class_ref,
      name: row.name,
      year: row.year,
      serie: "serie" in row ? String((row as { serie?: string | null }).serie || "") : null,
    }));
    const seriesMap = new Map<number, Option>();
    for (const row of normalized) {
      const serieFromName = extractSerie(row.name);
      const serieFromField = extractSerie(row.serie);
      const serie = serieFromField ?? serieFromName;
      if (!serie) continue;
      seriesMap.set(serie, { value: serie, label: `${serie}ª série` });
    }
    setClassesBySchool((prev) => ({ ...prev, [schoolRef]: normalized }));
    setSeriesBySchool((prev) => ({
      ...prev,
      [schoolRef]: [...seriesMap.values()].sort((a, b) => a.value - b.value),
    }));
  }

  const filteredOfferOptions = useMemo(() => {
    const selectedSchool = selectedSchoolRef;
    const selectedSerieValue = selectedSerie;
    return offers
      .filter((offer) => {
        const selection = getOfferSigeSelection(offer.id);
        if (selectedSchool && selection?.school_refs?.length) {
          if (!selection.school_refs.includes(selectedSchool)) return false;
        }
        if (selectedSerieValue && selection?.series_years?.length) {
          if (!selection.series_years.includes(selectedSerieValue)) return false;
        }
        return true;
      })
      .map((offer) => ({
        value: offer.id,
        label: `${offer.description?.trim() || `Oferta #${offer.id}`} • ${getBookletName(offer)}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [offers, selectedSchoolRef, selectedSerie]);

  const seriesOptions = useMemo(() => {
    if (!selectedSchoolRef) return [];
    return seriesBySchool[selectedSchoolRef] || [];
  }, [selectedSchoolRef, seriesBySchool]);

  async function onChangeSchool(nextSchoolRef: number | undefined) {
    setSelectedSchoolRef(nextSchoolRef);
    setSelectedSerie(undefined);
    setSelectedOfferId(undefined);
    if (nextSchoolRef) {
      try {
        await ensureClassesAndSeries(nextSchoolRef);
      } catch (error: unknown) {
        toast({
          type: "error",
          title: "Erro ao carregar séries",
          message: getApiErrorMessage(error),
        });
      }
    }
  }

  function onChangeSerie(nextSerie: number | undefined) {
    setSelectedSerie(nextSerie);
    setSelectedOfferId(undefined);
  }

  async function onLoadReport(
    nextOfferId?: number,
    overrides?: { schoolRef?: number; serie?: number },
  ) {
    const offerId = nextOfferId ?? selectedOfferId;
    if (!offerId) {
      toast({
        type: "warning",
        title: "Selecione uma oferta",
      });
      return;
    }

    const offer = offers.find((item) => item.id === offerId);
    if (!offer) {
      toast({
        type: "error",
        title: "Oferta não encontrada",
      });
      return;
    }

    const effectiveSchoolRef = overrides?.schoolRef ?? selectedSchoolRef;
    const effectiveSerie = overrides?.serie ?? selectedSerie;
    const schoolLabel =
      schools.find((school) => school.value === effectiveSchoolRef)?.label || "Todas";
    const serieLabel =
      (effectiveSchoolRef ? seriesBySchool[effectiveSchoolRef] || [] : seriesOptions).find(
        (serie) => serie.value === effectiveSerie,
      )?.label || "Todas";

    try {
      setSummaryLoading(true);
      setSummaryError("");
      const [summaryData, byClassData] = await Promise.all([
        getOfferReportSummary(offer.id, {
          schoolRef: effectiveSchoolRef,
          serie: effectiveSerie,
        }),
        getReportsByClass(offer.id, {
          schoolRef: effectiveSchoolRef,
          serie: effectiveSerie,
        }),
      ]);
      setSummary(summaryData);
      setClassReports(byClassData);
      setStudentSelection(null);
      setLoadedFilters({
        schoolLabel,
        serieLabel,
        offer,
        schoolRef: effectiveSchoolRef,
        serie: effectiveSerie,
      });
    } catch (error: unknown) {
      setSummary(null);
      setClassReports([]);
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

  function onClearFilters() {
    setSelectedSchoolRef(undefined);
    setSelectedSerie(undefined);
    setSelectedOfferId(undefined);
    setSummary(null);
    setClassReports([]);
    setSummaryError("");
    setLoadedFilters(null);
    setStudentSelection(null);
  }

  async function onDownloadStudentsCsv() {
    if (!loadedFilters) return;
    try {
      setDownloading("students");
      await downloadReportStudentsCsv(loadedFilters.offer.id, {
        schoolRef: loadedFilters.schoolRef,
        serie: loadedFilters.serie,
      });
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
    if (!loadedFilters) return;
    try {
      setDownloading("items");
      await downloadReportItemsCsv(loadedFilters.offer.id, {
        schoolRef: loadedFilters.schoolRef,
        serie: loadedFilters.serie,
      });
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

  const overviewApplicationsTotal = overview?.applications_total || 0;
  const overviewFinalized = overview?.finalized_total || 0;
  const overviewAbsent = overview?.absent_total || 0;
  const overviewInProgress = Math.max(
    overviewApplicationsTotal - overviewFinalized - overviewAbsent,
    0,
  );
  const chartPalette = [
    { fill: "var(--red-fill)", stroke: "var(--red-stroke)" },
    { fill: "var(--yellow-fill)", stroke: "var(--yellow-stroke)" },
    { fill: "var(--blue-fill)", stroke: "var(--blue-stroke)" },
    { fill: "var(--green-fill)", stroke: "var(--green-stroke)" },
  ] as const;
  const pieDenominator = Math.max(overviewApplicationsTotal, 1);
  const pieFinalizedPct = (overviewFinalized / pieDenominator) * 100;
  const pieInProgressPct = (overviewInProgress / pieDenominator) * 100;
  const pieAbsentPct = (overviewAbsent / pieDenominator) * 100;
  const overviewBars = overview?.accuracy_buckets_overall || [];
  const pieSize = 144;
  const pieRadius = 52;
  const pieStroke = 32;
  const pieBorderWidth = 1;
  const pieInnerStroke = Math.max(pieStroke - pieBorderWidth * 2, 1);
  const pieCenter = pieSize / 2;
  const pieCircumference = 2 * Math.PI * pieRadius;
  const finalizedStroke = (summaryFinalizedPct / 100) * pieCircumference;
  const notFinalizedStroke = Math.max(pieCircumference - finalizedStroke, 0);
  const overviewFinalizedStroke = (pieFinalizedPct / 100) * pieCircumference;
  const overviewInProgressStroke = (pieInProgressPct / 100) * pieCircumference;
  const overviewAbsentStroke = Math.max(pieCircumference - overviewFinalizedStroke - overviewInProgressStroke, 0);

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

  const classReportsDisplay = useMemo(() => {
    if (!loadedFilters) return classReports;
    const byId = new Map<number, ReportByClassRowDTO>();
    for (const row of classReports) {
      byId.set(Number(row.class_id), row);
    }

    const selection = getOfferSigeSelection(loadedFilters.offer.id);
    const classRefs = (selection?.class_refs || []).filter((value) => Number.isFinite(value));
    const classNames = selection?.class_names || [];
    for (let index = 0; index < classRefs.length; index += 1) {
      const classId = Number(classRefs[index]);
      if (byId.has(classId)) continue;
      byId.set(classId, {
        class_id: classId,
        class_name: classNames[index] || `Turma ${classId}`,
        total_students: 0,
        accuracy_percent: 0,
        absent_count: 0,
        absent_percent: 0,
      });
    }

    return Array.from(byId.values()).sort((a, b) =>
      String(a.class_name || "").localeCompare(String(b.class_name || ""), "pt-BR"),
    );
  }, [classReports, loadedFilters]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-5 shadow-sm">
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100">Relatórios</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-300">Acompanhe indicadores e resultados das ofertas.</p>
        </div>
        <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Filtros</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <SigeCombobox
                label="Escola"
                placeholder="Selecione uma escola"
                value={selectedSchoolRef}
                options={schools}
                loading={schoolLoading}
                onChange={(value) => void onChangeSchool(value)}
                emptyText="Nenhuma escola encontrada."
              />
            </div>
            <div className="min-w-0">
              <SigeCombobox
                label="Série"
                placeholder="Selecione uma série"
                value={selectedSerie}
                options={seriesOptions}
                disabled={!selectedSchoolRef}
                onChange={onChangeSerie}
                emptyText="Nenhuma série encontrada para a escola."
              />
            </div>
            <div className="min-w-0">
              <SigeCombobox
                label="Oferta"
                placeholder="Selecione uma oferta"
                value={selectedOfferId}
                options={filteredOfferOptions}
                loading={offersLoading}
                onChange={setSelectedOfferId}
                emptyText="Nenhuma oferta encontrada para os filtros."
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onLoadReport()}
              className="inline-flex items-center gap-2 rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
              disabled={summaryLoading}
            >
              {summaryLoading && showSummaryLoading ? <EqualizerLoader size={16} /> : null}
              Carregar relatórios
            </button>
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2"
            >
              Limpar
            </button>
          </div>
      </div>

      {loadedFilters ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-borderDark pb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Relatório da oferta</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    classReportsSectionRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className="inline-flex items-center rounded-lg btn-primary px-3 py-2 text-sm font-semibold"
                >
                  Ver por turmas
                </button>
                <details className="relative">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2">
                    <Download className="h-4 w-4" />
                    Baixar
                  </summary>
                  <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => void onDownloadStudentsCsv()}
                      disabled={downloading !== null}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2 disabled:opacity-60"
                    >
                      {downloading === "students" ? "Baixando..." : "CSV por aluno"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDownloadItemsCsv()}
                      disabled={downloading !== null}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2 disabled:opacity-60"
                    >
                      {downloading === "items" ? "Baixando..." : "CSV por questão"}
                    </button>
                  </div>
                </details>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2 sm:gap-x-6">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Escola: </span>
                {loadedFilters.schoolLabel}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Série: </span>
                {loadedFilters.serieLabel}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Oferta: </span>
                {loadedFilters.offer.description?.trim() || `Oferta #${loadedFilters.offer.id}`}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Caderno: </span>
                {getBookletName(loadedFilters.offer)}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Período: </span>
                {formatDate(loadedFilters.offer.start_date)} - {formatDate(loadedFilters.offer.end_date)}
              </div>
            </div>
            {summary ? (
              <div className="mt-4 border-t border-slate-100 dark:border-borderDark pt-4">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-4">
                    <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Percentual de alunos que finalizaram o teste
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <svg viewBox={`0 0 ${pieSize} ${pieSize}`} className="h-36 w-36">
                        <circle
                          cx={pieCenter}
                          cy={pieCenter}
                          r={pieRadius}
                          fill="none"
                          stroke="var(--chart-border)"
                          strokeWidth={pieStroke}
                        />
                        <circle
                          cx={pieCenter}
                          cy={pieCenter}
                          r={pieRadius}
                          fill="none"
                          stroke="var(--blue-stroke)"
                          strokeWidth={pieStroke}
                          strokeDasharray={`${finalizedStroke} ${pieCircumference}`}
                          strokeDashoffset={0}
                          transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                        />
                        <circle
                          cx={pieCenter}
                          cy={pieCenter}
                          r={pieRadius}
                          fill="none"
                          stroke="var(--blue-fill)"
                          strokeWidth={pieInnerStroke}
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
                          stroke="var(--red-stroke)"
                          strokeWidth={pieStroke}
                          strokeDasharray={`${notFinalizedStroke} ${pieCircumference}`}
                          strokeDashoffset={-finalizedStroke}
                          transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                        />
                        <circle
                          cx={pieCenter}
                          cy={pieCenter}
                          r={pieRadius}
                          fill="none"
                          stroke="var(--red-fill)"
                          strokeWidth={pieInnerStroke}
                          strokeDasharray={`${notFinalizedStroke} ${pieCircumference}`}
                          strokeDashoffset={-finalizedStroke}
                          transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                          className="cursor-pointer"
                          onClick={() => setStudentSelection({ kind: "not_finalized", label: "Não finalizaram" })}
                        />
                        <circle cx={pieCenter} cy={pieCenter} r={18} fill="var(--timeline-dot-bg)" />
                      </svg>
                      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                        <button
                          type="button"
                          onClick={() => setStudentSelection({ kind: "finalized", label: "Finalizaram" })}
                          className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:underline"
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
                          className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:underline"
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: "var(--red-fill)", border: "1px solid var(--red-stroke)" }}
                          />
                          Não finalizaram: {formatPct(summaryNotFinalizedPct)} ({nonFinalizedCount})
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-300">Clique no gráfico para ver a lista de alunos.</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-4">
                    <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Percentual de alunos por faixa de acerto
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-borderDark lg:overflow-visible">
                      <table className="w-full min-w-[760px] lg:min-w-0 table-auto border-collapse">
                        <thead className="bg-slate-50 dark:bg-surface-2">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">Percentual de acerto</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300">Percentual de alunos</th>
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
                                  className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200"
                                  style={{ borderTop: `1px solid ${bucketColor.stroke}` }}
                                >
                                  {bucket.range}%
                                </td>
                                <td
                                  className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200"
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
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                      Clique na tabela para ver a lista de alunos.
                    </div>
                  </div>
                </div>
                <div ref={classReportsSectionRef} className="mt-4">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Relatórios por turma</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {loadedFilters.offer.description?.trim() || `Oferta #${loadedFilters.offer.id}`} •{" "}
                    {getBookletName(loadedFilters.offer)}
                  </p>
                  <div className="my-4 border-t border-slate-100 dark:border-borderDark" />
                  {classReportsDisplay.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 dark:border-borderDark bg-slate-50 dark:bg-surface-2 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      Nenhuma turma vinculada a esta oferta.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {classReportsDisplay.map((row) => (
                        <div key={row.class_id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 shadow-sm">
                          <div className="bg-brand-600 dark:bg-emerald-700 px-4 py-3 text-sm font-semibold text-white">{row.class_name}</div>
                          <div className="space-y-3 p-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Resumo</div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              Total de alunos avaliados:{" "}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{row.total_students}</span>
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              Percentual de acerto:{" "}
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPct(row.accuracy_percent)}</span>
                            </div>
                            {row.absent_count > 0 ? (
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                                {row.absent_count} aluno(s) sem respostas ({formatPct(row.absent_percent)}).
                              </div>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/relatorios/ofertas/${loadedFilters.offer.id}?class_ref=${row.class_id}&class_name=${encodeURIComponent(row.class_name)}${loadedFilters.schoolRef ? `&school_ref=${loadedFilters.schoolRef}` : ""}${loadedFilters.serie ? `&serie=${loadedFilters.serie}` : ""}`,
                                )
                              }
                              className="w-full rounded-lg btn-primary px-4 py-2 text-sm font-semibold"
                            >
                              Acessar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {studentSelection ? (
                  <div ref={selectedStudentsCardRef} className="mt-4 rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Alunos relacionados: {studentSelection.label}
                      </div>
                      <button
                        type="button"
                        onClick={() => setStudentSelection(null)}
                        className="rounded-md border border-slate-200 dark:border-borderDark px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-2"
                      >
                        Limpar seleção
                      </button>
                    </div>
                    {selectedStudents.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-300">Nenhum aluno encontrado para este recorte.</div>
                    ) : (
                      <div className="overflow-auto lg:overflow-visible">
                        <table className="w-full min-w-[760px] lg:min-w-0 table-auto border-collapse">
                          <thead className="border-b border-slate-200 dark:border-borderDark bg-slate-50 dark:bg-surface-2">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Aluno</th>
                              <th className="w-28 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">% acerto</th>
                              <th className="w-40 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Status</th>
                              <th className="w-44 px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Acertos/Erros/Brancos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedStudents.map((student: ReportStudentRowDTO) => (
                              <tr key={`${student.class_ref}-${student.student_ref}`} className="border-t border-slate-100 dark:border-borderDark">
                                <td className="px-3 py-2 text-sm text-slate-800 dark:text-slate-200">{student.name}</td>
                                <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">{formatPct(student.correct_pct)}</td>
                                <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getReportStudentStatusBadgeClass(student.status)}`}
                                  >
                                    {getReportStudentStatusLabel(student.status)}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                                  {student.correct}/{student.wrong}/{student.blank}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {summaryError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {summaryError}
            </div>
          ) : null}

          {summaryLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 px-4 py-8" aria-busy="true">
              {showSummaryLoading ? <EqualizerLoader size={36} /> : null}
            </div>
          ) : null}

        </div>
      ) : (
        <div className="space-y-4">
          {overviewError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {overviewError}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-5 shadow-sm">
            <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Informações gerais</div>
            {overviewLoading ? (
              <div className="flex items-center justify-center py-4" aria-busy="true">
                {showOverviewLoading ? <EqualizerLoader size={48} /> : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Composição das aplicações
                  </div>
                  <div className="flex items-center gap-4">
                    <svg viewBox={`0 0 ${pieSize} ${pieSize}`} className="h-36 w-36 shrink-0">
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--chart-border)"
                        strokeWidth={pieStroke}
                      />
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--green-stroke)"
                        strokeWidth={pieStroke}
                        strokeDasharray={`${overviewFinalizedStroke} ${pieCircumference}`}
                        strokeDashoffset={0}
                        transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                      />
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--green-fill)"
                        strokeWidth={pieInnerStroke}
                        strokeDasharray={`${overviewFinalizedStroke} ${pieCircumference}`}
                        strokeDashoffset={0}
                        transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                      />
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--blue-stroke)"
                        strokeWidth={pieStroke}
                        strokeDasharray={`${overviewInProgressStroke} ${pieCircumference}`}
                        strokeDashoffset={-overviewFinalizedStroke}
                        transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                      />
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--blue-fill)"
                        strokeWidth={pieInnerStroke}
                        strokeDasharray={`${overviewInProgressStroke} ${pieCircumference}`}
                        strokeDashoffset={-overviewFinalizedStroke}
                        transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                      />
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--yellow-stroke)"
                        strokeWidth={pieStroke}
                        strokeDasharray={`${overviewAbsentStroke} ${pieCircumference}`}
                        strokeDashoffset={-(overviewFinalizedStroke + overviewInProgressStroke)}
                        transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                      />
                      <circle
                        cx={pieCenter}
                        cy={pieCenter}
                        r={pieRadius}
                        fill="none"
                        stroke="var(--yellow-fill)"
                        strokeWidth={pieInnerStroke}
                        strokeDasharray={`${overviewAbsentStroke} ${pieCircumference}`}
                        strokeDashoffset={-(overviewFinalizedStroke + overviewInProgressStroke)}
                        transform={`rotate(-90 ${pieCenter} ${pieCenter})`}
                      />
                      <circle cx={pieCenter} cy={pieCenter} r={18} fill="var(--timeline-dot-bg)" />
                    </svg>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: "var(--green-fill)", border: "1px solid var(--green-stroke)" }}
                        />
                        Finalizados: {overviewFinalized} ({formatPct(pieFinalizedPct)})
                      </div>
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: "var(--blue-fill)", border: "1px solid var(--blue-stroke)" }}
                        />
                        Em andamento: {overviewInProgress} ({formatPct(pieInProgressPct)})
                      </div>
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: "var(--yellow-fill)", border: "1px solid var(--yellow-stroke)" }}
                        />
                        Ausentes: {overviewAbsent} ({formatPct(pieAbsentPct)})
                      </div>
                      <div className="pt-1 font-semibold text-slate-900 dark:text-slate-100">
                        Total de aplicações: {overviewApplicationsTotal}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-borderDark bg-white dark:bg-surface-1 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Distribuição de acertos
                  </div>
                  {overviewBars.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-300">Sem dados para exibir.</div>
                  ) : (
                    <div className="flex h-44 items-end gap-4 border-b border-slate-200 dark:border-borderDark pb-1">
                      {overviewBars.map((bucket, index) => {
                        const color = chartPalette[index % chartPalette.length];
                        return (
                        <div key={bucket.range} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                            {formatPct(bucket.pct_students)}
                          </div>
                          <div className="flex h-28 w-full items-end rounded border border-slate-200 dark:border-borderDark bg-slate-100 dark:bg-surface-2 px-1">
                            <div
                              className="w-full rounded-t transition-all"
                              style={{
                                height: `${Math.max(Math.min(bucket.pct_students, 100), 2)}%`,
                                backgroundColor: color.fill,
                                border: `1px solid ${color.stroke}`,
                              }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">{bucket.range}%</div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
