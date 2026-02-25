# Auditoria de Acessibilidade (Screen Reader)

Data: 2026-02-25  
Escopo: frontend React + TypeScript + Tailwind  
Critério: compatibilidade prática com leitor de tela (base WCAG 2.1 AA)

## Resultado geral
- **Status atual:** Parcialmente compatível.
- **Base implementada:** boa (landmarks, foco visível, labels em várias ações, modais com `role="dialog"`).
- **Pendências relevantes:** componentes de formulário customizados (combobox/date picker) ainda sem semântica ARIA completa.

## Ajustes aplicados nesta rodada
- `AddToCadernoModal`: adicionados `role="dialog"`, `aria-modal`, `aria-labelledby`.
- `AnswersDrawer`: adicionados `role="dialog"`, `aria-modal`, `aria-labelledby`.
- `QuestionVersionPickerModal`: adicionados `role="dialog"`, `aria-modal`, `aria-labelledby`.
- `Login`: labels associados via `htmlFor`/`id` e mensagem de erro com `role="alert"`.

Arquivos:
- `src/features/questoes/components/AddToCadernoModal.tsx`
- `src/features/gabaritos/components/AnswersDrawer.tsx`
- `src/features/cadernos/components/QuestionVersionPickerModal.tsx`
- `src/pages/Login.tsx`

## Checklist por área
- Sidebar: **OK**
- Topbar: **OK** (skip link, botões com labels, ajuda em dialog)
- Cards: **OK**
- Tabelas: **Parcial** (estrutura boa; faltam melhorias de anúncio de paginação/mudança dinâmica)
- Formulários: **Parcial**
- Modais/Drawers: **Parcial+** (semântica melhorada; falta trap de foco consistente em todos)
- Alerts/Toasts: **Parcial** (`role="alert"` em partes, `aria-live` no toast ok)
- Relatórios: **Parcial** (muito conteúdo dinâmico sem regiões `aria-live`)

## Checklist por rota
- `/login`: **Parcial+** (labels e erro com alert ok; pode melhorar com `autocomplete` e descrição de erros por campo)
- `/`: **Parcial** (conteúdo visual rico, requer revisão com NVDA para ordem de leitura)
- `/questoes`, `/questoes/nova`, `/questoes/:id`, `/questoes/:id/editar`: **Parcial**
- `/cadernos`, `/cadernos/novo`, `/cadernos/:id`, `/cadernos/:id/editar`: **Parcial**
- `/ofertas`, `/ofertas/nova`, `/ofertas/:id`, `/ofertas/:id/editar`: **Parcial**
- `/gabaritos`, `/gabaritos/ofertas/:offerId`: **Parcial**
- `/relatorios`, `/relatorios/ofertas/:offerId`: **Parcial**
- `/suporte`, `/acessibilidade`, `/privacidade`: **OK básico**

## Pendências prioritárias
1. Combobox customizado com semântica ARIA completa.
   - Aplicar `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, lista com `role="listbox"` e opções com `role="option"`.
   - Alvos: `SigeCombobox`, `SigeMultiCombobox`, `BookletCombobox`.
2. Date picker com atributos ARIA de controle.
   - Adicionar rótulo acessível ao botão principal e relação explícita com calendário.
3. Trap de foco em dialogs principais.
   - Garantir ciclo de foco interno enquanto modal/drawer estiver aberto.
4. Estados dinâmicos em tabelas/listas.
   - Adicionar regiões `aria-live` para “carregando”, “X resultados”, mudança de página/filtro.
5. Erro por campo em formulários maiores.
   - Expandir `aria-invalid`/`aria-describedby` para todos os campos obrigatórios.

## Próximo passo recomendado
Executar teste assistivo manual com NVDA (Windows) em fluxos críticos:
- Login
- Criar/editar questão
- Criar oferta
- Preencher gabarito no drawer
- Navegação por filtros + paginação
