import { api } from "@/lib/api";
import { downloadBlob } from "@/lib/downloadBlob";
import { getOffer, listOffers } from "@/features/ofertas/services/offers";
import type {
  OfferFilters,
  ReportByClassRowDTO,
  ReportsOverviewDTO,
  ReportSummaryDTO,
} from "@/features/relatorios/types";

export async function listReportOffers(filters?: OfferFilters) {
  return listOffers(filters);
}

export async function getReportOffer(offerId: number) {
  return getOffer(offerId);
}

export async function getReportsOverview() {
  const { data } = await api.get<ReportsOverviewDTO>("/reports/overview/");
  return data;
}

export async function getReportsByClass(
  offerId: number,
  filters?: ReportSummaryFilters | number,
) {
  const params = toSummaryParams(filters);
  const { data } = await api.get<ReportByClassRowDTO[]>(`/reports/by-class/${offerId}/`, {
    params,
  });
  return data;
}

type ReportSummaryFilters = {
  schoolRef?: number;
  serie?: number;
  classRef?: number;
};

function normalizeFilters(
  filters?: ReportSummaryFilters | number,
): ReportSummaryFilters | undefined {
  if (typeof filters === "number") {
    return { classRef: filters };
  }
  return filters;
}

function toSummaryParams(filters?: ReportSummaryFilters | number) {
  const normalized = normalizeFilters(filters);
  const params: Record<string, unknown> = {};
  if (typeof normalized?.schoolRef === "number") params.school_ref = normalized.schoolRef;
  if (typeof normalized?.serie === "number") params.serie = normalized.serie;
  if (typeof normalized?.classRef === "number") params.class_ref = normalized.classRef;
  return params;
}

export async function getOfferReportSummary(
  offerId: number,
  filters?: ReportSummaryFilters | number,
) {
  const params = toSummaryParams(filters);
  const { data } = await api.get<ReportSummaryDTO>(`/offers/${offerId}/reports/summary/`, {
    params,
  });
  return data;
}

export async function downloadReportStudentsCsv(
  offerId: number,
  filters?: ReportSummaryFilters | number,
) {
  const params = toSummaryParams(filters);
  const response = await api.get<Blob>(`/offers/${offerId}/reports/students.csv`, {
    params,
    responseType: "blob",
  });
  downloadBlob(response.data, `oferta-${offerId}-relatorio-alunos.csv`);
}

export async function downloadReportItemsCsv(
  offerId: number,
  filters?: ReportSummaryFilters | number,
) {
  const params = toSummaryParams(filters);
  const response = await api.get<Blob>(`/offers/${offerId}/reports/items.csv`, {
    params,
    responseType: "blob",
  });
  downloadBlob(response.data, `oferta-${offerId}-relatorio-questoes.csv`);
}
