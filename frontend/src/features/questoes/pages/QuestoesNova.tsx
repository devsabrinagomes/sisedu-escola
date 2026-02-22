import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import QuestaoForm from "@/features/questoes/components/QuestaoForm";
import { useToast } from "@/components/ui/toast/useToast";
import { getApiErrorMessage } from "@/lib/getApiErrorMessage";
import PageCard from "@/components/layout/PageCard";

export default function QuestoesNova() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  function getCreateValidationMessage(e: any) {
    const data = e?.response?.data;
    if (!data || typeof data !== "object") return "";

    const titleError = Array.isArray(data.title) ? String(data.title[0] || "") : "";
    if (titleError) return "O enunciado é obrigatório.";

    const commandError = Array.isArray(data.command) ? String(data.command[0] || "") : "";
    if (commandError) return "O comando é obrigatório.";

    const firstField = Object.entries(data as Record<string, unknown>)[0];
    if (!firstField) return "";
    const [field, value] = firstField;
    if (Array.isArray(value) && value[0]) return `${field}: ${String(value[0])}`;
    if (typeof value === "string" && value) return `${field}: ${value}`;
    return "";
  }

  async function handleSubmit(fd: FormData) {
    try {
      setSaving(true);
      await api.post("/questions/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast({
        type: "success",
        title: "Questão criada com sucesso",
      });
      window.setTimeout(() => nav("/questoes"), 800);
    } catch (e: any) {
      if (e?.response?.status === 400) {
        toast({
          type: "error",
          title: "Erro de validação",
          message: getCreateValidationMessage(e) || getApiErrorMessage(e),
        });
      } else {
        toast({
          type: "error",
          title: "Erro ao criar questão",
          message: getApiErrorMessage(e),
        });
      }
      throw e;
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageCard
      breadcrumb={[
        { label: "Questões", to: "/questoes" },
        { label: "Nova questão" },
      ]}
      title="Nova questão"
      subtitle="Preencha os campos para cadastrar uma nova questão."
      onBack={() => nav("/questoes")}
    >
      <QuestaoForm
        mode="create"
        onSubmitFormData={handleSubmit}
        onCancel={() => nav("/questoes")}
      />
    </PageCard>
  );
}
