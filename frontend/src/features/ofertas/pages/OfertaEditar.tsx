import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import PageCard from "@/components/layout/PageCard";
import { useToast } from "@/components/ui/toast/useToast";
import OfferForm from "@/features/ofertas/components/OfferForm";
import { getOffer, updateOffer } from "@/features/ofertas/services/offers";
import type { OfferDTO, OfferPayload } from "@/features/ofertas/types";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";

export default function OfertaEditar() {
  const { id } = useParams();
  const offerId = Number(id);
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [item, setItem] = useState<OfferDTO | null>(null);

  useEffect(() => {
    if (!offerId) return;
    void load();
  }, [offerId]);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const offer = await getOffer(offerId);
      setItem(offer);
    } catch {
      setErr("Não foi possível carregar a oferta.");
    } finally {
      setLoading(false);
    }
  }

  const canEdit = Number(item?.created_by) === Number(userId);

  async function handleSubmit(payload: OfferPayload) {
    if (!canEdit) return;
    try {
      setSaving(true);
      await updateOffer(offerId, payload);
      toast({ type: "success", title: "Oferta atualizada com sucesso" });
      navigate(`/ofertas/${offerId}`);
    } catch (error: unknown) {
      toast({
        type: "error",
        title: "Erro ao atualizar oferta",
        message: getApiErrorMessage(error),
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500">Carregando...</div>;
  }

  return (
    <PageCard
      breadcrumb={[
        { label: "Ofertas", to: "/ofertas" },
        { label: "Editar" },
      ]}
      title="Editar oferta"
      subtitle="Atualize caderno, período e descrição."
      onBack={() => navigate(`/ofertas/${offerId}`)}
    >
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {!err && item && !canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Você não tem permissão para editar esta oferta.
        </div>
      )}

      {!err && item && canEdit && (
        <OfferForm
          mode="edit"
          saving={saving}
          initialData={item}
          onCancel={() => navigate(`/ofertas/${offerId}`)}
          onSubmit={handleSubmit}
        />
      )}
    </PageCard>
  );
}
