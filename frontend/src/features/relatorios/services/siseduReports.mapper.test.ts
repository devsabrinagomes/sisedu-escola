import {
  mapDescritorToSaber,
  mapNivelDesempenhoToHabilidade,
} from "@/features/relatorios/services/siseduReports";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function runMapperTests() {
  const saber = mapDescritorToSaber({
    id: 10,
    descritor: { nome: "Localizar informação explícita", codigo: "D1" },
    topico: 3,
  });
  assert(Boolean(saber), "Esperava mapear descritor para saber");
  assert(saber?.nome === "Localizar informação explícita", "Nome do saber inválido");
  assert(saber?.codigo === "D1", "Código do saber inválido");

  const habilidade = mapNivelDesempenhoToHabilidade({
    id: 22,
    nivel_desempenho: { nome: "Intermediário", codigo: "N2" },
  });
  assert(Boolean(habilidade), "Esperava mapear nivel_desempenho para habilidade");
  assert(habilidade?.nome === "Intermediário", "Nome da habilidade inválido");
  assert(habilidade?.codigo === "N2", "Código da habilidade inválido");
}

runMapperTests();

