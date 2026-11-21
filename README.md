# 🔎 Backend Flow Viewer

Extensão do VS Code que lê o código de um backend **Node.js/TypeScript com Express** e rastreia o fluxo de uma requisição entre as camadas:

```text
Rota  →  Controller  →  Service  →  Repository / Model
```

A análise é estática: a extensão monta a AST do projeto com [`ts-morph`](https://ts-morph.com/), sem executar o código.

> **Status:** em desenvolvimento. A Fase 1 (rastrear o símbolo sob o cursor) funciona; o rastreamento completo e o grafo visual ainda não existem.

## O que já funciona

Comando **"Backend Viewer: Rastrear Símbolo sob o Cursor"** (`backend-viewer.traceSymbolAtCursor`), na paleta de comandos (`Ctrl+Shift+P`) e no menu de contexto de arquivos `.ts` e `.js`:

1. Lê o símbolo sob o cursor (por exemplo, o `create` de `router.post('/users', userController.create)`).
2. Segue imports e aliases até a declaração real.
3. Mostra o resultado no Output **"Backend Flow Viewer"** e oferece o botão **Abrir Definição**, que pula para o arquivo e a linha.

## Roadmap

- [x] **Fase 1:** motor de AST (`src/analyzer/ast-engine.ts`) e resolução de símbolo (`src/analyzer/tracer.ts`).
- [ ] **Fase 2:** extrair as rotas Express (método HTTP + path) e descer recursivamente Controller → Service → Repository.
- [ ] **Fase 3:** Webview com o grafo do fluxo, em que clicar num nó abre o código.

## Desenvolvimento

```powershell
npm install
npm run compile      # build com esbuild
npm run watch        # build contínuo
npm run check-types  # checagem do TypeScript
npm run lint
npm test
npm run package      # build de produção
```

Aperte `F5` no VS Code para abrir o **Extension Development Host** já com o projeto de exemplo `sample-express/` (rotas, controller, service e repository de usuários) aberto em `routes.ts`. As outras extensões ficam desativadas nessa janela, para não atrapalhar o teste.

## Estrutura

```text
src/
├── analyzer/
│   ├── ast-engine.ts   # cache do Project do ts-morph, acha o tsconfig mais próximo
│   └── tracer.ts       # resolve o símbolo sob o cursor até a declaração
├── extension.ts        # registro do comando e saída no Output
└── test/
sample-express/         # backend de exemplo para testar a extensão
```
