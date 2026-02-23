import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageCard from "@/components/layout/PageCard";
import { useToast } from "@/components/ui/toast/useToast";
import OfferForm from "@/features/ofertas/components/OfferForm";
import { createOffer } from "@/features/ofertas/services/offers";
import type { OfferPayload } from "@/features/ofertas/types";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function OfertaNova() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(payload: OfferPayload) {
    try {
      setSaving(true);
      const created = await createOffer(payload);
      toast({ type: "success", title: "Oferta criada com sucesso" });
      navigate(`/ofertas/${created.id}`);
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao criar oferta",
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
        { label: "Ofertas", to: "/ofertas" },
        { label: "Nova oferta" },
      ]}
      title="Nova oferta"
      subtitle="Configure período, caderno e descrição da oferta."
      onBack={() => navigate("/ofertas")}
    >
      <OfferForm
        mode="create"
        saving={saving}
        onCancel={() => navigate("/ofertas")}
        onSubmit={handleSubmit}
      />
    </PageCard>
  );
}
