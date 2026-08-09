# crivo

Bancada local para **limpar e transformar arquivos de dados**, construída com **Electron**, **React** e **TypeScript**.

Abrir CSV, Parquet, Excel ou JSON; montar uma sequência de operações de tratamento — filtrar, renomear, tipar, normalizar, deduplicar; ver o efeito de cada passo; exportar o resultado. Tudo local, sem servidor, sem nuvem, sem instalar banco de dados.

O projeto tem dois objetivos declarados, de peso equivalente:

1. Entregar a ferramenta acima.
2. Servir de estudo aprofundado do ecossistema Electron com TypeScript, com as decisões e os erros registrados em vez de apagados.

O segundo objetivo explica a densidade da documentação em [`docs/study/`](docs/study/README.md).

**O que o aplicativo faz e não faz** está definido em [`docs/ESCOPO.md`](docs/ESCOPO.md).

---

## Estado atual

🟡 **Em construção — fundação concluída, camada de dados ainda não implementada.**

| | |
|---|---|
| ✅ | Estrutura de camadas, com a regra de importação verificada por lint |
| ✅ | Contrato IPC tipado, com validação de argumentos e erro como dado |
| ✅ | Fronteira de segurança fechada: sandbox, isolamento, CSP, navegação negada |
| ✅ | Cinco níveis de teste, do nível 1 ao aplicativo empacotado |
| ✅ | Design tokens, primitivos de interface e estados de operação |
| ✅ | Primeira feature vertical: abrir arquivo, com progresso e cancelamento |
| ✅ | Empacotamento verificado — conteúdo do pacote inspecionado, não presumido |
| ⬜ | Automação de sessão e registro (fase 08) |
| ⬜ | DuckDB em processo auxiliar |
| ⬜ | Transporte de resultados em formato colunar |
| ⬜ | Tabela virtualizada |
| ⬜ | Pipeline de passos e catálogo de operações |
| ⬜ | Instalador distribuível, com assinatura |

O caminho está em três documentos, nesta ordem:

1. [`docs/ESCOPO.md`](docs/ESCOPO.md) — o que se está construindo
2. [`docs/plan/active/`](docs/plan/active/README.md) — oito fases de fundação, com passos e critérios de aceite
3. [`docs/study/05-proximos-passos.md`](docs/study/05-proximos-passos.md) — a camada de dados, que começa quando a fundação terminar

---

## Requisitos

| Ferramenta | Versão | Como instalar no Windows |
|---|---|---|
| Node.js | 24.x LTS | `winget install Schniz.fnm` e depois `fnm install 24` |
| pnpm | 11.x | `choco install pnpm` ou o instalador standalone |

O pnpm 11 exige Node 22 ou superior. As versões exatas usadas no desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md).

---

## Começando

```bash
pnpm install
pnpm dev
```

⚠️ **Se o `pnpm dev` falhar com `Error: Electron uninstall`:**

```bash
pnpm exec install-electron
```

O Electron 42 não baixa o binário durante a instalação — ele usa download preguiçoso, acionado no primeiro `require('electron')`. O electron-vite lê o caminho do binário diretamente e falha antes de acionar esse download. O diagnóstico completo está em [`docs/study/04-diario-de-bordo.md`](docs/study/04-diario-de-bordo.md).

