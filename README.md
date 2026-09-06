<div align="center">

# crivo

**Uma ferramenta local multiuso, operada por conversa — análise de dados é o pilar mais maduro: abra um arquivo, pergunte em português e saia com a resposta ou com o dado já tratado.**

![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-5FA04E?logo=nodedotjs&logoColor=white)

![License](https://img.shields.io/badge/licen%C3%A7a-PolyForm%20Noncommercial%201.0.0-blue)
![local-first](https://img.shields.io/badge/local--first-sem%20nuvem%20por%20padr%C3%A3o-success)
![privacidade](https://img.shields.io/badge/o%20que%20a%20IA%20v%C3%AA-opt--in%20por%20anexo-success)
![status](https://img.shields.io/badge/status-em%20constru%C3%A7%C3%A3o-yellow)

</div>

---

**Índice** · [O que é](#o-que-é) · [Como funciona](#como-funciona) · [Estado atual](#estado-atual) · [O que ele não faz](#o-que-ele-não-faz) · [Rodando o projeto](#rodando-o-projeto) · [Comandos](#comandos) · [Como é organizado](#como-é-organizado) · [Stack](#stack) · [Documentação](#documentação) · [Licença](#licença)

---

## O que é

O **crivo** administra a inteligência que roda na sua máquina e a que você opta por chamar na nuvem, e a coloca para trabalhar sobre os seus arquivos. O pilar mais maduro é **entender e limpar dados** — o tipo de trabalho que hoje se faz na mão, célula por célula, ou com um script descartável que ninguém mais consegue ler depois.

A diferença é a forma de usar: em vez de menus e botões, você **conversa** com o arquivo, em português.

- **Tudo acontece no seu computador.** A IA que responde roda localmente via [Ollama](https://ollama.com). Nuvem é opcional e você liga quando quiser.
- **Você pergunta, ele responde ou trata o dado.** *"Qual a média de idade por cidade?"* devolve um resultado. *"Tira os registros repetidos por CPF"* devolve o arquivo já limpo.
- **A limpeza vira uma receita.** A sequência de passos que arrumou um arquivo pode ser salva e **reaplicada a outro parecido** — é o que transforma faxina manual em processo repetível, e o maior ganho do app.

A mesma conversa também lê documento e imagem como contexto, busca a web, consulta documentação de biblioteca e mostra o raciocínio do modelo — cada capacidade um pilar próprio, não um acessório. O critério que decide o que entra como pilar está em [`ESCOPO § O teste que separa pilar de produto novo`](docs/ESCOPO.md#o-teste-que-separa-pilar-de-produto-novo).

O projeto tem **dois objetivos de peso igual**: entregar a ferramenta acima, e servir de **estudo aprofundado** do ecossistema Electron, com as decisões e os erros registrados em vez de apagados. É o que explica a densidade de [`docs/`](docs/README.md).

---

## Como funciona

**Dois verbos, e confundi-los é a origem da maior parte do que dá errado numa ferramenta assim.** *Perguntar* devolve uma resposta, usada uma vez; *tratar* devolve o arquivo limpo como uma sequência de passos — que vira **receita** reaplicável. O caso mais enganoso é a pergunta que parece consulta mas exige arrumar a coluna antes. → [`ESCOPO § Os dois verbos`](docs/ESCOPO.md#os-dois-verbos)

**Duas classes de arquivo.** *Dado tabular* (CSV, Excel, JSON) você pergunta e trata, e pode exportar. *Documento* (`.txt`, `.md`, PDF com texto, código-fonte, imagem) é lido como contexto — nunca editado nem exportado. → [`ESCOPO § Duas classes de arquivo`](docs/ESCOPO.md#duas-classes-de-arquivo-e-a-linha-entre-elas)

**Três níveis do que a IA vê do seu dado.** Estrutura (nomes e tipos de coluna), perfil (estatísticas agregadas) e amostra (linhas cruas). Os três são **opt-in por anexo, em qualquer provedor** — local ou nuvem: você decide caso a caso o que anexa, e o app nunca envia mais do que você autorizou. → [`ESCOPO § O que a IA vê do seu dado`](docs/ESCOPO.md#o-que-a-ia-vê-do-seu-dado)

---

## Estado atual

🟡 **Em construção.** A base já funciona de ponta a ponta: conversa, histórico persistente, anexos, o motor de dados e as propostas de tratamento geradas pela IA. O que falta é sobretudo apresentação de resultado (tabela grande, gráfico) e as ferramentas de chat.

**O que já funciona:**

| | |
|---|---|
| ✅ | Interface de conversa com lista, histórico e alvo visual definido pelo design system (Tailwind CSS v4) |
| ✅ | Conversa com modelo local via Ollama, resposta aparecendo aos poucos |
| ✅ | Respostas em markdown, com **realce de cor** em blocos de código |
| ✅ | Histórico que **sobrevive ao fechar o app** — banco local, sem servidor |
| ✅ | Trocar de modelo no meio da conversa, mensagem por mensagem |
| ✅ | Tema claro e escuro, com contraste de cor medido |
| ✅ | Orçamento de contexto por conversa — teto do modelo, medidor e recusa de envio que estouraria a janela |
| ✅ | Anexar dataset, documento (`.txt`/`.md`/PDF) e imagem à mesma conversa, com gate de capacidade (`vision`) |
| ✅ | Motor DuckDB em processo isolado: consulta SQL, pré-visualização e perfil de CSV, JSON/NDJSON e Excel |
| ✅ | **A IA propondo passos de tratamento** — lista editável, aplicada sobre o dataset com antes/depois |
| ✅ | IA de nuvem opt-in (GLM e Gemini), com segredo salvo localmente e nunca relido pela interface |
| ✅ | Segurança fechada: o app roda isolado, sem acesso indevido ao sistema |
| ✅ | **Raciocínio visível** — o modelo mostra como pensou, separado da resposta, nos três provedores |
| ✅ | **Exportar a resposta** como `.md`, `.txt`, `.pdf` ou `.docx` — e um bloco de código sai verbatim, com a extensão da linguagem |
| ✅ | **Observatório** — oito painéis em que o app se descreve: memória, processos, canais, motores, disco, desempenho por modelo e o livro-razão do que saiu da máquina |
| ✅ | Cinco níveis de teste, do unitário ao aplicativo já empacotado |

**O que ainda falta:**

| | |
|---|---|
| ⬜ | Tabela grande exibida com fluidez, e gráficos como resultado |
| ⬜ | Busca web e documentação (MCP) no chat |
| ⬜ | Receitas salvas e reaplicáveis |
| ⬜ | Projeto — agrupar conversas sob um contexto comum |
| ⬜ | Parquet no seletor de arquivo |
| ⬜ | Instalador assinado e distribuível |

O caminho completo está em [`docs/ROADMAP.md`](docs/ROADMAP.md); o que já foi decidido e por quê, em [`docs/HISTORY.md`](docs/HISTORY.md).

---

## O que ele não faz

Registrado de propósito, para não ser confundido com "ainda não":

- **Não é uma ferramenta de BI.** Um gráfico pode aparecer numa conversa para explicar um resultado — mas painel, relatório e atualização automática ficam de fora.
- **Não edita célula a célula** como uma planilha. O trabalho é por passos, não por digitação direta.
- **Não conecta a bancos remotos** nem a APIs. É local, e trabalha sobre arquivos.
- **Não faz OCR** de PDF escaneado, nem **lê** `.docx`/`.pptx` como anexo. (Gerar `.docx` como saída da resposta já funciona; `.pptx` está previsto.)
- **Não é multiusuário.** Um app, uma pessoa, uma máquina.

---

## Rodando o projeto

> O crivo ainda não tem instalador distribuível — `pnpm build:win` gera um, mas sem assinatura. Por enquanto ele roda a partir do código-fonte.

| Ferramenta | Versão | Para quê |
|---|---|---|
| [Node.js](https://nodejs.org) | 24.x LTS | Rodar o projeto |
| [pnpm](https://pnpm.io) | 11.x | Instalar as dependências |
| [Ollama](https://ollama.com/download) + um modelo | — | A conversa com a IA, localmente |

No Windows: `winget install Schniz.fnm` e `fnm install 24` para o Node; `choco install pnpm` para o pnpm. As versões exatas de desenvolvimento estão em [`CLAUDE.md`](CLAUDE.md).

```bash
pnpm install
pnpm dev

# em outro terminal, baixe o modelo padrão da conversa
ollama pull gemma3:4b
```

⚠️ **Se o `pnpm dev` falhar com `Error: Electron uninstall`**, rode `pnpm exec install-electron`. O Electron 42 não baixa o próprio binário durante a instalação — só na primeira execução, e a ferramenta de build tropeça antes disso. Diagnóstico completo no [diário de bordo](docs/study/04-diario-de-bordo.md).

---

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Desenvolvimento, com recarga automática |
| `pnpm check:fast` | **O portão:** tipos + lint + testes rápidos — roda antes de cada commit |
| `pnpm typecheck` | Verifica tipos nos três ambientes do projeto |
| `pnpm test` | Testes dos níveis 1 a 3 |
| `pnpm test:e2e` | Sobe o app de verdade e o dirige (nível 4) |
| `pnpm lint` / `pnpm format` | Verificação de estilo / formatação |
| `pnpm build` | Verificação de tipos + build de produção |
| `pnpm build:win` | Instalador para Windows |

`pnpm typecheck` roda **três** projetos separados, porque o miolo, a interface e os testes de ponta a ponta vivem em ambientes incompatíveis. Rodar só um dá cobertura parcial com aparência de cobertura total.

---

## Como é organizado

Seis pastas, e cada uma só pode importar de certas outras — regra verificada por lint, não convenção que se lembra:

```text
src/
├── shared/     o vocabulário comum, que todas as partes conhecem
├── core/       a lógica pura — sem interface, sem sistema operacional
├── main/       o processo principal — coordena tudo, sem tela
├── workers/    processos auxiliares para trabalho pesado — hoje, o DuckDB
├── preload/    a ponte — expõe à interface só o que foi autorizado
└── renderer/   a interface — o que você vê e clica (React)
```

Essa separação **é o modelo de segurança transformado em estrutura**: a interface nunca toca o sistema de arquivos direto; ela pede, através de uma ponte estreita, e o processo principal decide. A árvore inteira é percorrida em [`docs/study/03-anatomia-do-projeto.md`](docs/study/03-anatomia-do-projeto.md).

**Onde os dados do usuário ficam.** Nada disso mora no repositório: histórico de conversa (`crivo.db`, SQLite) e os anexos (`attachments/<hash>`, endereçados por conteúdo, com limpeza automática dos que nenhuma conversa referencia mais) vivem em `userData` — no Windows, `%APPDATA%\crivo\`. É o próprio Observatório do app (ícone no rodapé da sidebar, painéis "Banco de dados" e "Uso de disco") que revela esse diretório ao vivo, separando o que o crivo escreveu do que é só o motor Chromium por baixo — dono técnico em [`docs/reference/observatory/`](docs/reference/observatory/README.md).

O método de trabalho é **uma variável por vez** — instalar, validar, registrar, só então seguir; com o corolário de que gerenciador de pacotes entrega reprodutibilidade, não corretude ([`CLAUDE.md § Princípio de trabalho`](CLAUDE.md#princípio-de-trabalho)).

---

## Stack

Cada escolha foi deliberada, não herança de template. O raciocínio completo — inclusive das alternativas recusadas — está em [`docs/study/02-a-stack-e-o-porque.md`](docs/study/02-a-stack-e-o-porque.md).

| Camada | Escolha | Por quê, em uma linha |
|---|---|---|
| Base do app | Electron 42 | Roda no seu computador, com tecnologia web por dentro |
| Interface | React 19 | Ecossistema maduro de tabelas e gráficos |
| Estilo | Tailwind CSS v4 | Utilidade que compila para CSS estático, consumindo os tokens do projeto — não os substitui |
| Linguagem | TypeScript 5.9 | Tipos que pegam erro antes de rodar |
| Build | electron-vite 5 + Vite 7 | Monta o app com recarga rápida |
| Cache de dados | TanStack Query 5 | Guarda o histórico da conversa na interface |
| Histórico | SQLite embutido | Já vem dentro do Electron — zero instalação extra |
| Motor de dados | DuckDB, em `utilityProcess` | Consulta arquivos grandes sem carregar tudo na memória |
| Pacotes | pnpm 11 | Instalação enxuta e reproduzível |

---

## Documentação

Cada assunto tem **um** dono; os demais apontam para ele, nunca duplicam.

| Documento | Para quem |
|---|---|
| [`docs/README.md`](docs/README.md) | **Mapa da documentação** — organização, ciclo de vida de um plano, réguas de tamanho |
| [`docs/ESCOPO.md`](docs/ESCOPO.md) | O que o aplicativo faz e não faz |
| [`docs/HISTORY.md`](docs/HISTORY.md) | Os 10 marcos mais recentes — o que foi entregue, e o que foi descartado no caminho |
| [`docs/ARMADILHAS.md`](docs/ARMADILHAS.md) | Erro já diagnosticado, buscável **pelo sintoma** — o primeiro lugar a consultar quando algo quebra |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | O que ainda falta, e o evento que reabre cada decisão adiada |
| [`docs/DECISOES.md`](docs/DECISOES.md) | Índice tabular de cada decisão, por sigla |
| [`docs/study/`](docs/study/README.md) | Caderno didático, do zero ao estado atual |
| [`CLAUDE.md`](CLAUDE.md) | Stack fixada, regras do projeto e ambiente de desenvolvimento |
| [`.claude/skills/`](.claude/skills/) | Dono técnico por assunto — camadas, contrato IPC, design system, testes, comentários, camada de dados e camada de IA |

⚠️ **A documentação é grande de propósito e não se lê inteira.** São ~660k tokens em 117 arquivos, dos quais `plan/implemented/` responde por quase 60%; o protocolo de consulta — buscar pelo termo, ler só a seção — está em [`CLAUDE.md § Protocolo de leitura`](CLAUDE.md#protocolo-de-leitura-da-documentação).

---

## Licença

Distribuído sob a [**PolyForm Noncommercial 1.0.0**](https://polyformproject.org/licenses/noncommercial/1.0.0/) — uso pessoal, estudo, pesquisa e organizações sem fins lucrativos são livres; **uso comercial não é permitido**. O texto completo está em [`LICENSE`](LICENSE).
