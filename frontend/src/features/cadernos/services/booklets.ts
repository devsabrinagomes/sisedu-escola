import { api } from "@/lib/api";
import { getWithFallback, isNotFound } from "@/lib/httpFallback";
import type {
  BookletDTO,
  BookletItemDTO,
  BookletItemUpsertInput,
  Paginated,
} from "@/features/cadernos/types";

function toList<T>(data: Paginated<T> | T[]): T[] {
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function listBooklets(params?: Record<string, unknown>) {
  const data = await getWithFallback<Paginated<BookletDTO> | BookletDTO[]>(
    "/booklets/",
    "/cadernos/",
    { params },
  );
  const list = toList(data);
  if (!params?.search) return list;

  // TODO backend: garantir filtro search em /booklets para evitar filtro local.
  return list.filter((item) =>
    item.name.toLowerCase().includes(String(params.search).toLowerCase()),
  );
}

export async function searchBooklets(params?: { search?: string; page?: number }) {
  return listBooklets({
    search: params?.search,
    page: params?.page ?? 1,
  });
}

export async function getBooklet(bookletId: number) {
  return getWithFallback<BookletDTO>(
    `/booklets/${bookletId}/`,
    `/cadernos/${bookletId}/`,
  );
}

export async function createBooklet(payload: Pick<BookletDTO, "name">) {
  try {
    const { data } = await api.post<BookletDTO>("/booklets/", payload);
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const { data } = await api.post<BookletDTO>("/cadernos/", payload);
    return data;
  }
}

export async function updateBooklet(
  bookletId: number,
  payload: Pick<BookletDTO, "name">,
) {
  try {
    const { data } = await api.put<BookletDTO>(`/booklets/${bookletId}/`, payload);
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const { data } = await api.put<BookletDTO>(`/cadernos/${bookletId}/`, payload);
    return data;
  }
}

export async function deleteBooklet(bookletId: number) {
  try {
    await api.delete(`/booklets/${bookletId}/`);
    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  await api.delete(`/cadernos/${bookletId}/`);
}

export async function listBookletItems(bookletId: number) {
  try {
    const { data } = await api.get<Paginated<BookletItemDTO> | BookletItemDTO[]>(
      `/booklets/${bookletId}/items/`,
    );
    return toList(data);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  throw new Error(
    "TODO backend: implementar GET /booklets/:id/items/ ou retornar items no detalhe do caderno.",
  );
}

export async function createBookletItemsBulk(
  bookletId: number,
  items: BookletItemUpsertInput[],
) {
  try {
    const { data } = await api.post<BookletItemDTO[]>(
      `/booklets/${bookletId}/items/bulk/`,
      items,
    );
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  throw new Error(
    "TODO backend: implementar POST /booklets/:id/items/bulk/ para criação em lote.",
  );
}

export async function replaceBookletItems(
  bookletId: number,
  items: BookletItemUpsertInput[],
) {
  try {
    const { data } = await api.put<BookletItemDTO[]>(
      `/booklets/${bookletId}/items/`,
      items,
    );
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  throw new Error(
    "TODO backend: implementar PUT /booklets/:id/items/ para replace ordenado.",
  );
}

export async function createBookletItem(
  bookletId: number,
  item: BookletItemUpsertInput & { question_id?: number },
) {
  try {
    const { data } = await api.post<BookletItemDTO>(
      `/booklets/${bookletId}/items/`,
      item,
    );
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  if (!item.question_id) {
    throw new Error(
      "TODO backend: sem endpoint de item por version, fallback exige question_id.",
    );
  }

  const { data } = await api.post<BookletItemDTO>(
    `/cadernos/${bookletId}/add-question/`,
    { question_id: item.question_id },
  );
  return data;
}

export async function deleteBookletItem(bookletId: number, itemId: number) {
  try {
    await api.delete(`/booklets/${bookletId}/items/${itemId}/`);
    return;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  throw new Error(
    "TODO backend: implementar DELETE /booklets/:id/items/:itemId/ para remover itens no editar.",
  );
}

export async function updateBookletItem(
  bookletId: number,
  itemId: number,
  payload: Partial<BookletItemUpsertInput>,
) {
  try {
    const { data } = await api.patch<BookletItemDTO>(
      `/booklets/${bookletId}/items/${itemId}/`,
      payload,
    );
    return data;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  throw new Error(
    "TODO backend: implementar PATCH /booklets/:id/items/:itemId/ para atualizar ordem.",
  );
}
