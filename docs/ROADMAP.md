# Roadmap — data-lab

O que ainda falta. Documento **vivo**: item concluído sai daqui e vira entrada em [`HISTORY.md`](HISTORY.md); item que ganha plano próprio sai daqui e vira arquivo em [`plan/active/`](plan/active/).

> **Fonte única de pendência.** O `CLAUDE.md`, os planos e as skills apontam para cá — não mantêm listas paralelas do que falta.

---

## 1. A sequência

O caminho macro, do estado atual até o produto do [`ESCOPO.md`](ESCOPO.md):

```
  fundação — 8 fases            plan/implemented/              concluída (ago/2026)
▶ interface: cor e markdown     plan/active/README.md          ← estamos aqui
  camada de dados               study/05-proximos-passos.md
  pipeline de passos, camada 1  ESCOPO.md
  receitas salvas
  JSON/NDJSON · Excel
  catálogo camada 2
  camada de IA — fatias 2 a 6   plan/active/09-camada-de-ia.md  fatia 1 concluída
```

Cada etapa depende da anterior por razão real, não por ordem arbitrária. As dependências estão nos documentos linkados.

**Duas saíram de ordem, e as duas por motivo registrado.** A fatia 1 da camada de IA (chat local via Ollama) rodou antes de tudo o que a precede no diagrama porque sua única dependência real era o registro de jobs da [fase 06](plan/implemented/06-primeira-feature.md) — as fatias 2 a 6 seguem dependendo da camada de dados e do pipeline. E a linha de interface nasceu dela: renderizar a resposta do modelo e consertar o contraste dos tokens são dívidas que a fatia 1 tornou visíveis, não etapas novas do produto. Nenhuma das duas move o `ESCOPO.md`.

---

## 2. Gatilhos de revisão

Decisões tomadas com um prazo de validade conhecido. Cada uma tem um **evento** que a reabre — não uma data, porque data não observa nada.

| Quando acontecer | Revisitar | Registrado em |
|---|---|---|
| DuckDB instalado e carregando | `shamefullyHoist: false` no `pnpm-workspace.yaml` | [`03-sandbox`](plan/implemented/03-sandbox-e-seguranca.md) |
| Primeira query reexecutada sobre o mesmo dataset | Adotar TanStack Query | [`06-primeira-feature`](plan/implemented/06-primeira-feature.md) |
| Segunda janela do app | Progresso endereçado ao remetente, em vez de transmitido a todas | [`06-primeira-feature`](plan/implemented/06-primeira-feature.md) |
| Sexta fatia em `features/` | `eslint-plugin-boundaries` no lugar do `no-restricted-imports` | [`01-camadas`](plan/implemented/01-camadas-e-fronteiras.md) |
| Vigésimo canal em `shared/ipc.ts` | Skill própria para IPC, separada de `architecture` | [`08-automacao`](plan/implemented/08-automacao-e-registro.md) |
| Design system estável | Endurecer a CSP (hoje permite `style-src 'unsafe-inline'`) | [`03-sandbox`](plan/implemented/03-sandbox-e-seguranca.md) |
| ~~`check:fast` passar de 10s~~ **disparado** — 21,5s (ago/2026) e **27s** medido na fase 08, agora que roda a cada resposta no `Stop` hook, bem acima da meta de 15s da skill `testing`. Investigar antes de empilhar mais teste | Medir a duração do ciclo de retorno | [`08-automacao`](plan/implemented/08-automacao-e-registro.md) |
| Existirem cartões de dados suficientes | RAG sobre cartões e receitas | [`09-camada-de-ia`](plan/active/09-camada-de-ia.md) |
| Fatia 2 do [`09`](plan/active/09-camada-de-ia.md) (NL→passo) gerando SQL para revisão | Calibrar a paleta `--syntax-*` de realce — cor só se decide vendo SQL real na tela | [`10-cor`](plan/active/10-cor-contraste-e-tema-claro.md) |

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

### A documentação markdown nunca passou pelo Prettier
`pnpm exec prettier --check` reprova **os 28 arquivos `.md` de `docs/`**, e isso é anterior a qualquer sessão recente — o `.prettierignore` não exclui `docs/`, mas ninguém rodou o formatador sobre eles. A consequência é uma armadilha armada: **`pnpm format` reformata toda a documentação de uma vez**, e quem rodar o comando de boa-fé vai produzir um diff de dezenas de arquivos misturado ao que estava fazendo. Duas saídas, e a escolha é de gosto: formatar tudo num commit isolado e só de formatação, ou acrescentar `docs/**/*.md` ao `.prettierignore` assumindo que a formatação da prosa é manual. O que não serve é deixar como está, porque o próximo `pnpm format` decide sozinho.

### `dist/win-unpacked` travado por um handle do sistema
Durante a auditoria de ago/2026, `electron-builder` passou a falhar com `EBUSY: resource busy or locked` ao substituir `dist/win-unpacked/resources/app.asar`, e `rm -rf` falha no mesmo arquivo. Nenhum processo `node`, `pnpm` ou `data-lab` estava em execução — o handle é do sistema, e o suspeito é a proteção em tempo real do Defender (`Get-MpComputerStatus` confirma ativa; conferir as exclusões exige terminal como administrador, que não foi usado). Contorno que funcionou: empacotar noutro destino com `electron-builder --dir -c.directories.output=<dir>`. Reiniciar a máquina libera o handle. **Se voltar a acontecer, reconferir as exclusões do Defender do [`CLAUDE.md`](../CLAUDE.md) — elas não viajam com o repositório e podem ter se perdido.**

---

## 5. Fora de escopo

Não são pendências. Estão em [`ESCOPO.md`](ESCOPO.md) com justificativa: visualização e BI, edição célula a célula, banco de dados remoto, execução agendada sem interface, colaboração multiusuário, versionamento de dados.
