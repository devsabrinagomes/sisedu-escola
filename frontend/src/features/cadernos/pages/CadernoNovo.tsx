import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import PageCard from "@/components/layout/PageCard";
import { useToast } from "@/components/ui/toast/useToast";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import BookletForm from "@/features/cadernos/components/BookletForm";
import type { BookletItemDraft, BookletItemUpsertInput } from "@/features/cadernos/types";
import {
  createBooklet,
  createBookletItem,
  createBookletItemsBulk,
} from "@/features/cadernos/services/booklets";
import { setBookletKitPending } from "@/features/ofertas/utils";

function toUpsertItems(items: BookletItemDraft[]): BookletItemUpsertInput[] {
  return items.map((item, index) => ({
    question_version: item.question_version_id,
    order: index + 1,
  }));
}

export default function CadernoNovo() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function persistBookletItems(
    bookletId: number,
    items: BookletItemDraft[],
  ) {
    if (items.length === 0) return;

    const payload = toUpsertItems(items);
    try {
      await createBookletItemsBulk(bookletId, payload);
      return;
    } catch {
      // fallback sequencial quando endpoint bulk não existe
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      await createBookletItem(bookletId, {
        question_version: item.question_version_id,
        question_id: item.question_id,
        order: index + 1,
      });
    }
  }

  async function handleSubmit({
    name,
    items,
  }: {
    name: string;
    items: BookletItemDraft[];
  }) {
    try {
      setSaving(true);
      const created = await createBooklet({ name });
      await persistBookletItems(created.id, items);
      setBookletKitPending(created.id, true);
      toast({
        type: "success",
        title: "Caderno criado com sucesso",
      });
      navigate(`/cadernos/${created.id}`, {
        state: { showKitModal: true },
      });
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao criar caderno",
        message: getApiErrorMessage(error),
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageCard
      breadcrumb={[
        { label: "Cadernos", to: "/cadernos" },
        { label: "Novo caderno" },
      ]}
      title="Novo caderno"
      subtitle="Preencha os campos e monte o caderno com as questões desejadas."
      onBack={() => navigate("/cadernos")}
    >
      <BookletForm
        mode="create"
        currentUserId={userId}
        saving={saving}
        onCancel={() => navigate("/cadernos")}
        onSubmit={handleSubmit}
      />
    </PageCard>
  );
}
