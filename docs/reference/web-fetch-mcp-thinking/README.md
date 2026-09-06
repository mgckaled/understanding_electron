# Guia de Implementação — Web Fetch, MCP (Context7) e Thinking Mode

> Documento de referência para sessões de plan mode no Claude Code. Descreve escopo, arquitetura e sequenciamento — não é o plano de implementação em si.

## Contexto do projeto

- **Stack:** Electron + React + TypeScript
- **Estado atual:** chat funcional com Ollama, respostas renderizadas em Markdown, layout de chat já pronto
- **Hardware alvo:** Dell Inspiron 7580 — i5-8265U, MX150 (2GB VRAM, não usada), 16GB RAM total, ~7GB alocados para modelos, inferência CPU-only com 6 threads
- **Objetivo deste guia:** adicionar três capacidades ao chat existente — busca/fetch de conteúdo web, acesso a documentação via MCP (Context7), e modo de raciocínio (thinking) — usando o mecanismo de tool calling do Ollama como espinha dorsal comum.

## Modelo de referência

|              |                                    |
| ------------ | ---------------------------------- |
| Tag          | `qwen3:4b`                         |
| Download     | ~2.5GB                             |
| Contexto     | 256K tokens nativos                |
| Tool calling | Sim                                |
| Thinking     | Sim (nativo, alternável por turno) |

Esse modelo é o ponto de partida recomendado para as três features deste guia: cabe folgado no orçamento de 7GB, suporta tool calling (pré-requisito para web fetch e MCP) e suporta thinking nativamente. Modelos sem tag `tools` (ex: gemma3-4b) não devem ser usados como driver das features de tool calling — reserve-os para chat simples sem essas capacidades.

## Arquitetura geral

Toda lógica de rede e protocolo (Ollama, MCP, fetch HTTP) deve rodar no **main process** (Node.js), nunca no renderer. O React só exibe estado e dispara ações via IPC — isso preserva o modelo de segurança padrão do Electron (`contextBridge` + `preload`, sem `nodeIntegration` no renderer).

Responsabilidades por processo:

- **Main process:** cliente Ollama, cliente MCP, executor de web fetch, orquestração do loop de tool calling, streaming de tokens/thinking de volta ao renderer
- **Preload:** expõe uma API restrita (`window.api.chat(...)`, eventos de streaming) via `contextBridge`
- **Renderer (React):** UI de chat, toggle de thinking, indicador de "usando ferramenta X", render de Markdown já existente

## Feature 1 — Web Fetch local

**Objetivo:** permitir que o modelo busque conteúdo de uma URL e use isso como contexto na resposta, sem depender do endpoint cloud do Ollama.

**Onde roda:** main process, como uma tool comum no loop de tool calling.

**Fluxo:**
1. Usuário pergunta algo que exige conteúdo de uma URL (explícita ou inferida)
2. Modelo retorna um `tool_call` pedindo `web_fetch(url)`
3. Main process faz o request HTTP real (`fetch` nativo do Node 18+ ou `undici`)
4. Conteúdo HTML é limpo/extraído (remover nav, ads, scripts) — bibliotecas comuns em Node/TS: `@mozilla/readability` + `jsdom`, ou `unfluff`
5. Resultado (texto limpo, truncado a um limite de tokens) volta como mensagem `role: 'tool'`
6. Modelo continua a geração usando esse conteúdo como contexto

**Schema de tool sugerido:**
```json
{
  "type": "function",
  "function": {
    "name": "web_fetch",
    "description": "Busca e extrai o texto principal de uma URL",
    "parameters": {
      "type": "object",
      "properties": {
        "url": { "type": "string", "description": "URL completa a ser buscada" }
      },
      "required": ["url"]
    }
  }
}
```

**Pontos de atenção:**
- Truncar o conteúdo extraído antes de injetar (ex: ~4-8K tokens) — mesmo com 256K de contexto teórico, memória e velocidade de inferência em CPU são o limite real
- Timeout curto no fetch (ex: 10s) para não travar o loop
- Tratar PDFs e conteúdo não-HTML separadamente ou rejeitar com mensagem clara
- Cache simples por URL na sessão, para evitar refetch em perguntas de follow-up

## Feature 2 — MCP Context7

**Objetivo:** dar ao modelo acesso a documentação de bibliotecas atualizada, via servidor MCP do Context7, sem reimplementar a lógica de busca de docs.

**SDK:** `@modelcontextprotocol/sdk` (oficial, TypeScript) — roda no main process.

**Transporte:** Context7 é um servidor remoto, então use `StreamableHTTPClientTransport` (não `stdio`, que é para servidores locais).

