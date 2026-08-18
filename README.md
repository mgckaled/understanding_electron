<div align="center">

# crivo

**Uma ferramenta local multiuso, operada por conversa — análise de dados é o pilar mais maduro: abra um arquivo, pergunte em português e saia com a resposta ou com o dado já tratado.**

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-5FA04E?logo=nodedotjs&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-local-000000?logo=ollama&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-planejado-8E75B2?logo=googlegemini&logoColor=white)
![GLM](https://img.shields.io/badge/GLM-planejado-3B82F6)
![SQLite](https://img.shields.io/badge/SQLite-embutido-003B57?logo=sqlite&logoColor=white)
![DuckDB](https://img.shields.io/badge/DuckDB-planejado-FFF000?logo=duckdb&logoColor=black)

![License](https://img.shields.io/badge/licen%C3%A7a-PolyForm%20Noncommercial%201.0.0-blue)
![privacidade](https://img.shields.io/badge/dados-nunca%20saem%20da%20m%C3%A1quina-success)
![local-first](https://img.shields.io/badge/local--first-sem%20nuvem%20por%20padr%C3%A3o-success)
![status](https://img.shields.io/badge/status-em%20constru%C3%A7%C3%A3o-yellow)

</div>

---

**Índice** · [O que é](#o-que-é) · [As duas coisas que você faz](#as-duas-coisas-que-você-faz-com-um-arquivo) · [Dois tipos de arquivo](#dois-tipos-de-arquivo) · [O que a IA vê](#o-que-a-ia-vê-do-seu-dado) · [Estado atual](#estado-atual) · [O que ele não faz](#o-que-ele-não-faz) · [Rodando o projeto](#rodando-o-projeto) · [Comandos](#comandos) · [Como é organizado](#como-é-organizado) · [Stack](#stack) · [Documentação](#documentação) · [Licença](#licença)

---

## O que é

O **crivo** é um programa de computador que ajuda você a **entender e limpar planilhas e arquivos de dados** — o tipo de trabalho que hoje se faz na mão, célula por célula, ou com um script descartável que ninguém mais consegue ler depois.

A diferença é a forma de usar: em vez de menus e botões, você **conversa** com o arquivo, em português. Três ideias resumem o app:

- **Tudo acontece no seu computador.** A inteligência artificial que responde às suas perguntas roda localmente (via [Ollama](https://ollama.com)), sem enviar seus arquivos para lugar nenhum. Nuvem é opcional, você liga quando quiser — e, mesmo ligada, ela nunca recebe as linhas do seu arquivo.
- **Você pergunta, ele responde ou trata o dado.** *"Qual a média de idade por cidade?"* devolve um resultado. *"Tira os registros repetidos por CPF"* devolve o arquivo já limpo. São dois usos diferentes, e o app trata cada um do jeito certo (mais abaixo).
- **A limpeza vira uma receita.** A sequência de passos que você montou para arrumar um arquivo pode ser salva e **reaplicada a outro arquivo** parecido. É o que transforma faxina manual em processo repetível — e é o maior ganho do app.

A mesma conversa também lê documento e imagem como contexto, busca a web, consulta documentação de biblioteca e mostra o raciocínio do modelo — cada capacidade um pilar próprio, não um acessório. Análise de dados continua sendo o mais maduro e o que organiza os demais; o critério que decide o que entra como pilar está em [`docs/ESCOPO.md`](docs/ESCOPO.md#o-teste-que-separa-pilar-de-produto-novo).

Este projeto tem **dois objetivos**, de peso igual: entregar a ferramenta acima, e servir de **estudo aprofundado** do ecossistema Electron, com as decisões e os erros registrados em vez de apagados. É isso que explica a densidade da documentação em [`docs/`](docs/README.md).

O que o aplicativo faz e **não** faz está definido em detalhe em [`docs/ESCOPO.md`](docs/ESCOPO.md).

---

## As duas coisas que você faz com um arquivo

Toda pergunta dirigida a um arquivo de dado tabular cai num de dois verbos — **perguntar** (devolve uma resposta, usada uma vez) ou **tratar** (devolve o arquivo limpo, como uma lista de passos que vira **receita** reaplicável). Confundi-los é a origem da maior parte do que dá errado numa ferramenta assim — o caso mais enganoso é a pergunta que parece consulta mas exige arrumar a coluna antes. Tabela completa, o diagrama do pipeline de passos e esse caso: [`docs/ESCOPO.md § Os dois verbos`](docs/ESCOPO.md#os-dois-verbos).

---

## Dois tipos de arquivo

O crivo abre duas coisas bem diferentes: **dado tabular** (CSV, Excel, Parquet, JSON — você pergunta e trata, e ele pode virar arquivo de saída) e **documento** (`.txt`, `.md`, PDF com texto, código-fonte, imagem — lido como contexto, nunca editado nem exportado). A linha entre os dois, o porquê de existirem juntos, e o critério que decide o que mais pode virar pilar do app: [`docs/ESCOPO.md § Duas classes de arquivo`](docs/ESCOPO.md#duas-classes-de-arquivo-e-a-linha-entre-elas).

---

## O que a IA vê do seu dado

O coração da privacidade do app: a IA recebe o **mínimo** necessário para ser útil, em três níveis que você controla — estrutura (nomes e tipos de coluna), perfil (estatísticas agregadas) e amostra (linhas cruas, opt-in por arquivo e **bloqueada** na nuvem). Tabela completa, o mesmo gate aplicado a documento/imagem, e por que a fonte do gate de capacidade importa: [`docs/ESCOPO.md § O que a IA vê do seu dado`](docs/ESCOPO.md#o-que-a-ia-vê-do-seu-dado).

---

## Estado atual

🟡 **Em construção.** A base do aplicativo — a interface de conversa, o histórico que sobrevive ao fechamento, e o anexo de dataset/documento/imagem — já funciona. O motor que consulta os dados (DuckDB) e as propostas geradas pela IA ainda estão por vir.

**O que já funciona:**

| | |
|---|---|
| ✅ | Interface de conversa de duas colunas, com lista de conversas e histórico, no alvo visual definido pelo design system (Tailwind CSS v4) |
| ✅ | Conversa com modelo local via Ollama, resposta aparecendo aos poucos |
| ✅ | Respostas formatadas (markdown) com **realce de cor** em blocos de código |
| ✅ | Histórico que **sobrevive ao fechar o app** — guardado num banco local |
| ✅ | Trocar de modelo de IA no meio da conversa, mensagem por mensagem |
| ✅ | Tema claro e escuro automáticos, com contraste de cor medido |
| ✅ | Orçamento de contexto por conversa — teto do modelo, medidor, recusa de envio que estouraria a janela |
| ✅ | Anexar dataset (com detecção de separador), documento (`.txt`/`.md`/PDF) e imagem à mesma conversa, com gate de capacidade (`vision`) |
| ✅ | Segurança fechada: o app roda isolado, sem acesso indevido ao sistema |
| ✅ | Cinco níveis de teste, do unitário ao aplicativo já empacotado |

**O que ainda falta:**

| | |
|---|---|
| ⬜ | Motor de dados DuckDB, rodando sem travar a interface |
| ⬜ | A IA propondo consultas e sequências de tratamento |
| ⬜ | Tabela grande exibida com fluidez, e gráficos como resultado |
| ⬜ | Busca web, documentação (MCP) e raciocínio visível no chat |
| ⬜ | Receitas salvas e reaplicáveis · Excel, JSON e outros formatos |
| ⬜ | Instalador distribuível, assinado |

O caminho completo, etapa por etapa, está em [`docs/ROADMAP.md`](docs/ROADMAP.md); o histórico do que já foi decidido e por quê, em [`docs/HISTORY.md`](docs/HISTORY.md).

---

## O que ele não faz

Registrado de propósito, para não ser confundido com "ainda não":

- **Não é uma ferramenta de BI.** Um gráfico pode aparecer no meio de uma conversa para você entender um resultado — mas painel, relatório e atualização automática ficam de fora.
- **Não edita célula a célula** como uma planilha do Excel. O trabalho é por passos, não por digitação direta.
- **Não conecta a bancos de dados remotos** nem a APIs. É local, e trabalha sobre arquivos.
- **Não faz OCR** de PDF escaneado (sem texto selecionável), nem lê `.docx`/`.pptx`.
- **Não é multiusuário.** É um app de uma pessoa, uma máquina.

---

## Rodando o projeto

> Esta seção é para quem vai rodar o código. O crivo ainda não tem instalador pronto — por enquanto ele roda a partir do código-fonte.

### Você vai precisar de

| Ferramenta | Versão | Para quê |
|---|---|---|
| [Node.js](https://nodejs.org) | 24.x LTS | Rodar o projeto |
| [pnpm](https://pnpm.io) | 11.x | Instalar as dependências |
| [Ollama](https://ollama.com/download) + um modelo | — | A conversa com a IA, localmente |

No Windows: `winget install Schniz.fnm` e depois `fnm install 24` para o Node; `choco install pnpm` para o pnpm. As versões exatas usadas no desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md).

### Passo a passo

```bash
pnpm install
pnpm dev

# em outro terminal, baixe o modelo padrão da conversa
ollama pull gemma3:4b
```

⚠️ **Se o `pnpm dev` falhar com `Error: Electron uninstall`:**

```bash
pnpm exec install-electron
```

O Electron 42 não baixa o seu binário durante a instalação — ele só baixa na primeira execução, e a ferramenta de build tropeça antes disso. O diagnóstico completo está no [diário de bordo](docs/study/04-diario-de-bordo.md).

---

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Desenvolvimento, com recarga automática |
| `pnpm check:fast` | **O portão:** tipos + lint + testes rápidos (o que roda antes de cada commit) |
| `pnpm typecheck` | Verifica tipos nos três ambientes do projeto |
| `pnpm test` | Testes dos níveis 1 a 3 |
| `pnpm test:e2e` | Sobe o app de verdade e o dirige (nível 4) |
| `pnpm lint` / `pnpm format` | Verificação de estilo / formatação |
| `pnpm build` | Verificação de tipos + build de produção |
| `pnpm build:win` | Instalador para Windows |

`pnpm typecheck` roda **três** projetos separados, porque as diferentes partes do app (o miolo, a interface e os testes de ponta a ponta) vivem em ambientes incompatíveis. Rodar só um dá cobertura parcial com aparência de cobertura total.

---

## Como é organizado

O código é dividido em seis pastas, e cada uma só pode "conversar" com certas outras — uma regra verificada automaticamente, não uma convenção que se lembra:

```text
src/
├── shared/     o vocabulário comum, que todas as partes conhecem
├── core/       a lógica pura — sem interface, sem sistema operacional
├── main/       o processo principal — coordena tudo, sem tela
├── workers/    processos auxiliares para trabalho pesado (ainda vazia)
├── preload/    a ponte — expõe à interface só o que foi autorizado
└── renderer/   a interface — o que você vê e clica (React)
```

Essa separação **é o modelo de segurança transformado em estrutura**: a interface (`renderer`) nunca toca o sistema de arquivos direto; ela pede, através de uma ponte estreita (`preload`), e o processo principal (`main`) decide. É o que mantém o app seguro por construção. A árvore inteira é percorrida em [`docs/study/03-anatomia-do-projeto.md`](docs/study/03-anatomia-do-projeto.md).

---

## Stack

Cada escolha aqui foi deliberada, não herança de template. O raciocínio completo — inclusive das alternativas recusadas — está em [`docs/study/02-a-stack-e-o-porque.md`](docs/study/02-a-stack-e-o-porque.md).

| Camada | Escolha | Por quê, em uma linha |
|---|---|---|
| Base do app | Electron 42 | Roda no seu computador, com tecnologia web por dentro |
| Interface | React 19 | Ecossistema maduro de tabelas e gráficos |
| Estilo | Tailwind CSS v4 | Utilidade que compila para CSS estático, consumindo os tokens do projeto — não os substitui |
| Linguagem | TypeScript 5.9 | Tipos que pegam erro antes de rodar |
| Build | electron-vite 5 + Vite 7 | Monta o app com recarga rápida |
| Cache de dados | TanStack Query 5 | Guarda o histórico da conversa na interface |
| Histórico | SQLite embutido | Já vem dentro do Electron — zero instalação extra |
| Motor de dados | DuckDB *(planejado)* | Consulta arquivos grandes sem carregar tudo na memória |
| Pacotes | pnpm 11 | Instalação enxuta e reproduzível |

---

## Documentação

Cada assunto tem **um** dono; os demais apontam para ele, nunca duplicam.

| Documento | Para quem |
|---|---|
| [`docs/README.md`](docs/README.md) | **Mapa da documentação** — organização e ciclo de vida de um plano |
| [`docs/ESCOPO.md`](docs/ESCOPO.md) | O que o aplicativo faz e não faz |
| [`docs/HISTORY.md`](docs/HISTORY.md) | Decisões, alternativas descartadas e armadilhas já diagnosticadas |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | O que ainda falta, e o que reabre cada decisão adiada |
| [`docs/study/`](docs/study/README.md) | Caderno didático, do zero ao estado atual |
| [`CLAUDE.md`](CLAUDE.md) | Stack fixada, regras do projeto e ambiente de desenvolvimento |
| `.claude/skills/{architecture,ipc,design-system,testing,comments}` | Dono técnico de cada assunto — camadas, contrato IPC, tokens visuais, estratégia de teste, convenção de comentário |

O [diário de bordo](docs/study/04-diario-de-bordo.md) é o mais útil quando algo quebra: ele registra os problemas reais enfrentados até aqui com o raciocínio de diagnóstico preservado — porque o método sobrevive às versões.

---

## Princípio de trabalho

**Uma variável por vez** — instalar, validar, registrar, só então seguir. O raciocínio completo, com o corolário sobre gerenciador de pacotes e corretude, está em [`CLAUDE.md § Princípio de trabalho`](CLAUDE.md#princípio-de-trabalho).

---

## Licença

Distribuído sob a [**PolyForm Noncommercial 1.0.0**](https://polyformproject.org/licenses/noncommercial/1.0.0/) — uso pessoal, estudo, pesquisa e organizações sem fins lucrativos são livres; **uso comercial não é permitido**. O texto completo está em [`LICENSE`](LICENSE).
