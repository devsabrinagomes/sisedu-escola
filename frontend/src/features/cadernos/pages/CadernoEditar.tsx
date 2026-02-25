import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import PageCard from "@/components/layout/PageCard";
import EqualizerLoader from "@/components/ui/EqualizerLoader";
import { useToast } from "@/components/ui/toast/useToast";
import useDelayedLoading from "@/shared/hooks/useDelayedLoading";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import BookletForm from "@/features/cadernos/components/BookletForm";
import type {
  BookletItemDraft,
  BookletItemDTO,
  BookletItemUpsertInput,
} from "@/features/cadernos/types";
import { normalizeOrders, toBookletDraftFromItem } from "@/features/cadernos/utils";
import {
  createBookletItem,
  deleteBookletItem,
  getBooklet,
  listBookletItems,
  replaceBookletItems,
  updateBooklet,
  updateBookletItem,
} from "@/features/cadernos/services/booklets";

function toUpsertItems(items: BookletItemDraft[]): BookletItemUpsertInput[] {
  return items.map((item, index) => ({
    question_version: item.question_version_id,
    order: index + 1,
  }));
}

export default function CadernoEditar() {
  const { id } = useParams();
  const bookletId = Number(id);
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [initialItems, setInitialItems] = useState<BookletItemDraft[]>([]);
  const [persistedItems, setPersistedItems] = useState<BookletItemDraft[]>([]);
  const showLoading = useDelayedLoading(loading);

  useEffect(() => {
    if (!bookletId) return;
    void load();
  }, [bookletId]);

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const booklet = await getBooklet(bookletId);
      let items = booklet.items ?? [];
      if (!items.length) {
        try {
          items = await listBookletItems(bookletId);
        } catch {
          items = [];
        }
      }

      const drafts = normalizeOrders(
        [...items]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((item: BookletItemDTO) => toBookletDraftFromItem(item)),
      );
      setName(booklet.name);
      setInitialItems(drafts);
      setPersistedItems(drafts);
    } catch (error: unknown) {
      setErr("Não foi possível carregar o caderno.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const persistedByVersion = useMemo(() => {
    const map = new Map<number, BookletItemDraft>();
    for (const item of persistedItems) {
      map.set(item.question_version_id, item);
    }
    return map;
  }, [persistedItems]);

  async function persistItemsWithFallback(items: BookletItemDraft[]) {
    const ordered = normalizeOrders(items);
    try {
      await replaceBookletItems(bookletId, toUpsertItems(ordered));
      return;
    } catch {
      // fallback diff
    }

    const targetByVersion = new Map<number, BookletItemDraft>();
    for (const item of ordered) {
      targetByVersion.set(item.question_version_id, item);
    }

    const removed = persistedItems.filter(
      (item) => !targetByVersion.has(item.question_version_id),
    );
    for (const item of removed) {
      if (!item.persisted_item_id) continue;
      await deleteBookletItem(bookletId, item.persisted_item_id);
    }

    const existing = ordered.filter((item) =>
      persistedByVersion.has(item.question_version_id),
    );
    for (let index = 0; index < existing.length; index += 1) {
      const item = existing[index];
      const persisted = persistedByVersion.get(item.question_version_id);
      if (!persisted?.persisted_item_id) continue;
      await updateBookletItem(bookletId, persisted.persisted_item_id, {
        order: 1000 + index + 1,
      });
    }
    for (let index = 0; index < existing.length; index += 1) {
      const item = existing[index];
      const persisted = persistedByVersion.get(item.question_version_id);
      if (!persisted?.persisted_item_id) continue;
      await updateBookletItem(bookletId, persisted.persisted_item_id, {
        order: index + 1,
      });
    }

    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      if (persistedByVersion.has(item.question_version_id)) continue;
      await createBookletItem(bookletId, {
        question_version: item.question_version_id,
        question_id: item.question_id,
        order: index + 1,
      });
    }
  }

  async function handleSubmit(payload: { name: string; items: BookletItemDraft[] }) {
    try {
      setSaving(true);
      await updateBooklet(bookletId, { name: payload.name });
      await persistItemsWithFallback(payload.items);
      toast({
        type: "success",
        title: "Caderno atualizado com sucesso",
      });
      navigate(`/cadernos/${bookletId}`);
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao atualizar caderno",
        message: getApiErrorMessage(error),
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-borderDark dark:bg-surface-1" aria-busy="true">
        {showLoading ? <EqualizerLoader size={48} /> : null}
      </div>
    );
  }

  return (
    <PageCard
      breadcrumb={[
        { label: "Cadernos", to: "/cadernos" },
        { label: "Editar" },
      ]}
      title="Editar caderno"
      subtitle="Atualize o nome, as questões e a ordem dos itens."
      onBack={() => navigate(`/cadernos/${bookletId}`)}
    >
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      {!err && (
        <BookletForm
          mode="edit"
          initialName={name}
          initialItems={initialItems}
          currentUserId={userId}
          saving={saving}
          onCancel={() => navigate(`/cadernos/${bookletId}`)}
          onSubmit={handleSubmit}
        />
      )}
    </PageCard>
  );
}