**Fluxo:**
1. No boot do app (ou lazy, na primeira necessidade), main process conecta ao Context7 via MCP client
2. `client.listTools()` retorna o schema das tools disponíveis (tipicamente `resolve-library-id` e `query-docs`)
3. Esse schema é convertido para o formato `tools` que o `ollama.chat()` espera — ambos usam JSON Schema para os parâmetros, então a conversão é majoritariamente um mapeamento direto de campos
4. Modelo decide chamar a tool (ex: resolver o nome de uma lib para um ID, depois consultar a doc)
5. Main process executa via `client.callTool(name, args)` e devolve o resultado como mensagem `tool`

**Gerenciamento de conexão:**
- Trate a conexão MCP como um recurso de longa duração (não reconectar a cada mensagem)
- Implemente reconexão com backoff se a sessão cair
- Tenha um fallback claro quando o Context7 estiver indisponível — o chat deve continuar funcionando sem a tool, só sem esse contexto extra

## Feature 3 — Thinking Mode

> ⚠️ **Superada.** Esta seção tinha pouca profundidade — não lia os três adaptadores reais nem as APIs primárias. O levantamento vivo do arco 21 é [`reference/reasoning/README.md`](../reasoning/README.md); use este parágrafo só como ponto de partida histórico.

**Objetivo:** permitir que o usuário ative/desative o raciocínio interno do modelo (chain-of-thought) por turno, direto na UI de chat.

**Pré-requisito:** só funciona com modelos que suportam thinking nativamente (família Qwen3/Qwen3.5, DeepSeek-R1, GPT-OSS). `qwen3:4b` cobre isso.

**Duas formas de controlar:**
- Parâmetro `think: true | false` na chamada à API do Ollama — controle por request, ideal para um toggle na UI
- Instrução inline `/think` / `/no_think` no prompt — o modelo segue a instrução mais recente em conversas multi-turno, útil se quiser deixar o próprio usuário alternar via texto

**Na resposta da API**, o conteúdo de raciocínio vem separado (`message.thinking`) do conteúdo final (`message.content`) — a UI deve tratar isso como dois streams distintos, não concatenar.

**Sugestão de UX:**
- Toggle visível no composer do chat (ativado/desativado por padrão fica a critério do produto — dado o hardware CPU-only, considerar desativado por padrão para não penalizar toda pergunta simples com a latência extra)
- Bloco de thinking renderizado colapsado/recolhível acima da resposta final, com label tipo "Raciocínio" — padrão já comum em ferramentas de chat com modelos de reasoning

## Unificando as três features

Do ponto de vista do loop de tool calling, web fetch e MCP Context7 são só duas entradas no mesmo registry de tools — não precisam de tratamento especial diferenciado no orquestrador central. O loop geral (pseudocódigo do que o main process faz):

```
while true:
  response = ollama.chat(model, messages, tools=[web_fetch, ...mcpTools], think=userToggle)
  if response.message.thinking: emit('thinking-chunk', ...)
  if response.message.content: emit('content-chunk', ...)
  if not response.message.tool_calls: break
  for each tool_call:
    result = executeTool(tool_call)  // roteia pra web_fetch local ou client.callTool do MCP
    messages.push({ role: 'tool', content: result, tool_name: tool_call.name })
```

Thinking é ortogonal a esse loop — é um parâmetro da chamada, não uma tool.

## Fases sugeridas para as sessões de plan mode

1. **Thinking mode** — menor superfície de mudança, já que o chat com Ollama existe; principalmente trabalho de UI + parsing do campo `thinking` separado
2. **Web fetch local** — introduz o loop de tool calling pela primeira vez; feature mais simples pra validar esse mecanismo antes de trazer MCP
3. **MCP Context7** — reaproveita o loop de tool calling já validado na fase 2; adiciona a complexidade de gerenciar uma conexão externa de longa duração
4. **Unificação/polish** — registry único de tools, tratamento de erros consistente entre as fontes, indicadores de UI para qual tool está em uso

## Riscos e restrições de hardware a considerar no planejamento

- CPU-only com 7GB de teto: loops de tool calling com múltiplas idas e vindas (ex: MCP resolve-id → query-docs → resposta) somam latência perceptível — vale indicador visual de progresso na UI
- Contexto de 256K do qwen3:4b é teórico; o limite prático é RAM/velocidade, não o tamanho da janela — truncamento de conteúdo (web fetch, docs do Context7) continua necessário
- Thinking ativado aumenta ainda mais a latência em CPU — considerar desligado por padrão, ligado sob demanda

## Checklist de verificação

- [ ] Toggle de thinking funcional, com `message.thinking` renderizado separado de `message.content`
- [ ] Tool `web_fetch` registrada, com truncamento e timeout configurados
- [ ] Cliente MCP conectado ao Context7 via HTTP transport, com fallback gracioso se indisponível
- [ ] Loop de tool calling unificado tratando ambas as fontes de tools
- [ ] Nenhuma chamada de rede ou lógica MCP/Ollama rodando no renderer (tudo via IPC)
- [ ] Testado com `qwen3:4b` como modelo padrão para as três features
an
