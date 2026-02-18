import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import QuestaoForm from "@/features/questoes/components/QuestaoForm";

export default function QuestoesNova() {
  const nav = useNavigate();

  async function handleSubmit(fd: FormData) {
    await api.post("/questoes/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    nav("/questoes");
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </button>
      </div>

      <QuestaoForm
        mode="create"
        onSubmitFormData={handleSubmit}
        onCancel={() => nav("/questoes")}
      />
    </div>
  );
}
