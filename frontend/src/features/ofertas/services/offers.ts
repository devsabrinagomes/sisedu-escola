import { api } from "@/lib/api";
import type {
  OfferDTO,
  OfferFilters,
  OfferPayload,
  Paginated,
} from "@/features/ofertas/types";
import { getOfferStatus } from "@/features/ofertas/utils";

export type OfferSchoolDTO = {
  school_ref: number;
  name: string;
};

export type OfferClassDTO = {
  class_ref: number;
  name: string;
  year: number;
  etapa_aplicacao?: string | number | null;
  serie?: string | null;
};

function isNotFound(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404;
}

function isPaginated<T>(data: unknown): data is Paginated<T> {
  if (!data || typeof data !== "object") return false;
  const maybe = data as Partial<Paginated<T>>;
  return Array.isArray(maybe.results);
}

function matchesSearch(offer: OfferDTO, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  const bookletName =
    typeof offer.booklet === "number"
      ? (offer.booklet_name || "")
      : offer.booklet.name;
  const description = offer.description || "";
  return bookletName.toLowerCase().includes(q) || description.toLowerCase().includes(q);
}

function applyClientFilters(items: OfferDTO[], filters?: OfferFilters) {
  if (!filters) return items;
  return items.filter((offer) => {
    if (filters.booklet && filters.booklet !== "all") {
      const bookletId = typeof offer.booklet === "number" ? offer.booklet : offer.booklet.id;
      if (bookletId !== filters.booklet) return false;
    }

    if (filters.status && filters.status !== "all") {
      if (getOfferStatus(offer) !== filters.status) return false;
    }

    if (filters.start_date && offer.start_date < filters.start_date) return false;
    if (filters.end_date && offer.end_date > filters.end_date) return false;

    if (!matchesSearch(offer, filters.search || "")) return false;

    return !offer.deleted;
  });
}

function toPaginated<T>(data: Paginated<T> | T[], page: number): Paginated<T> {
  if (Array.isArray(data)) {
    const pageSize = 10;
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return {
      count: data.length,
      next: end < data.length ? String(safePage + 1) : null,
      previous: start > 0 ? String(safePage - 1) : null,
      results: data.slice(start, end),
    };
  }
  return {
    count: data.count ?? data.results.length,
    next: data.next ?? null,
    previous: data.previous ?? null,
    results: data.results ?? [],
  };
}

async function getWithFallback<T>(primaryUrl: string, fallbackUrl: string, params?: Record<string, unknown>) {
  try {
    const { data } = await api.get<T>(primaryUrl, { params });
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const { data } = await api.get<T>(fallbackUrl, { params });
    return data;
  }
}

export async function listOffers(filters?: OfferFilters) {
  const page = filters?.page ?? 1;
  const params: Record<string, unknown> = {
    page,
  };

  if (filters?.search?.trim()) params.search = filters.search.trim();
  if (filters?.booklet && filters.booklet !== "all") params.booklet = filters.booklet;
  if (filters?.start_date) params.start_date = filters.start_date;
  if (filters?.end_date) params.end_date = filters.end_date;
  if (filters?.status && filters.status !== "all") params.status = filters.status;

  const data = await getWithFallback<Paginated<OfferDTO> | OfferDTO[]>(
    "/offers/",
    "/ofertas/",
    params,
  );

  const paginated = isPaginated<OfferDTO>(data) ? data : toPaginated(data, page);
  const filteredResults = applyClientFilters(paginated.results, filters);

  return {
    ...paginated,
    count: Array.isArray(data)
      ? applyClientFilters(data, filters).length
      : paginated.count,
    results: filteredResults,
  };
}

export async function getOffer(offerId: number) {
  return getWithFallback<OfferDTO>(`/offers/${offerId}/`, `/ofertas/${offerId}/`);
}

export async function createOffer(payload: OfferPayload) {
  try {
    const { data } = await api.post<OfferDTO>("/offers/", payload);
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  throw new Error("TODO backend: implementar POST /offers/.");
}

export async function updateOffer(offerId: number, payload: OfferPayload) {
  try {
    const { data } = await api.put<OfferDTO>(`/offers/${offerId}/`, payload);
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  throw new Error("TODO backend: implementar PUT /offers/:id/.");
}

export async function deleteOffer(offerId: number) {
  try {
    await api.delete(`/offers/${offerId}/`);
    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  throw new Error("TODO backend: implementar DELETE /offers/:id/.");
}

export async function listOfferSchools() {
  const { data } = await api.get<OfferSchoolDTO[]>("/mock/sige/schools/");
  return data;
}

export async function listOfferSchoolClasses(schoolRef: number) {
  const { data } = await api.get<OfferClassDTO[]>(`/mock/sige/schools/${schoolRef}/classes/`);
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

export async function downloadOfferApplicationKit(offerId: number) {
  const [proofResponse, answerSheetResponse] = await Promise.all([
    api.get<Blob>(`/offers/${offerId}/kit/prova/`, { responseType: "blob" }),
    api.get<Blob>(`/offers/${offerId}/kit/cartao-resposta/`, { responseType: "blob" }),
  ]);

  triggerBlobDownload(proofResponse.data, `oferta-${offerId}-caderno-prova.pdf`);
  triggerBlobDownload(answerSheetResponse.data, `oferta-${offerId}-cartao-resposta.pdf`);
}

export async function downloadBookletApplicationKit(bookletId: number) {
  async function getBlobWithFallback(primaryUrl: string, fallbackUrl: string) {
    try {
      const { data } = await api.get<Blob>(primaryUrl, { responseType: "blob" });
      return data;
    } catch (error) {
      if (!isNotFound(error)) throw error;
      const { data } = await api.get<Blob>(fallbackUrl, { responseType: "blob" });
      return data;
    }
  }

  const [proofBlob, answerSheetBlob] = await Promise.all([
    getBlobWithFallback(
      `/booklets/${bookletId}/kit/prova/`,
      `/cadernos/${bookletId}/kit/prova/`,
    ),
    getBlobWithFallback(
      `/booklets/${bookletId}/kit/cartao-resposta/`,
      `/cadernos/${bookletId}/kit/cartao-resposta/`,
    ),
  ]);

  triggerBlobDownload(proofBlob, `caderno-${bookletId}-caderno-prova.pdf`);
  triggerBlobDownload(answerSheetBlob, `caderno-${bookletId}-cartao-resposta.pdf`);
}
