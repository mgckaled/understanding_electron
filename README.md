<div align="center">

# crivo

**Uma bancada de dados local, operada por conversa — abra um arquivo, pergunte em português e saia com a resposta ou com o dado já tratado.**

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-5FA04E?logo=nodedotjs&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?logo=windows&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-local-000000?logo=ollama&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-opt--in-8E75B2?logo=googlegemini&logoColor=white)
![GLM](https://img.shields.io/badge/GLM-opt--in-3B82F6)
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

Este projeto tem **dois objetivos**, de peso igual: entregar a ferramenta acima, e servir de **estudo aprofundado** do ecossistema Electron, com as decisões e os erros registrados em vez de apagados. É isso que explica a densidade da documentação em [`docs/`](docs/README.md).

O que o aplicativo faz e **não** faz está definido em detalhe em [`docs/ESCOPO.md`](docs/ESCOPO.md).

---

## As duas coisas que você faz com um arquivo

Toda pergunta dirigida a uma planilha cai em um de dois casos. Eles parecem iguais, mas pedem respostas de formatos diferentes — e confundi-los é a origem da maior parte do que dá errado numa ferramenta assim.

| | **Perguntar** | **Tratar** |
|---|---|---|
| Exemplo | *"qual a média de idade por cidade?"* | *"tira os duplicados por CPF"* |
| O que volta | uma resposta pronta | o arquivo limpo, em passos |
| Vida útil | usada uma vez | vira **receita**, reaplicável a outro arquivo |
| Você revisa | a resposta antes de aceitar | os passos, que continuam editáveis depois |

No caso de **tratar**, a limpeza não é uma caixa-preta: ela é uma **lista de passos** que você enxerga e edita —

```text
planilha.csv
  ├─ 1. remover colunas vazias
  ├─ 2. renomear "dt_nasc" → "data_nascimento"
  ├─ 3. converter para data (formato dd/MM/aaaa)
  ├─ 4. filtrar: idade ≥ 18
  ├─ 5. preencher "cidade" em branco com "não informado"
  └─ 6. remover repetidos por "cpf"
        └─► exportar
```

Desfazer é só remover um passo. Cada passo mostra o que entrou e o que saiu. E a lista inteira pode ser salva como receita. O arquivo original **nunca é alterado no meio do caminho** — o resultado é sempre recalculado a partir dele.

> **Um detalhe que engana:** *"liste os tipos de produto e a quantidade de cada um"* parece uma pergunta, mas se a coluna `quantidade` mistura `2`, `3` e `"dois"`, não há resposta possível sem antes **arrumar** a coluna. O app foi feito para perceber isso, em vez de devolver uma tabela vazia com cara de resposta certa.

---

## Dois tipos de arquivo

O crivo abre duas coisas bem diferentes, e a linha entre elas é o que impede o app de virar "um chat genérico com um leitor de arquivo pregado ao lado":

| | **Dado tabular** | **Documento** |
|---|---|---|
| Formatos | CSV, Excel, Parquet, JSON | `.txt`, `.md`, PDF com texto · imagens (PNG, JPEG, SVG, WebP) |
| O que você faz | **perguntar** e **tratar** | **ler junto**, como contexto |
| Vira arquivo de saída? | sim — é o ponto do app | **nunca** |

Por que os dois? Porque a pergunta real quase nunca é só sobre o CSV — é sobre o CSV **e** o documento que explica o que cada coluna deveria conter: a especificação, o contrato em PDF, a captura de tela da planilha que alguém mandou. Manter as duas coisas em dois programas separados é exatamente o atrito que o crivo existe para remover. O documento entra na conversa para ser lido; ele não é editado, convertido nem exportado.

---

## O que a IA vê do seu dado

Este é o coração da privacidade do app. Para ser útil, a inteligência artificial precisa saber algo sobre o seu arquivo — mas o **mínimo** para ser segura. São três níveis, e você controla até onde ela chega:

| Nível | O que a IA recebe | Exemplo de exposição |
|---|---|---|
| **1 — estrutura** | só os nomes e tipos das colunas | *nenhuma* |
| **2 — perfil** | estatísticas: mínimo, máximo, média, % de vazios | *quase nenhuma — são números sobre o conjunto, não valores* |
| **3 — amostra** | as primeiras linhas, como estão no arquivo | *total — só liberada se você permitir* |

Os níveis 1 e 2 dão à IA o suficiente para dizer coisas úteis (*"a coluna idade tem 12% de vazios e um máximo de 999 — isso costuma ser código para 'não informado'"*) **sem** que nenhum valor real do seu arquivo saia dele. O nível 3 é opcional, arquivo por arquivo — e quando você usa a nuvem, ele fica **bloqueado**.

---

## Estado atual

🟡 **Em construção.** A base do aplicativo — a interface de conversa e o histórico que sobrevive ao fechamento — já funciona. O motor que consulta os dados (DuckDB) e as propostas geradas pela IA ainda estão por vir.

**O que já funciona:**

| | |
|---|---|
| ✅ | Interface de conversa de duas colunas, com lista de conversas e histórico |
| ✅ | Conversa com modelo local via Ollama, resposta aparecendo aos poucos |
| ✅ | Respostas formatadas (markdown) com **realce de cor** em blocos de código |
| ✅ | Histórico que **sobrevive ao fechar o app** — guardado num banco local |
| ✅ | Trocar de modelo de IA no meio da conversa, mensagem por mensagem |
| ✅ | Tema claro e escuro automáticos, com contraste de cor medido |
| ✅ | Abrir um arquivo com detecção de separador, barra de progresso e cancelamento |
| ✅ | Segurança fechada: o app roda isolado, sem acesso indevido ao sistema |
| ✅ | Cinco níveis de teste, do unitário ao aplicativo já empacotado |

**O que ainda falta:**

| | |
|---|---|
| ⬜ | Orçamento de contexto e escolha de modelo (em andamento) |
| ⬜ | Anexar arquivos e documentos à conversa |
| ⬜ | Motor de dados DuckDB, rodando sem travar a interface |
| ⬜ | A IA propondo consultas e sequências de tratamento |
| ⬜ | Tabela grande exibida com fluidez, e gráficos como resultado |
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

O [diário de bordo](docs/study/04-diario-de-bordo.md) é o mais útil quando algo quebra: ele registra os problemas reais enfrentados até aqui com o raciocínio de diagnóstico preservado — porque o método sobrevive às versões.

---

## Princípio de trabalho

**Uma variável por vez.** O projeto tem quatro fontes independentes de incompatibilidade: Electron, ferramenta de build, TypeScript e módulos nativos. Instalar, validar, registrar — e só então seguir. O corolário já se provou verdadeiro aqui mais de uma vez:

> Gerenciador de pacotes entrega reprodutibilidade, não corretude.
> Uma instalação sem erros não significa um aplicativo que abre.

---

## Licença

Distribuído sob a [**PolyForm Noncommercial 1.0.0**](https://polyformproject.org/licenses/noncommercial/1.0.0/) — uso pessoal, estudo, pesquisa e organizações sem fins lucrativos são livres; **uso comercial não é permitido**. O texto completo está em [`LICENSE`](LICENSE).
