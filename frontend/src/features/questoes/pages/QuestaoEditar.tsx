import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import QuestaoForm, { type QuestionDTO } from "@/features/questoes/components/QuestaoForm";
import { useAuth } from "@/auth/AuthContext";
import PageCard from "@/components/layout/PageCard";

export default function QuestaoEditar() {
  const { id } = useParams();
  const nav = useNavigate();
  const { username: me } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuestionDTO | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await api.get<QuestionDTO>(`/questions/${id}/`);
        setData(res.data);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Não foi possível carregar a questão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Se o backend mandar "created_by_username" em algum lugar (raiz ou dentro de versions), usamos.
  // Se não mandar, a gente não inventa: só não mostra o botão de excluir.
  const ownerUsername = useMemo(() => {
    const root = (data as any)?.created_by_username;
    if (root) return String(root);

    const versions = (data as any)?.versions;
    if (Array.isArray(versions) && versions.length) {
      // às vezes o serializer coloca infos do owner na version
      const vOwner = versions?.[0]?.created_by_username;
      if (vOwner) return String(vOwner);
    }
    return "";
  }, [data]);

  const canConfirmOwnership = !!ownerUsername && !!me;

  const isMine = useMemo(() => {
    if (!canConfirmOwnership) return false;
    return ownerUsername.toLowerCase() === me.toLowerCase();
  }, [canConfirmOwnership, ownerUsername, me]);

  async function handleSubmit(fd: FormData) {
    await api.patch(`/questions/${id}/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    nav("/questoes");
  }

  async function onDelete() {
    if (!data) return;

    // só deixa excluir quando dá pra confirmar autoria
    if (!canConfirmOwnership || !isMine) {
      window.alert("Você só pode excluir questões criadas por você.");
      return;
    }

    const ok = window.confirm(
      `Tem certeza que deseja excluir a questão #${data.id}? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;

    try {
      await api.delete(`/questions/${id}/`);
      nav("/questoes");
    } catch (e: any) {
      window.alert(
        e?.response?.data?.detail ||
          "Não foi possível excluir. (Talvez não seja sua questão.)"
      );
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando…</div>;

  return (
    <PageCard
      breadcrumb={[
        { label: "Questões", to: "/questoes" },
        { label: "Editar" },
      ]}
      title="Editar questão"
      subtitle="Atualize as informações da questão."
      onBack={() => nav(`/questoes/${id}`)}
      rightSlot={
        canConfirmOwnership && isMine ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Excluir questão
          </button>
        ) : undefined
      }
    >
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {data && (
        <QuestaoForm
          key={data.id}
          mode="edit"
          initialData={data}
          onSubmitFormData={handleSubmit}
          onCancel={() => nav(`/questoes/${id}`)}
        />
      )}
    </PageCard>
  );
}
