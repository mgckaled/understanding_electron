# data-lab

Aplicação de desktop para análise de dados locais, construída com **Electron**, **React** e **TypeScript**.

O projeto tem dois objetivos declarados, de peso equivalente:

1. Entregar uma ferramenta que abra arquivos grandes de dados — CSV, Parquet — e permita consultá-los com SQL sem depender de servidor, nuvem ou instalação de banco.
2. Servir de estudo aprofundado do ecossistema Electron com TypeScript, com as decisões e os erros registrados em vez de apagados.

O segundo objetivo explica a densidade da documentação em [`docs/study/`](docs/study/README.md).

---

## Estado atual

🟡 **Em construção — base validada, camada de dados ainda não implementada.**

| | |
|---|---|
| ✅ | Estrutura de três processos (main, preload, renderer) compilando |
| ✅ | HMR no renderer, reinício automático do main |
| ✅ | Verificação de tipos separada por ambiente, passando limpo |
| ✅ | Pipeline de recompilação de módulo nativo funcionando |
| ⬜ | DuckDB em `utilityProcess` |
| ⬜ | Transporte de resultados via Apache Arrow |
| ⬜ | Tabela virtualizada |
| ⬜ | Empacotamento e instalador |

O plano detalhado das etapas pendentes está em [`docs/study/05-proximos-passos.md`](docs/study/05-proximos-passos.md).

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
| `pnpm typecheck` | Verifica tipos nos dois ambientes (Node e web) |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm build` | Verificação de tipos + build de produção |
| `pnpm build:win` | Instalador NSIS para Windows |

`pnpm typecheck` roda **dois** projetos TypeScript independentes, porque main/preload e renderer vivem em ambientes incompatíveis. Rodar apenas um dá cobertura parcial com aparência de cobertura total.

---

## Estrutura

```
src/
├── main/       processo principal — Node, sem interface, coordena tudo
├── preload/    a ponte — expõe ao renderer apenas o que foi autorizado
└── renderer/   a interface — React, sem acesso ao sistema de arquivos
```

Essa divisão não é organização estética: são três alvos de compilação distintos, com regras e tipos próprios. É o modelo de segurança do Electron transformado em estrutura de pastas — e reforçado pelos `tsconfig` separados, que fazem o compilador recusar `import fs` dentro de um componente React.

[`docs/study/03-anatomia-do-projeto.md`](docs/study/03-anatomia-do-projeto.md) percorre cada arquivo.

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
| [`CLAUDE.md`](CLAUDE.md) | Regras do projeto, armadilhas conhecidas, decisões pendentes |
| [`docs/study/`](docs/study/README.md) | Caderno didático, do zero ao estado atual |

O [diário de bordo](docs/study/04-diario-de-bordo.md) registra quatro problemas reais enfrentados na montagem — com o raciocínio de diagnóstico preservado, não só a solução. É o documento mais útil quando algo quebrar de novo, porque o método sobrevive às versões.

---

## Princípio de trabalho

**Uma variável por vez.** O projeto tem quatro fontes independentes de incompatibilidade: Electron, bundler, TypeScript e módulos nativos. Instalar, validar com `pnpm dev`, commitar — e só então seguir.

O corolário já se provou verdadeiro aqui mais de uma vez:

> Gerenciador de pacotes entrega reprodutibilidade, não corretude.
> `pnpm install` verde não significa aplicação que abre.

---

## Licença

Ainda não definida.
