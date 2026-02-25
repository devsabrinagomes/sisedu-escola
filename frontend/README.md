# Frontend

## VLibras

Integração adicionada seguindo o padrão recomendado em **"Integrando a uma Página Web"** do VLibras:
- Script oficial: `https://vlibras.gov.br/app/vlibras-plugin.js`
- Widget: `new window.VLibras.Widget("https://vlibras.gov.br/app")`

### Onde está integrado
- Layout raiz da área autenticada: [src/components/Layout.tsx](./src/components/Layout.tsx)
- Componente dedicado: [src/components/accessibility/VLibrasWidget.tsx](./src/components/accessibility/VLibrasWidget.tsx)

### Como funciona (SPA)
- O script é carregado no `mount`.
- Há proteção contra carregamento duplicado (id de script + guardas globais).
- Ao `unmount`, script e markup do widget são removidos.
- A falha do widget não interrompe a aplicação.

### Toggle de exibir/ocultar
Use a variável de ambiente:

```env
VITE_VLIBRAS_ENABLED=true
```

- `true` (padrão): exibe VLibras.
- `false`: desativa o carregamento e oculta o widget.
