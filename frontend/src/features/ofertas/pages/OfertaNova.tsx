import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageCard from "@/components/layout/PageCard";
import { useToast } from "@/components/ui/toast/useToast";
import OfferForm from "@/features/ofertas/components/OfferForm";
import { createOffer } from "@/features/ofertas/services/offers";
import type { OfferPayload } from "@/features/ofertas/types";
import { setOfferKitPending, setOfferSigeSelection, type OfferSigeSelection } from "@/features/ofertas/utils";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function OfertaNova() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(payload: OfferPayload, sigeSelection: OfferSigeSelection) {
    try {
      setSaving(true);
      const created = await createOffer(payload);
      setOfferKitPending(created.id, true);
      setOfferSigeSelection(created.id, sigeSelection);
      navigate(`/ofertas/${created.id}`, {
        state: { showKitModal: true },
      });
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
