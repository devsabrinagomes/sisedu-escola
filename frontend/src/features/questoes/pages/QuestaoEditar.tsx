import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import QuestaoForm, { type QuestaoDTO } from "@/features/questoes/components/QuestaoForm";
import { useAuth } from "@/auth/AuthContext";

export default function QuestaoEditar() {
  const { id } = useParams();
  const nav = useNavigate();
  const { username: me } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuestaoDTO | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await api.get<QuestaoDTO>(`/questoes/${id}/`);
        setData(res.data as any);
      } catch (e: any) {
        setErr(e?.response?.data?.detail || "Não foi possível carregar a questão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isMine = useMemo(() => {
    const owner = (data as any)?.criado_por || (data as any)?.created_by_username || "";
    return (owner || "").toLowerCase() === (me || "").toLowerCase();
  }, [data, me]);

  async function handleSubmit(fd: FormData) {
    await api.patch(`/questoes/${id}/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    nav("/questoes");
  }

  async function onDelete() {
    if (!data) return;
    if (!isMine) return;

    const ok = window.confirm(
      `Tem certeza que deseja excluir a questão #${data.id}? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;

    try {
      await api.delete(`/questoes/${id}/`);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Editar questão</h1>
          <p className="mt-1 text-sm text-slate-500">
            Você pode editar e também excluir se for o criador.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isMine && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Excluir questão
            </button>
          )}

          <Link
            to="/questoes"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar
          </Link>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      {data && (
        <QuestaoForm
          mode="edit"
          initialData={data}
          onSubmitFormData={handleSubmit}
          onCancel={() => nav("/questoes")}
        />
      )}
    </div>
  );
}
