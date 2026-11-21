# AGENTS.md — Backend Flow Viewer

Contexto do projeto para pessoas e ferramentas de IA.

## 1. O que é

Extensão do VS Code que faz **análise estática** (AST com `ts-morph`) de projetos Node.js/TypeScript com Express em camadas e mostra o fluxo de uma requisição: `Rota -> Controller -> Service -> Repository/Model`. A meta final é um grafo clicável numa Webview, em que cada nó abre o arquivo e a linha correspondentes.

- **Stack:** TypeScript, VS Code Extension API, `ts-morph`, bundler `esbuild` (scaffold do `yo code`).
- **Comandos:** `npm run compile`, `npm run watch`, `npm run check-types`, `npm run lint`, `npm test`, `npm run package`.
- **Debug:** `F5` abre o Extension Development Host já no workspace de teste `sample-express/` (com `--disable-extensions`, para isolar de outras extensões).

## 2. Arquitetura

```text
src/
├── analyzer/
│   ├── ast-engine.ts        # AstEngine: cache de Project do ts-morph, acha o tsconfig mais próximo, sincroniza o texto ainda não salvo
│   ├── tracer.ts            # traceSymbolAtLine: resolve o símbolo sob o cursor até a declaração real (segue imports/aliases)
│   └── route-extractor.ts   # (a fazer) detectar app/router.get|post|put|patch|delete
├── webview/                 # (a fazer) panel.ts + ui/ com o grafo
└── extension.ts             # registra comandos, Output Channel "Backend Flow Viewer"
sample-express/              # mini projeto Express (routes -> controller -> service -> repository) para testar
```

**Feito (Fase 1):** comando `backend-viewer.traceSymbolAtCursor` ("Backend Viewer: Rastrear Símbolo sob o Cursor"), na paleta e no menu de contexto de `.ts`/`.js`. Retorna `SymbolDefinitionResult` (nome, tipo do nó, arquivo, linha, coluna, prévia) e oferece o botão "Abrir Definição". Validado em `sample-express/routes.ts`: `create` resolve para `UserController.create` em `user.controller.ts`.

**Notas de ambiente:** o `tasks.json` do template dependia do problem matcher `$esbuild-watch` (extensão externa) e travava o `F5`; a pré-tarefa foi trocada por `compile` síncrono.

## 3. Próximos passos

- [ ] **Fase 2 — rastreamento recursivo:** `route-extractor.ts` (método HTTP + path, separar middlewares do handler) e expandir o `tracer.ts` para descer Controller → Service → Repository, ignorando `node_modules` (exceto ORMs), com `maxDepth` e detecção de ciclos.
- [ ] **Fase 3 — Webview:** `webview/panel.ts` envia `{ type: 'RENDER_GRAPH', payload: { nodes, edges } }`; a UI devolve `{ type: 'OPEN_SOURCE', filePath, line }` e o host abre o documento. Renderização: Mermaid (simples) ou React Flow (mais interativo).
- [ ] Substituir o `README.md` e o `vsc-extension-quickstart.md` do template por documentação real.

## 4. Diretrizes

1. Todo código de análise fica em `src/analyzer/` e não depende da API `vscode` (para poder testar fora do editor).
2. Teste novas regras de rastreamento com casos em `sample-express/`.
3. Não cite conversas, prompts nem caminhos absolutos (`C:\...`, `file:///...`) na documentação.