---

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Desenvolvimento com HMR |
| `pnpm check:fast` | **O portão:** tipos + lint + testes rápidos |
| `pnpm typecheck` | Verifica tipos nos três ambientes |
| `pnpm test` | Testes dos níveis 1 a 3 |
| `pnpm test:coverage` | Idem, com relatório de cobertura |
| `pnpm test:e2e` | Sobe o aplicativo e o dirige (nível 4) |
| `pnpm test:e2e:packaged` | Idem, contra o aplicativo empacotado (nível 5) |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm build` | Verificação de tipos + build de produção |
| `pnpm build:win` | Instalador NSIS para Windows |

`pnpm typecheck` roda **três** projetos TypeScript independentes, porque main/preload, renderer e os testes de ponta a ponta vivem em ambientes incompatíveis. Rodar apenas um dá cobertura parcial com aparência de cobertura total.

`check:fast` é o comando que vale memorizar — é o que roda antes de commitar, e o único cujo tempo de resposta é vigiado.

---

## Estrutura

```
src/
├── shared/     contrato e vocabulário — os três processos conhecem
├── core/       lógica pura — sem electron, sem react
├── main/       processo principal — Node, sem interface, coordena tudo
├── workers/    processos auxiliares para trabalho pesado (ainda vazia)
├── preload/    a ponte — expõe ao renderer apenas o que foi autorizado
└── renderer/   a interface — React, sem acesso ao sistema de arquivos
```

Três dessas pastas não foram escolha nossa: `main`, `preload` e `renderer` são alvos de compilação impostos pelo Electron, com globais e regras próprias. As outras três nomeiam o que sobra. É o modelo de segurança transformado em estrutura — e reforçado pelos `tsconfig` separados, que fazem o compilador recusar `import fs` dentro de um componente React.

Qual camada pode importar qual é regra de lint, não convenção. [`docs/study/03-anatomia-do-projeto.md`](docs/study/03-anatomia-do-projeto.md) percorre a árvore inteira.

---

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime | Electron 42 | Embute Chromium 148 e Node 24.18.0 |
| Build | electron-vite 5 + Vite 7 | Orquestra os três alvos com HMR |
| Interface | React 19 | Ecossistema de tabela virtualizada e gráficos |
| Tipos | TypeScript 5.9 | Migração para o 6 planejada como exercício isolado |
| Dados | DuckDB via N-API | Colunar, embutido, sem recompilar contra a ABI |
| Transporte | Apache Arrow | Evita serializar milhões de linhas para JSON |
| Pacotes | pnpm 11 | `node_modules` estrito, store compartilhado |

O raciocínio completo — inclusive das alternativas recusadas, como Vite 8 e sidecar Python — está em [`docs/study/02-a-stack-e-o-porque.md`](docs/study/02-a-stack-e-o-porque.md).

---

## Documentação

| Documento | Para quem |
|---|---|
| [`docs/README.md`](docs/README.md) | **Mapa da documentação** — organização, ciclo de vida de um plano, convenção de fonte única |
| [`docs/ESCOPO.md`](docs/ESCOPO.md) | O que o aplicativo faz e não faz |
| [`docs/HISTORY.md`](docs/HISTORY.md) | Decisões, alternativas descartadas e armadilhas diagnosticadas |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | O que ainda falta, com os gatilhos que reabrem cada decisão |
| [`docs/plan/active/`](docs/plan/active/README.md) | Planos por implementar, com passos e critérios de aceite |
| [`docs/study/`](docs/study/README.md) | Caderno didático, do zero ao estado atual |
| [`CLAUDE.md`](CLAUDE.md) | Stack fixada, regras invioláveis, ambiente de desenvolvimento |

Cada assunto tem **um** dono; os demais apontam para ele. Fato duplicado é dívida — o segundo lugar envelhece calado.

O [diário de bordo](docs/study/04-diario-de-bordo.md) registra os problemas reais enfrentados até aqui, com o raciocínio de diagnóstico preservado e não só a solução. É o documento mais útil quando algo quebrar de novo, porque o método sobrevive às versões.

---

## Princípio de trabalho

**Uma variável por vez.** O projeto tem quatro fontes independentes de incompatibilidade: Electron, bundler, TypeScript e módulos nativos. Instalar, validar com `pnpm dev`, commitar — e só então seguir.

O corolário já se provou verdadeiro aqui mais de uma vez:

> Gerenciador de pacotes entrega reprodutibilidade, não corretude.
> `pnpm install` verde não significa aplicação que abre.

---

## Licença

Ainda não definida.
