import { api } from "@/lib/api";
import { getOffer, listOffers } from "@/features/ofertas/services/offers";
import type { OfferFilters, ReportSummaryDTO } from "@/features/relatorios/types";

export async function listReportOffers(filters?: OfferFilters) {
  return listOffers(filters);
}

export async function getReportOffer(offerId: number) {
  return getOffer(offerId);
}

export async function getOfferReportSummary(offerId: number, classRef?: number) {
  const params: Record<string, unknown> = {};
  if (typeof classRef === "number") params.class_ref = classRef;
  const { data } = await api.get<ReportSummaryDTO>(`/offers/${offerId}/reports/summary/`, {
    params,
  });
  return data;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadReportStudentsCsv(offerId: number, classRef?: number) {
  const params: Record<string, unknown> = {};
  if (typeof classRef === "number") params.class_ref = classRef;
  const response = await api.get<Blob>(`/offers/${offerId}/reports/students.csv`, {
    params,
    responseType: "blob",
  });
  triggerBlobDownload(response.data, `oferta-${offerId}-relatorio-alunos.csv`);
}

export async function downloadReportItemsCsv(offerId: number, classRef?: number) {
  const params: Record<string, unknown> = {};
  if (typeof classRef === "number") params.class_ref = classRef;
  const response = await api.get<Blob>(`/offers/${offerId}/reports/items.csv`, {
    params,
    responseType: "blob",
  });
  triggerBlobDownload(response.data, `oferta-${offerId}-relatorio-questoes.csv`);
}
