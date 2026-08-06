# Roadmap — data-lab

O que ainda falta. Documento **vivo**: item concluído sai daqui e vira entrada em [`HISTORY.md`](HISTORY.md); item que ganha plano próprio sai daqui e vira arquivo em [`plan/active/`](plan/active/).

> **Fonte única de pendência.** O `CLAUDE.md`, os planos e as skills apontam para cá — não mantêm listas paralelas do que falta.

---

## 1. A sequência

O caminho macro, do estado atual até o produto do [`ESCOPO.md`](ESCOPO.md):

```
▶ fundação — 8 fases            plan/active/README.md          ← estamos aqui
  camada de dados               study/05-proximos-passos.md
  pipeline de passos, camada 1  ESCOPO.md
  receitas salvas
  JSON/NDJSON · Excel
  catálogo camada 2
  camada de IA                  plan/active/09-camada-de-ia.md
```

Cada etapa depende da anterior por razão real, não por ordem arbitrária. As dependências estão nos documentos linkados.

---

## 2. Gatilhos de revisão

Decisões tomadas com um prazo de validade conhecido. Cada uma tem um **evento** que a reabre — não uma data, porque data não observa nada.

| Quando acontecer | Revisitar | Registrado em |
|---|---|---|
| DuckDB instalado e carregando | `shamefullyHoist: false` no `pnpm-workspace.yaml` | [`03-sandbox`](plan/implemented/03-sandbox-e-seguranca.md) |
| Primeira query reexecutada sobre o mesmo dataset | Adotar TanStack Query | [`06-primeira-feature`](plan/active/06-primeira-feature.md) |
| Segunda janela do app | Progresso endereçado ao remetente, em vez de transmitido a todas | [`06-primeira-feature`](plan/active/06-primeira-feature.md) |
| Sexta fatia em `features/` | `eslint-plugin-boundaries` no lugar do `no-restricted-imports` | [`01-camadas`](plan/implemented/01-camadas-e-fronteiras.md) |
| Vigésimo canal em `shared/ipc.ts` | Skill própria para IPC, separada de `architecture` | [`08-automacao`](plan/active/08-automacao-e-registro.md) |
| Design system estável | Endurecer a CSP (hoje permite `style-src 'unsafe-inline'`) | [`03-sandbox`](plan/implemented/03-sandbox-e-seguranca.md) |
| `check:fast` passar de 10s | Medir a duração do ciclo de retorno | [`08-automacao`](plan/active/08-automacao-e-registro.md) |
| Existirem cartões de dados suficientes | RAG sobre cartões e receitas | [`09-camada-de-ia`](plan/active/09-camada-de-ia.md) |

---

## 3. Atualizações de versão

Movidas do `CLAUDE.md` por serem pendência, não configuração. As versões **em uso** continuam lá.

### Electron 42 → 43 — bump agendado, não reativo
O Electron 43 já saiu. A política do projeto é manter as 3 majors mais recentes suportadas, então o 42 segue coberto — mas o ciclo é de 8 semanas e é o Chromium embutido que carrega as CVEs. **Precisa ser tarefa agendada.** Ao subir, reconferir o `@types/node` contra `process.versions.node`.

### Vite 7 → 8 — bloqueado por compatibilidade declarada
O Vite 8 (bundler Rolldown, em Rust) é estável desde mar/2026, mas o electron-vite 5.0.0 é da mesma época e não declara suporte. Ficamos no 7 conscientemente. Plano B mapeado: o `vite-plugin-electron` declara suporte a 7 e 8.

### TypeScript 5.9 → 6 — exercício isolado
O TS 6 é release de transição com remoções reais: `moduleResolution: "node"`, `baseUrl`, target ES5, módulos `amd`/`umd`/`systemjs`. Um ponto de quebra já foi **eliminado por antecipação**: a [fase 01](plan/implemented/01-camadas-e-fronteiras.md) remove o `baseUrl` do `tsconfig.web.json`, já que `paths` funciona sem ele desde o TS 4.1. Fazer com `tsc --ts6-migration` gerando o relatório, como tarefa própria — nunca junto de outra mudança.

---

## 4. Pendências pontuais

### Perfil do VS Code
A extensão do Python continua ativa e carregando neste workspace. O `python.analysis.exclude` silencia os avisos do node-gyp, mas não impede o carregamento. Um perfil contendo só ESLint, Prettier e EditorConfig resolveria de verdade. Perfil é configuração de máquina — não viaja no repositório.

### `publish` placeholder no `electron-builder.yml`
Aponta para `https://example.com/auto-updates`, herdado do template. Fica como está até existir distribuição real. Não quebra nada; é ruído que confunde quem ler o arquivo.

### Assinatura de código e notarização
Só faz sentido com distribuição. Registrado para não ser confundido com esquecimento.

### `pnpm lint` (e portanto `check:fast`) falha por `.claude/hooks/guard.mjs`
`declaredTokens()` não declara tipo de retorno, e o `@typescript-eslint/explicit-function-return-type` deste projeto não aceita anotação via JSDoc em `.mjs` — só sintaxe TypeScript real, que o arquivo não tem por ser JavaScript puro. Resolver de verdade exige mexer na configuração central do ESLint (parser/`checkJs`), não só no arquivo. Bloqueia o critério "tudo verde" de qualquer fase que rode `pnpm lint` sobre o repositório inteiro, até a [fase 08](plan/active/08-automacao-e-registro.md) tratar os hooks. Isolando os arquivos de cada fase (`pnpm eslint <arquivos>`), o lint continua confiável enquanto isso.

---

## 5. Fora de escopo

Não são pendências. Estão em [`ESCOPO.md`](ESCOPO.md) com justificativa: visualização e BI, edição célula a célula, banco de dados remoto, execução agendada sem interface, colaboração multiusuário, versionamento de dados.
