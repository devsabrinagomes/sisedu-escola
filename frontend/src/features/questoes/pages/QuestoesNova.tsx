import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import QuestaoForm from "@/features/questoes/components/QuestaoForm";

export default function QuestoesNova() {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(fd: FormData) {
    try {
      setSaving(true);
      setErr("");
      await api.post("/questions/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      nav("/questoes");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Erro ao salvar a questão.");
      throw e; // mantém o QuestaoForm sabendo que deu ruim (se ele quiser tratar)
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nova questão</h1>
        </div>

        <button
          type="button"
          onClick={() => nav("/questoes")}
          disabled={saving}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Voltar
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {err}
        </div>
      )}

      <QuestaoForm
        mode="create"
        onSubmitFormData={handleSubmit}
        onCancel={() => nav("/questoes")}
      />
    </div>
  );
}
